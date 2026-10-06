import {app,BrowserWindow,ipcMain,dialog,shell,safeStorage,clipboard,Menu} from 'electron';
import {createServer as netServer} from 'node:net';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {z} from 'zod';
import {Browser,normalizeUrl} from './browser.js';
import {startFixture} from './fixture.js';
import {AgentBrowser} from '../packages/agent-adapter/index.js';
import {Store,safeUrl,redact} from '../packages/core/store.js';
import {Permissions} from '../packages/core/permissions.js';
import {Orchestrator} from '../packages/core/orchestrator.js';
import {CodexAdapter} from '../packages/codex-adapter/index.js';
import {siteSupport} from '../packages/capabilities/index.js';
import {fail,type Artifact} from '../packages/core/types.js';
import {integrationConfigs} from './integrations.js';
import {resolveCodex,checkBinary} from './runtime.js';
import {toolDefinition} from '../packages/core/tool-registry.js';
import {continuationContext} from '../packages/core/continuation.js';
import {guardConsoleOutput} from './stdio.js';
import {agentBrowserName,runtimePath} from './platform.js';
import {localTransport} from './local-transport.js';
guardConsoleOutput();
process.env.PATH=runtimePath();

const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const benchmark=process.argv.includes('--token-benchmark');
const selftest=process.argv.includes('--self-test')||benchmark;
const dataDir=app.getPath('userData');mkdirSync(dataDir,{recursive:true});
const mediaPreview=basename(dataDir)==='HONMOON-Media-Preview';
const cdPort=app.commandLine.getSwitchValue('remote-debugging-port');
await app.whenReady();
const window=new BrowserWindow({width:1500,height:940,minWidth:1050,minHeight:700,title:'HONMOON',titleBarStyle:'hidden',...(process.platform==='darwin'?{trafficLightPosition:{x:12,y:12}}:{}),titleBarOverlay:{color:'#19161f',symbolColor:'#c9c1d0',height:40},backgroundColor:'#09080d',show:true,autoHideMenuBar:true,webPreferences:{preload:join(root,'dist/main/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
if(process.platform==='darwin')Menu.setApplicationMenu(Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'}]));
window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
app.on('second-instance',()=>{window.show();window.focus();});
const store=new Store(join(dataDir,'honmoon.sqlite'));
let core:Orchestrator,codex:CodexAdapter,browser:Browser;let latestError='';let panel='agent';let ready=false;let pushTimer:ReturnType<typeof setTimeout>|undefined;
const changed=()=>{if(!ready||window.isDestroyed())return;browser.setLocked(!!core.task);if(pushTimer)return;pushTimer=setTimeout(()=>{pushTimer=undefined;if(!window.isDestroyed())window.webContents.send('honmoon:state',state());},35);};
const permissions=new Permissions(changed,data=>store.event('approval.task.consumed',data));
browser=new Browser(window,changed,permissions);
const fixture=await startFixture();
const nativeName=agentBrowserName();
const binary=app.isPackaged?join(process.resourcesPath,nativeName):join(root,'node_modules','agent-browser','bin',nativeName);
const transport=localTransport(dataDir);
let browserRuntime:{path:string;version?:string;error?:string}={path:binary};try{browserRuntime=checkBinary(binary,'agent-browser');}catch(e){browserRuntime.error=(e as Error).message;latestError=browserRuntime.error;}
const adapter=new AgentBrowser(binary,String(cdPort),'honmoon-'+process.pid,transport.agentHome);
adapter.viewport=()=>browser.bounds;

core=new Orchestrator(browser,adapter,store,permissions,changed);
const executionSettings=join(dataDir,'execution-settings.json');
if(existsSync(executionSettings)){try{core.defaultMode=JSON.parse(readFileSync(executionSettings,'utf8')).mode==='compact'?'compact':'legacy';}catch{}}
browser.onHandoff=()=>core.cancel('USER_HANDOFF');
codex=new CodexAdapter('',join(dataDir,'codex'),join(dataDir,'agent-workspace'),(name,args,id)=>core.tool(name,args,id));
codex.resolveBinary=()=>resolveCodex(dataDir);
codex.on('change',()=>{core.update();});codex.on('notice',message=>{latestError=message;changed();});codex.on('taskDone',output=>{void core.reviewCompletion(output).catch(e=>{latestError=redact(e.message);changed();});});codex.on('taskFailed',error=>core.finish('failed',error));core.onTask=task=>codex.run(task);core.onCancel=()=>{void codex.interrupt();};
browser.onClosed=id=>{const target=browser.views.get(id)?.info.targetId;if(core.task?.tabId===id)core.cancel('TAB_CLOSED');if(target)adapter.invalidateTarget(target);};
browser.onNavigation=(id,url)=>{if(core.task?.tabId===id&&new URL(url).origin!==core.task.origin){core.cancel('ORIGIN_CHANGED');latestError='다른 사이트로의 이동을 중단했습니다. 직접 이동한 뒤 새 작업을 시작하세요.';return false;}return true;};
browser.session.on('will-download',(_event,item,wc)=>{
 const tab=[...browser.views.values()].find(v=>v.view.webContents.id===wc?.id);if(!tab){item.cancel();return;}
 const downloadDir=join(dataDir,'downloads');mkdirSync(downloadDir,{recursive:true});const name=basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'download';
 const art:Artifact={id:randomUUID(),mediaBinding:core.media.claimDownload(tab.info.id,item.getURL(),name),taskId:core.task?.tabId===tab.info.id?core.task.id:undefined,name,path:join(downloadDir,randomUUID()+'-'+name),sourceUrl:safeUrl(item.getURL()),createdAt:Date.now(),status:'downloading',bytes:0,mime:item.getMimeType()};item.setSavePath(art.path);store.artifact(art);changed();
 item.on('updated',()=>{art.bytes=item.getReceivedBytes();store.artifact(art);changed();});item.on('done',(_e,status)=>{art.status=status==='completed'?'completed':'interrupted';art.bytes=item.getReceivedBytes();store.artifact(art);store.event('download.'+art.status,{id:art.id,taskId:art.taskId,bytes:art.bytes});changed();});
});

// Authenticated local IPC: Windows named pipe or owner-only Unix socket.
const pipe=transport.pipe;const token=randomBytes(32).toString('hex');
const gateway=netServer(socket=>{let buffer='';socket.setTimeout(150000,()=>socket.destroy());socket.on('error',()=>{});socket.on('data',async chunk=>{buffer+=chunk;if(buffer.length>65536){socket.destroy();return;}if(!buffer.includes('\n'))return;socket.removeAllListeners('data');try{const r=JSON.parse(buffer.trim());const candidate=Buffer.from(String(r.token||''));const expected=Buffer.from(token);if(candidate.length!==expected.length||!timingSafeEqual(candidate,expected))throw new Error('Unauthorized');if(!toolDefinition(r.method))throw new Error('Tool denied');socket.end(JSON.stringify({result:await core.tool(r.method,r.args)})+'\n');}catch(e){socket.end(JSON.stringify({error:redact((e as Error).message)})+'\n');}});});
await new Promise<void>((resolve,reject)=>{gateway.once('error',reject);gateway.listen(pipe,()=>{gateway.removeListener('error',reject);resolve();});});
const connectionFile=join(dataDir,'mcp-connection.json');
try{transport.secureSocket();transport.connection(connectionFile,{pipe,token});}catch{latestError='MCP 연결 파일의 권한 제한을 확인하지 못했습니다. 외부 MCP를 비활성화했습니다.';gateway.close();}
const mcpCommand=app.isPackaged?process.execPath:'node';const mcpArgs=[app.isPackaged?join(process.resourcesPath,'bridge.cjs'):join(root,'dist/mcp/bridge.cjs'),'--connection',connectionFile];const mcpEnv:Record<string,string>=app.isPackaged?{ELECTRON_RUN_AS_NODE:'1'}:{};const integrations=integrationConfigs(mcpCommand,mcpArgs,mcpEnv);const mcpConfig=JSON.parse(integrations.claude);

const vaultIndexFile=join(dataDir,'vault-index.json');let vaults:any[]=existsSync(vaultIndexFile)?JSON.parse(readFileSync(vaultIndexFile,'utf8')):[];
function vaultKey(){if(!safeStorage.isEncryptionAvailable())fail('ENCRYPTION_UNAVAILABLE','OS 암호화 기능을 사용할 수 없습니다.');const keyFile=join(dataDir,process.platform==='win32'?'vault-key.dpapi':'vault-key.safe-storage');if(!existsSync(keyFile))writeFileSync(keyFile,safeStorage.encryptString(randomBytes(32).toString('hex')),{mode:0o600});return safeStorage.decryptString(readFileSync(keyFile));}
adapter.secrets=()=>({AGENT_BROWSER_ENCRYPTION_KEY:vaultKey()});
function state(){return {platform:process.platform,taskApproval:core.task?permissions.taskGrant(core.task.id):undefined,mediaPreview,mediaJobs:store.mediaJobs().map(j=>core.media.publicJob(j)),executionMode:core.defaultMode,tabs:browser.tabs(),activeId:browser.activeId(),task:core.task,tasks:store.tasks(),capabilities:core.capabilities,approvals:permissions.list(),artifacts:store.artifacts().map(({path,...rest})=>rest),events:store.events().slice(0,30),files:[...core.files.values()].map(({id,name,size})=>({id,name,size})),codex:{status:codex.status,authenticated:!!codex.account,models:codex.models.map(m=>({id:m.id,model:m.model,name:m.displayName||m.model,isDefault:m.isDefault,efforts:m.supportedReasoningEfforts?.map((e:any)=>e.reasoningEffort||e)})),login:codex.login,output:redact(codex.output)},runtimes:{browser:browserRuntime,codex:{path:codex.binary,status:codex.status}},support:siteSupport,fixtureUrl:fixture.url,error:latestError,vaults,mcpConfig,versions:{electron:process.versions.electron,chromium:process.versions.chrome,agentBrowser:'0.38.1'}};}

async function dispatch(method:string,args:any={}){
 switch(method){
  case 'state':return state();
  case 'bounds':{const p=z.object({x:z.number().min(0),y:z.number().min(0),width:z.number().min(1),height:z.number().min(1),hidden:z.boolean()}).parse(args);browser.setBounds(p,p.hidden);return true;}
  case 'tabs.new':core.cancel('USER_HANDOFF');return browser.create(args.url||fixture.url+'/newtab');
  case 'tabs.activate':core.cancel('USER_HANDOFF');browser.activate(z.string().parse(args.id));return true;
  case 'tabs.close':browser.close(z.string().parse(args.id));return true;
  case 'tabs.navigate':core.cancel('USER_HANDOFF');await browser.navigate(browser.activeId(),z.string().parse(args.url));return true;
  case 'tabs.back':case 'tabs.forward':case 'tabs.reload':{core.cancel('USER_HANDOFF');const wc=browser.views.get(browser.activeId())?.view.webContents;if(!wc)return;const nav=wc.navigationHistory;if(method==='tabs.back'&&nav.canGoBack())nav.goBack();if(method==='tabs.forward'&&nav.canGoForward())nav.goForward();if(method==='tabs.reload')wc.reload();return true;}
  case 'auth.pause':core.cancel('AUTH_HANDOFF');browser.tab(browser.activeId()).authPaused=z.boolean().parse(args.paused);changed();return true;
  case 'capabilities.list':return core.list(browser.activeId());
  case 'capabilities.invoke':{if(core.task)fail('PROFILE_BUSY','실행 중인 작업을 먼저 중지하세요.');await core.start('사용자 기능 실행',browser.activeId(),undefined,true);try{return await core.invoke(args,true);}catch(e){core.finish('failed',(e as Error).message);throw e;}}
  case 'tasks.start':if(!codex.account)fail('CODEX_LOGIN_REQUIRED','설정에서 Codex 로그인을 완료하세요.');{const scope=args.taskApproval?taskScope(args.taskApproval):undefined;const prior=args.continuationId?store.tasks().find(t=>t.id===args.continuationId):undefined;if(args.continuationId&&!prior)fail('TASK_NOT_FOUND','이전 작업을 찾을 수 없습니다.');return core.start(z.string().min(1).max(12000).parse(args.prompt),browser.activeId(),args.model,false,false,prior?continuationContext(prior,store.artifacts()):undefined,args.reasoningEffort?z.enum(['low','medium','high']).parse(args.reasoningEffort):undefined,scope);}
  case 'approvals.task':{const scope=taskScope(args.scope);const id=z.string().parse(args.taskId);if(await browser.authCheck(browser.activeId()))fail('AUTH_REQUIRED','인증 중에는 승인할 수 없습니다.');core.authorizeTask(id,taskScope(args.scope));return true;}
  case 'settings.execution':if(core.task)fail('PROFILE_BUSY','작업 완료 후 변경하세요.');core.defaultMode=z.enum(['legacy','compact']).parse(args.mode);writeFileSync(executionSettings,JSON.stringify({mode:core.defaultMode}));changed();return true;
  case 'tasks.cancel':core.cancel();return true;
  case 'approvals.decide':{const p=z.object({id:z.string(),allow:z.boolean()}).strict().parse(args);store.event('approval.decision',p);permissions.decide(p.id,p.allow);return true;}
  case 'files.pick':{const r=await dialog.showOpenDialog(window,{properties:['openFile','multiSelections']});return r.canceled?[]:r.filePaths.map(p=>core.addFile(p));}
  case 'artifacts.reveal':{const a=store.artifacts().find(a=>a.id===args.id);if(a&&existsSync(a.path))shell.showItemInFolder(a.path);return true;}
  case 'artifacts.preview':{const a=store.artifacts().find(a=>a.id===args.id);if(!a||a.status!=='completed')fail('ARTIFACT_UNAVAILABLE','완료된 결과물이 아닙니다.');const size=statSync(a.path).size;if(size>30*1024*1024||!/^image\/(png|jpeg|webp|gif)$|^video\/(mp4|webm)$/.test(a.mime))fail('PREVIEW_UNSUPPORTED','이 형식은 미리보기를 제공하지 않습니다. 폴더에서 확인하세요.');return {mime:a.mime,data:readFileSync(a.path).toString('base64')};}
  case 'codex.connect':await codex.connect();return true;
  case 'codex.binary':{const r=await dialog.showOpenDialog(window,{title:'Codex CLI 실행파일 선택',...(process.platform==='win32'?{filters:[{name:'Codex CLI',extensions:['exe']}]}:{}),properties:['openFile']});if(r.canceled)return false;const selected=checkBinary(r.filePaths[0],'codex');codex.dispose();writeFileSync(join(dataDir,'runtime-settings.json'),JSON.stringify({codexPath:selected.path}));codex.status='disconnected';await codex.connect();latestError='';changed();return true;}
  case 'codex.login':{const r=await codex.loginStart();core.cancel('AUTH_HANDOFF');if(r.verificationUrl)await browser.create(r.verificationUrl,true);return r;}
  case 'mcp.copy':{const client=z.enum(['codex','claude','antigravity']).default('claude').parse(args.client);clipboard.writeText(integrationConfigs(mcpCommand,[...mcpArgs,'--toolset',core.defaultMode],mcpEnv)[client]);return true;}
  case 'vault.save':{const p=z.object({name:z.string().min(1).max(60),url:z.string(),username:z.string().min(1).max(300),password:z.string().min(1).max(4000)}).strict().parse(args);const url=normalizeUrl(p.url);const id='honmoon-'+randomUUID();await adapter.raw(['auth','save',id,'--url',url,'--username',p.username,'--password-stdin'],p.password,{AGENT_BROWSER_ENCRYPTION_KEY:vaultKey()});vaults.push({id,name:p.name,url:new URL(url).origin});writeFileSync(vaultIndexFile,JSON.stringify(vaults));changed();return true;}
  case 'vault.login':{core.cancel('AUTH_HANDOFF');const v=vaults.find(v=>v.id===args.id);if(!v)fail('VAULT_NOT_FOUND','인증 항목 없음');const tab=browser.tab(browser.activeId());if(new URL(tab.url).origin!==v.url)fail('ORIGIN_MISMATCH','저장한 인증 사이트로 먼저 이동하세요.');tab.authPaused=true;const target=await browser.target(tab.id);await adapter.exclusive(async command=>{await command(['tab',target]);return adapter.raw(['auth','login',v.id,'--no-navigate'],undefined,{AGENT_BROWSER_ENCRYPTION_KEY:vaultKey()});});changed();return true;}
  case 'error.clear':latestError='';changed();return true;
  default:fail('METHOD_DENIED','허용되지 않은 제품 명령입니다.');
 }
}
function taskScope(raw:unknown){const p=z.object({tabId:z.string(),origin:z.string().url(),fileIds:z.array(z.string()),allowUnknownCost:z.boolean(),generationLimit:z.number().int().min(1).max(10)}).strict().parse(raw);if(p.tabId!==browser.activeId()||p.origin!==new URL(browser.tab(browser.activeId()).url).origin||JSON.stringify([...p.fileIds].sort())!==JSON.stringify([...core.files.keys()].sort()))fail('APPROVAL_STALE','탭 또는 선택 파일이 변경되었습니다. 승인 범위를 다시 확인하세요.');return p;}
ipcMain.handle('honmoon',async(event,method,args)=>{if(event.sender.id!==window.webContents.id||event.senderFrame!==window.webContents.mainFrame)fail('UNTRUSTED_SENDER','외부 페이지 IPC 차단');try{return {ok:true,data:await dispatch(method,args)};}catch(e){const error=redact((e as Error).message);latestError=error;changed();return {ok:false,error,code:(e as any).code||'ERROR'};}});
await window.loadFile(join(root,'dist/ui/index.html'));ready=true;
await browser.create(selftest?fixture.url:fixture.url+'/newtab');
void codex.connect().catch(e=>{latestError='Codex 연결: '+redact(e.message);changed();});
changed();
let closing=false;
app.on('before-quit',event=>{if(closing)return;event.preventDefault();closing=true;ready=false;if(pushTimer)clearTimeout(pushTimer);core.dispose();codex.dispose();adapter.cancel();permissions.cancel();gateway.close(()=>transport.cleanup());fixture.server.close();browser.session.flushStorageData();void Promise.race([browser.session.cookies.flushStore(),new Promise(resolve=>setTimeout(resolve,3000))]).catch(()=>{}).finally(()=>{browser.dispose();store.close();app.quit();});});
window.on('closed',()=>app.quit());
if(selftest){const {verify}=await import('./verify.js');const outputRoot=app.isPackaged?join(app.getPath('temp'),'honmoon-package-verification'):root;let exitCode=0;try{const run=benchmark?(await import('./token-benchmark.js')).tokenBenchmark:verify;await run({app,window,browser,core,adapter,permissions,store,codex,fixtureUrl:fixture.url,root:outputRoot,state,dispatch});}catch(e){console.error(e);mkdirSync(join(outputRoot,'evidence'),{recursive:true});writeFileSync(join(outputRoot,'evidence','verify-error.txt'),String((e as Error).stack));exitCode=1;}finally{app.quit();if(exitCode)app.exit(exitCode);}}
