import {randomUUID,createHash} from 'node:crypto';
import {statSync,realpathSync,readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {z} from 'zod';
import {AgentBrowser} from '../agent-adapter/index.js';
import {discover,fingerprint,hash} from '../capabilities/index.js';
import {rankCapabilities} from '../capabilities/search.js';
import {CapabilityPresenter} from '../capabilities/presenter.js';
import {Store,redact,safeUrl} from './store.js';
import {Permissions} from './permissions.js';
import {AppError,fail,type BrowserPort,type Capability,type Task} from './types.js';
import {BrowserExecutor} from './browser-executor.js';
import {MediaRunner} from './media-runner.js';
import {mediaSite} from './media-contract.js';
import {toolDefinition} from './tool-registry.js';
export const invokeSchema=z.object({id:z.string().min(1),input:z.object({value:z.string().max(6000).optional(),fileId:z.string().optional()}).strict().default({}),requestId:z.string().min(1).max(100)}).strict();
export class Orchestrator{
 executor=new BrowserExecutor(this);media=new MediaRunner(this);defaultMode:'legacy'|'compact'='legacy';
 markRecoverable(){this.recoverable=true;}
 task?:Task;capabilities:Capability[]=[];files=new Map<string,{id:string;path:string;name:string;size:number;mtime:number;digest:string}>();private externalTaskId?:string;
 private requests=new Map<string,Promise<any>>();private epoch=0;private leaseTimer:ReturnType<typeof setInterval>;
 private recoveryLevel=0;private recoverable=false;
 private presenter=new CapabilityPresenter();
 onTask?:(task:Task)=>Promise<void>;onCancel?:()=>void;
 constructor(public browser:BrowserPort,public adapter:AgentBrowser,public store:Store,public permissions:Permissions,public changed:()=>void){this.leaseTimer=setInterval(()=>{if(this.task&&this.task.expiresAt<Date.now())this.cancel('LEASE_EXPIRED');},1000);}
 update(){if(this.task){this.task.updatedAt=Date.now();this.store.task(this.task);}this.changed();}
 assert(taskId?:string){const t=this.task;if(!t||!['running','awaiting_approval'].includes(t.status)||t.expiresAt<Date.now()||(taskId&&t.id!==taskId))fail('LEASE_REQUIRED','활성 작업의 탭 제어 권한이 필요합니다.');const tab=this.browser.tab(t.tabId);if(this.browser.activeId()!==t.tabId)fail('TARGET_NOT_ACTIVE','작업 탭이 활성 상태가 아닙니다.');if(new URL(tab.url).origin!==t.origin)fail('ORIGIN_CHANGED','허용한 사이트가 변경되었습니다.');return t;}
 async start(prompt:string,tabId:string,model?:string,manual=false,external=false,continuation?:string,reasoningEffort?:'low'|'medium'|'high',taskApproval?:{allowUnknownCost:boolean;generationLimit:number;tabId?:string;origin?:string;fileIds?:string[]}){
  if(this.task)fail('PROFILE_BUSY','이 프로필에 이미 실행 중인 작업이 있습니다.');
  if(!prompt.trim())fail('INPUT_INVALID','작업 내용을 입력하세요.');const tab=this.browser.tab(tabId);if(this.browser.activeId()!==tabId)fail('TARGET_NOT_ACTIVE','작업할 탭을 앱에서 먼저 선택하세요.');if(await this.browser.authCheck(tabId))fail('AUTH_REQUIRED','로그인·인증을 직접 마치고 인증 보호를 해제하세요.');
  if(this.task)fail('PROFILE_BUSY','다른 작업이 먼저 시작되었습니다.');
  if(taskApproval&&(external||(taskApproval.tabId&&taskApproval.tabId!==tabId)||(taskApproval.origin&&taskApproval.origin!==new URL(tab.url).origin)||(taskApproval.fileIds&&JSON.stringify([...taskApproval.fileIds].sort())!==JSON.stringify([...this.files.keys()].sort()))))fail('APPROVAL_STALE','승인한 작업 대상 또는 파일이 변경되었습니다.');
  const isMedia=!!mediaSite(tab.url);
  const task:Task={id:randomUUID(),tabId,origin:new URL(tab.url).origin,prompt:prompt.slice(0,12000),status:external?'queued':'running',createdAt:Date.now(),updatedAt:Date.now(),expiresAt:Date.now()+15*60000,model:model||(isMedia?'gpt-6-luna':undefined),reasoningEffort:reasoningEffort||(isMedia?'high':undefined),executionMode:isMedia?'compact':this.defaultMode,continuation:continuation?.slice(0,2000)};this.task=task;this.externalTaskId=external?task.id:undefined;this.recoveryLevel=0;this.recoverable=false;this.presenter.reset();this.requests.clear();this.update();
  if(taskApproval){if(external)fail('APPROVAL_UI_ONLY','작업 전체 승인은 제품 UI에서만 가능합니다.');this.authorizeTask(task.id,taskApproval);}
  const begin=async()=>{if(this.task?.id!==task.id)return;task.status='running';this.update();if(!manual){try{await this.onTask?.(task);}catch(e){this.finish('failed',String((e as Error).message));}}};
  if(external){void this.permissions.ask({taskId:task.id,kind:'task',title:'외부 에이전트의 제어 요청',detail:`${safeUrl(tab.url)}\n${redact(task.prompt)}`,binding:hash([task.id,tabId,task.origin])}).then(allow=>{if(this.task?.id!==task.id)return;if(allow)void begin();else this.cancel('PERMISSION_DENIED');});}else if(!manual)void begin();
  return {...task};
 }
 authorizeTask(taskId:string,options:{allowUnknownCost:boolean;generationLimit:number}){const t=this.task;if(!t||t.id!==taskId||!['queued','running','awaiting_approval'].includes(t.status)||t.expiresAt<=Date.now())fail('TASK_NOT_FOUND','승인할 활성 작업이 없습니다.');const tab=this.browser.tab(t.tabId);if(tab.authPaused||this.browser.activeId()!==t.tabId||new URL(tab.url).origin!==t.origin)fail('TARGET_CHANGED','작업 대상 또는 인증 상태가 변경되었습니다.');const scope={...options,expiresAt:t.expiresAt,fileIds:[...this.files.keys()],usedGenerations:this.store.mediaJobs().filter(j=>j.taskId===taskId&&j.submittedAt).reduce((n,j)=>n+(j.submissions?.length||1),0)};this.store.event('approval.task.granted',{taskId,tabId:t.tabId,origin:t.origin,prompt:t.prompt,...scope});this.permissions.grantTask(taskId,scope);this.changed();}
 assertFileApproved(id:string){const scope=this.task&&this.permissions.taskGrant?.(this.task.id);if(scope&&!scope.fileIds.includes(id))fail('FILE_NOT_APPROVED','작업 전체 승인 이후 추가된 파일입니다. 새 작업에서 승인하세요.');}
 finish(status:'succeeded'|'failed',error?:string,output?:string){if(!this.task)return;if(this.media.busy())this.media.cancel(error||'TASK_FINISHED');this.task.status=status;this.task.error=error?redact(error):undefined;this.task.output=output?redact(output):undefined;this.update();this.permissions.cancel(this.task.id);this.task=undefined;this.epoch++;this.changed();}
 async reviewCompletion(output:string){const taskId=this.assert().id;if(this.media.active?.taskId===taskId){const job=this.media.busy()?await this.media.wait():this.media.active;if(this.task?.id!==taskId)return;output+='\n생성 실행 결과: '+JSON.stringify(job&&this.media.publicJob(job));if(job?.status!=='succeeded'){this.finish('failed',job?.error||'GENERATION_NOT_COMPLETED',output);return;}}const t=this.assert();if(this.permissions.taskGrant?.(taskId)){const media=this.media.active?.taskId===taskId&&this.media.active.status==='succeeded';const ops=this.store.db.prepare('SELECT body FROM operations WHERE taskId=?').all(taskId).map((r:any)=>JSON.parse(r.body));const verified=media||(ops.length>0&&ops.every((o:any)=>o.status==='verified'));this.finish(verified?'succeeded':'failed',verified?undefined:'RESULT_UNVERIFIED · 작업 실행은 끝났지만 완료 근거가 부족합니다.',output);return;}const epoch=this.epoch;t.status='awaiting_approval';t.output=redact(output).slice(0,12000);this.update();const count=this.store.artifacts().filter(a=>a.taskId===t.id&&a.status==='completed').length;const accepted=await this.permissions.ask({taskId:t.id,kind:'result',title:'작업 결과 확인',detail:`에이전트 응답이 끝났습니다. 사이트의 결과를 확인하고 완료 여부를 결정하세요.\n완료된 다운로드: ${count}개\n\n${t.output}\n\n응답 종료만으로 사이트 작업 성공을 판정하지 않습니다.`,binding:hash([t.id,t.output,count])});if(epoch!==this.epoch||this.task?.id!==t.id)return;this.finish(accepted?'succeeded':'failed',accepted?undefined:'RESULT_NOT_CONFIRMED',t.output);}
 cancel(reason='USER_CANCELLED'){if(!this.task)return;this.media.cancel(reason);const t=this.task;t.status='cancelled';t.error=reason;this.update();this.task=undefined;this.epoch++;this.permissions.cancel(t.id);this.adapter.cancel();this.onCancel?.();this.store.event('task.cancelled',{taskId:t.id,reason});this.changed();}
 addFile(file:string){const canonical=realpathSync(file);const s=statSync(canonical);if(!s.isFile()||s.size>100*1024*1024)fail('FILE_INVALID','100MB 이하의 파일을 선택하세요.');const item={id:randomUUID(),path:canonical,name:basename(canonical),size:s.size,mtime:s.mtimeMs,digest:createHash('sha256').update(readFileSync(canonical)).digest('hex')};this.files.set(item.id,item);this.changed();return {id:item.id,name:item.name,size:item.size};}
 async list(tabId:string){const tab=this.browser.tab(tabId);if(await this.browser.authCheck(tabId))fail('AUTH_REQUIRED','인증 화면의 관측을 중단했습니다.');const rev=tab.revision;const target=await this.browser.target(tabId);const started=Date.now();const snapshot=await this.adapter.snapshot(target);if(this.browser.tab(tabId).revision!==rev)fail('STALE_TARGET','이동한 화면에서 다시 기능을 조회하세요.');const next=discover({...tab},snapshot);const fp=fingerprint(snapshot);for(const field of await this.browser.fileFields(tabId)){next.push({id:hash([tabId,rev,fp,field.selector]).slice(0,24),tabId,origin:new URL(tab.url).origin,revision:rev,fingerprint:fp,ref:field.selector,role:'file',name:field.name,action:'upload',reviewed:false,version:1,approval:'required',inputSchema:{type:'object',properties:{fileId:{type:'string'}},required:['fileId'],additionalProperties:false},successSignals:['브라우저 파일 선택 완료']});}
  const prior=new Set(this.capabilities.filter(c=>c.reviewed).map(c=>c.id));next.forEach(c=>{c.reviewed=prior.has(c.id);});this.capabilities=next;this.store.event('capabilities.discovered',{tabId,count:next.length,fingerprint:fp,snapshotBytes:Buffer.byteLength(snapshot.snapshot||''),contractBytes:Buffer.byteLength(JSON.stringify(next)),wallMs:Date.now()-started});this.changed();return next;
 }
 invoke(raw:unknown,manual=false):Promise<any>{const args=invokeSchema.parse(raw);args.id=this.presenter.resolve(args.id);const task=this.assert();const key=task.id+':'+args.requestId;const existing=this.requests.get(key);if(existing)return existing;const result=this.execute(args,manual).catch(e=>{if(this.task?.id===task.id)this.recoverable=true;throw e;});this.requests.set(key,result);return result;}
 private async execute(args:z.infer<typeof invokeSchema>,manual:boolean){
  const t=this.assert();const epoch=this.epoch;const cap=this.capabilities.find(c=>c.id===args.id);if(!cap||cap.tabId!==t.tabId)fail('CAPABILITY_NOT_FOUND','현재 작업 탭의 기능을 먼저 조회하세요.');
  if(this.capabilities.filter(c=>c.role===cap.role&&c.name===cap.name&&c.action===cap.action).length>1)fail('AMBIGUOUS_TARGET','같은 이름의 기능이 여러 개입니다. 페이지에서 대상을 구분한 후 다시 조회하세요.');
  const permitted=cap.action==='upload'?['fileId']:['fill','select'].includes(cap.action)?['value']:[];if(Object.keys(args.input).some(k=>!permitted.includes(k)))fail('INPUT_INVALID','이 기능의 입력 스키마에 없는 값입니다.');
  if(['fill','select'].includes(cap.action)&&typeof args.input.value!=='string')fail('INPUT_INVALID','입력값이 필요합니다.');
  if(cap.action==='upload')this.assertFileApproved(args.input.fileId||'');const file=cap.action==='upload'?this.files.get(args.input.fileId||''):undefined;if(cap.action==='upload'&&!file)fail('FILE_NOT_ALLOWED','사용자가 선택한 파일 ID만 업로드할 수 있습니다.');
  const binding=hash([t.id,cap,args.input]);t.status='awaiting_approval';this.update();const approved=await this.permissions.ask({taskId:t.id,kind:cap.action,title:`${cap.reviewed?'실행 승인':'기능 검토 및 1회 실행 승인'} · ${cap.name}`,detail:`대상: ${safeUrl(this.browser.tab(t.tabId).url)}\n행동: ${cap.action}\n${file?'파일: '+file.name:args.input.value!==undefined?'입력: '+redact(args.input.value):'클릭은 생성·게시·결제를 유발할 수 있습니다. 현재 페이지의 내용을 확인하세요.'}\n이 입력과 현재 화면에만 유효한 1회 승인입니다.`,binding});
  if(epoch!==this.epoch)fail('CANCELLED','작업 취소됨');if(!approved){t.status='running';this.update();if(manual)this.finish('failed','PERMISSION_DENIED');fail('PERMISSION_DENIED','사용자가 실행을 승인하지 않았습니다.');}
  t.status='running';this.update();this.assert(t.id);if(await this.browser.authCheck(t.tabId))fail('AUTH_REQUIRED','인증 화면에서는 에이전트 작업이 금지됩니다.');const tab=this.browser.tab(t.tabId);if(tab.revision!==cap.revision||new URL(tab.url).origin!==cap.origin)fail('STALE_TARGET','승인 이후 페이지가 변경되었습니다.');
  if(file){const canonical=realpathSync(file.path);const s=statSync(canonical);if(canonical!==file.path||s.size!==file.size||s.mtimeMs!==file.mtime||createHash('sha256').update(readFileSync(canonical)).digest('hex')!==file.digest)fail('FILE_CHANGED','파일이 변경되었습니다. 다시 선택하세요.');if(!(await this.browser.fileFields(t.tabId)).some(f=>f.selector===cap.ref&&f.name===cap.name))fail('STALE_CONTRACT','업로드 입력이 변경되었습니다. 다시 확인하세요.');}
  const target=await this.browser.target(t.tabId);const before=Date.now();
  try {const outcome=await this.adapter.target(target,async command=>{
   const fresh=await command(['snapshot','-i','-c']);if(fingerprint(fresh)!==cap.fingerprint)fail('STALE_CONTRACT','화면 구성이 바뀌었습니다. 기능을 다시 조회하고 승인하세요.');
   this.assert(t.id);if(epoch!==this.epoch||this.browser.tab(t.tabId).revision!==cap.revision)fail('CANCELLED','대상이 변경되었습니다.');cap.reviewed=true;this.store.contract(cap);this.store.event('approval.consumed',{taskId:t.id,binding,capabilityId:cap.id});
   const selector=cap.action==='upload'?cap.ref:'@'+cap.ref;
   const commandArgs=cap.action==='fill'?['fill',selector,args.input.value!]:cap.action==='select'?['select',selector,args.input.value!]:cap.action==='upload'?['upload',selector,file!.path]:[cap.action,selector];
   await command(commandArgs);return {execution:'acknowledged',capabilityId:cap.id,action:cap.action,success:'브라우저 명령 완료. 사이트의 최종 결과는 다시 확인해야 합니다.'};
  });if(epoch!==this.epoch)fail('CANCELLED','작업 취소됨');this.store.event('capability.executed',{taskId:t.id,capabilityId:cap.id,wallMs:Date.now()-before});if(manual)this.finish('succeeded');this.changed();return outcome;
  }catch(error){this.store.event('capability.failed',{taskId:t.id,code:(error as AppError).code||'UNKNOWN',message:redact((error as Error).message)});if(manual||['TIMEOUT_UNKNOWN','BROWSER_UNAVAILABLE','BROWSER_ERROR'].includes((error as AppError).code))this.finish('failed','실행 결과 확인 필요: '+(error as Error).message);throw error;}
 }
 async tool(name:string,args:any={},taskId?:string):Promise<any>{
  const def=toolDefinition(name);if(!def)fail('TOOL_DENIED','허용되지 않은 도구입니다.');if(taskId)this.assert(taskId);if(!taskId&&this.task&&this.task.id!==this.externalTaskId&&def.owner)fail('OWNER_MISMATCH','앱 내부 작업의 제어권을 외부 에이전트가 사용할 수 없습니다.');
  if(this.executor.busy&&name!=='browser.execute'&&!['tasks.status','tasks.cancel','sessions.list','tabs.list'].includes(name))fail('EXECUTOR_BUSY','작업 묶음 실행 중입니다.');
  if(this.media.busy()&&!['browser.execute','browser.observe','tasks.status','tasks.cancel','tabs.list','sessions.list'].includes(name))fail('EXECUTOR_BUSY','생성 작업이 실행 중입니다.');
  if(name==='browser.observe'){const media=await this.media.observe();return media?{...media,files:[...this.files.values()].map(({id,name})=>({id,name}))}:this.executor.observe(args);}
  if(name==='browser.execute'){if(args.workflow==='media.generate')return this.media.execute(args);if(this.media.busy())fail('EXECUTOR_BUSY','생성 작업 실행 중');if(mediaSite(this.browser.tab(this.assert().tabId).url))fail('WORKFLOW_REQUIRED','이 생성 화면은 media.generate 작업을 사용하세요.');return this.executor.execute(args);}
  if(name==='browser.recover')return this.tool('page.inspect',args,taskId);
  if(name==='sessions.list')return [{id:'default',owner:this.task?'agent':'human',activeTaskId:this.task?.id}];
  if(name==='tabs.list')return this.browser.tabs().map(t=>({id:t.id,title:redact(t.title),url:safeUrl(t.url),authPaused:t.authPaused}));
  if(name==='tasks.start'){const p=z.object({prompt:z.string().min(1).max(12000),tabId:z.string(),model:z.string().optional(),reasoningEffort:z.enum(['low','medium','high']).optional()}).strict().parse(args);return this.start(p.prompt,p.tabId,p.model,true,true,undefined,p.reasoningEffort);}
  if(name==='tasks.status')return this.task?{...this.task,mediaJob:this.media.active?.taskId===this.task.id?this.media.publicJob(this.media.active):undefined,prompt:redact(this.task.prompt)}:this.store.tasks()[0]||null;
  if(name==='tasks.cancel'){this.cancel();return {cancelled:true};}
  if(name==='artifacts.list')return this.store.artifacts().filter(a=>!taskId||a.taskId===taskId).map(({path,...rest})=>rest);
  const task=this.assert(taskId);
  if(name==='capabilities.find'){
   const input=z.object({query:z.string().trim().min(1).max(100),action:z.enum(['click','fill','select','check','upload']).optional(),limit:z.number().int().min(1).max(12).default(6)}).strict().parse(args);const caps=await this.list(task.tabId);const aliases=this.presenter.refresh(caps);const ranked=rankCapabilities(caps,input.query,input.action);return {untrusted:true,tabId:task.tabId,origin:task.origin,matches:ranked.length,candidates:ranked.slice(0,input.limit).map(({cap})=>({id:aliases.find(a=>a.cap.id===cap.id)!.id,name:cap.name,action:cap.action,ambiguous:caps.filter(c=>c.name===cap.name&&c.role===cap.role&&c.action===cap.action).length>1})),next:'Inspect a unique candidate before invocation. No match is not permission to guess.'};
  }
  if(name==='capabilities.inspect'){
   const input=z.object({id:z.string().min(1).max(100)}).strict().parse(args);const caps=await this.list(task.tabId);this.presenter.refresh(caps);const cap=caps.find(c=>c.id===this.presenter.resolve(input.id));if(!cap)fail('STALE_CONTRACT','대상을 다시 검색하세요.');return {untrusted:true,id:input.id,name:cap.name,role:cap.role,action:cap.action,origin:cap.origin,revision:cap.revision,inputSchema:cap.inputSchema,ambiguous:caps.filter(c=>c.name===cap.name&&c.role===cap.role&&c.action===cap.action).length>1,approval:'One-time HONMOON UI approval required; never retry an unknown outcome.',verification:'Invocation acknowledgement is not task success. Inspect state or artifacts after the action.'};
  }
  if(name==='capabilities.list'){const caps=await this.list(task.tabId);return this.presenter.present(caps,{tabId:task.tabId,origin:task.origin,revision:this.browser.tab(task.tabId).revision},[...this.files.values()].map(({id,name,size})=>({id,name,size})));}
  if(name==='capabilities.invoke'){if(mediaSite(this.browser.tab(task.tabId).url))fail('WORKFLOW_REQUIRED','생성 사이트는 compact media.generate 작업으로 실행하세요.');return this.invoke(args);}
  if(name==='page.inspect'){
   const {level}=z.object({level:z.enum(['accessibility','dom','screenshot'])}).strict().parse(args);const stage=['accessibility','dom','screenshot'].indexOf(level)+1;
   if(!this.recoverable||stage>this.recoveryLevel+1)fail('RECOVERY_ORDER','실행 실패 이후 접근성 → 제한 DOM → 화면 순서로 확인하세요.');
   if(await this.browser.authCheck(task.tabId))fail('AUTH_REQUIRED','인증 관측 중단');const revision=this.browser.tab(task.tabId).revision;const epoch=this.epoch;task.status='awaiting_approval';this.update();
   const allow=await this.permissions.ask({taskId:task.id,kind:'recovery',title:`실패 복구 관측 · ${level}`,detail:`${safeUrl(this.browser.tab(task.tabId).url)}\n${level==='screenshot'?'현재 보이는 웹페이지 이미지를 에이전트에 전달합니다. 화면의 개인정보를 확인하세요.':level==='dom'?'최대 60개 요소의 태그·역할·이름·비활성 상태만 전달합니다. 입력값과 전체 HTML은 제외합니다.':'현재 페이지의 접근성 역할과 이름 최대 100개를 전달합니다.'}\n관측만 수행하며 동작을 재실행하지 않습니다.`,binding:hash([task.id,revision,level])});
   if(epoch!==this.epoch)fail('CANCELLED','복구 관측 취소');this.assert(task.id);task.status='running';this.update();if(!allow)fail('PERMISSION_DENIED','복구 관측 거절');if(revision!==this.browser.tab(task.tabId).revision||await this.browser.authCheck(task.tabId))fail('STALE_TARGET','화면 변경 또는 인증 보호');
   const target=await this.browser.target(task.tabId);let result:any;
   if(level==='accessibility'){const snapshot=await this.adapter.target(target,c=>c(['snapshot','-i','-c']));result={untrusted:true,level,elements:Object.values(snapshot.refs||{}).slice(0,100).map((e:any)=>({role:e.role,name:redact(String(e.name||'')).slice(0,180)}))};}
   else if(level==='dom')result={untrusted:true,level,dom:redact(await this.browser.limitedDom(task.tabId)).slice(0,8000)};
   else result={untrusted:true,level,imageData:await this.browser.screenshot(task.tabId),mimeType:'image/jpeg'};
   this.assert(task.id);if(epoch!==this.epoch||revision!==this.browser.tab(task.tabId).revision||await this.browser.authCheck(task.tabId))fail('STALE_TARGET','관측 중 화면 변경');this.recoveryLevel=Math.max(this.recoveryLevel,stage);this.store.event('recovery.observed',{taskId:task.id,level});return result;
  }
  if(name==='page.read'){
   if(await this.browser.authCheck(task.tabId))fail('AUTH_REQUIRED','인증 관측 중단');const revision=this.browser.tab(task.tabId).revision;task.status='awaiting_approval';this.update();const epoch=this.epoch;const allow=await this.permissions.ask({taskId:task.id,kind:'read',title:'페이지 텍스트를 에이전트에 전달',detail:`${safeUrl(this.browser.tab(task.tabId).url)}\n현재 페이지의 표시 텍스트 최대 8,000자를 전달합니다.`,binding:hash([task.id,task.tabId,revision])});if(epoch!==this.epoch)fail('CANCELLED','페이지 전달이 취소되었습니다.');this.assert(task.id);task.status='running';this.update();if(!allow)fail('PERMISSION_DENIED','페이지 전달이 거절되었습니다.');if(this.browser.tab(task.tabId).revision!==revision)fail('STALE_TARGET','승인 이후 화면이 변경되었습니다.');if(await this.browser.authCheck(task.tabId))fail('AUTH_REQUIRED','인증 관측 중단');const text=await this.browser.pageText(task.tabId);this.assert(task.id);if(epoch!==this.epoch||this.browser.tab(task.tabId).revision!==revision)fail('STALE_TARGET','조회 중 화면이 변경되었습니다.');return {untrusted:true,text:redact(text).slice(0,8000)};
  }
  if(name==='tasks.finish'){if(args.success===true)await this.reviewCompletion(String(args.summary||''));else this.finish('failed','AGENT_REPORTED_FAILURE',String(args.summary||''));return {finished:true};}
  fail('TOOL_DENIED','허용되지 않은 도구입니다.');
 }
 dispose(){clearInterval(this.leaseTimer);this.cancel('APP_CLOSED');}
}
