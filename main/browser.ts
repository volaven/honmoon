import {BrowserWindow,WebContentsView,session,ipcMain,type Session,type WebContents} from 'electron';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {fail,type BrowserPort,type TabInfo} from '../packages/core/types.js';
import {scrollbarTheme} from './theme.js';
import {readMediaDom} from './media-page.js';
import {mediaRules,mediaSite} from '../packages/core/media-contract.js';
import type {Permissions} from '../packages/core/permissions.js';
export function normalizeUrl(text:string){const value=text.trim();const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(value)?value:'https://'+value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('URL_DENIED','http 또는 https 주소만 사용할 수 있습니다.');return url.href;}
export class Browser implements BrowserPort{
 views=new Map<string,{view:WebContentsView;info:TabInfo}>();session:Session;active='';bounds={x:70,y:102,width:900,height:700};hidden=false;private layoutAt=Date.now();
 onNavigation?:(id:string,url:string)=>boolean;onClosed?:(id:string)=>void;
 private guard?:WebContentsView;private locked=false;onHandoff?:()=>void;
 constructor(public window:BrowserWindow,private change:()=>void,public permissions:Permissions){
  this.session=session.fromPartition('persist:honmoon-default');
  this.session.setPermissionCheckHandler(()=>false);
  this.session.setPermissionRequestHandler((wc,permission,callback,details)=>{const tab=[...this.views.values()].find(t=>t.view.webContents.id===wc?.id);if(!tab){callback(false);return;}void this.permissions.ask({kind:'web-permission',title:`웹사이트 권한 · ${permission}`,detail:`${new URL(tab.info.url).origin}\n요청: ${permission}`,binding:tab.info.id+permission}).then(callback);});
  this.guard=new WebContentsView({webPreferences:{preload:fileURLToPath(new URL('./guard.cjs',import.meta.url)),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  this.guard.setBackgroundColor('#00000000');this.window.contentView.addChildView(this.guard);this.guard.setVisible(false);
  void this.guard.webContents.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>html,body{margin:0;width:100%;height:100%;background:transparent;cursor:pointer}p{position:fixed;right:18px;bottom:18px;padding:12px 18px;background:#190d28ed;color:#ffd5ee;border:1px solid #a364d5;border-radius:8px;font:13px system-ui;pointer-events:none}</style><p>에이전트 제어 중 · 페이지를 클릭하면 중지하고 제어권을 회수합니다</p>'));
  ipcMain.on('honmoon:handoff',event=>{if(event.sender.id===this.guard?.webContents.id&&this.locked)this.onHandoff?.();});
 }
 setLocked(locked:boolean){if(this.locked===locked)return;this.locked=locked;this.layoutGuard();if(locked)this.window.webContents.focus();}
 private layoutGuard(){if(!this.guard||this.window.isDestroyed())return;this.window.contentView.addChildView(this.guard);this.guard.setBounds(this.bounds);this.guard.setVisible(this.locked&&!this.hidden);}
 tabs(){return [...this.views.values()].map(t=>({...t.info}));}tab(id:string){const item=this.views.get(id);if(!item)fail('STALE_TARGET','닫힌 탭입니다.');return item.info;}activeId(){return this.active;}
 async create(url:string,authPaused=false){url=normalizeUrl(url);const id=randomUUID();const view=new WebContentsView({webPreferences:{session:this.session,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,webSecurity:true,allowRunningInsecureContent:false}});const info:TabInfo={id,targetId:'',url,title:'새 탭',revision:0,authPaused,loading:true};this.views.set(id,{view,info});this.window.contentView.addChildView(view);this.activate(id);const wc=view.webContents;wc.on('before-input-event',(event,input)=>{if(this.locked&&input.type==='keyDown'){event.preventDefault();this.onHandoff?.();}});
  wc.setWindowOpenHandler(({url})=>{try{normalizeUrl(url);if(this.onNavigation&&!this.onNavigation(id,url))return {action:'deny'};if(this.locked)this.onHandoff?.();void this.create(url);}catch{}return {action:'deny'};});
  wc.on('will-navigate',(event,url)=>{try{normalizeUrl(url);if(this.onNavigation&&!this.onNavigation(id,url))event.preventDefault();}catch{event.preventDefault();}});
  wc.on('will-redirect',(event,url)=>{try{normalizeUrl(url);if(this.onNavigation&&!this.onNavigation(id,url))event.preventDefault();}catch{event.preventDefault();}});
  wc.on('did-finish-load',()=>{void wc.insertCSS(scrollbarTheme,{cssOrigin:'user'}).catch(()=>{});});
  wc.on('did-start-loading',()=>{info.loading=true;this.change();});wc.on('did-stop-loading',()=>{info.loading=false;this.change();});
  wc.on('did-navigate',(_e,url)=>{info.url=url;info.revision++;this.change();});wc.on('did-navigate-in-page',(_e,url,isMain)=>{if(isMain){info.url=url;info.revision++;this.change();}});wc.on('page-title-updated',(_e,title)=>{info.title=title;this.change();});wc.on('render-process-gone',()=>{this.onClosed?.(id);info.title='탭 프로세스 종료 · 새로고침 필요';this.change();});
  try{await wc.loadURL(url);}catch{info.title='페이지를 열지 못했습니다.';}this.change();return info;
 }
 activate(id:string){this.tab(id);this.active=id;for(const [key,{view}] of this.views){view.setVisible(!this.hidden&&key===id);if(key===id)view.setBounds(this.bounds);}this.layoutGuard();this.change();}
 setBounds(bounds:{x:number;y:number;width:number;height:number},hidden=false){this.layoutAt=Date.now();this.bounds={x:Math.max(0,Math.round(bounds.x)),y:Math.max(0,Math.round(bounds.y)),width:Math.max(1,Math.round(bounds.width)),height:Math.max(1,Math.round(bounds.height))};this.hidden=hidden;for(const [id,{view}] of this.views){view.setBounds(this.bounds);view.setVisible(!hidden&&id===this.active);}this.layoutGuard();}
 async navigate(id:string,url:string){await this.views.get(id)!.view.webContents.loadURL(normalizeUrl(url));}
 close(id:string){const item=this.views.get(id);if(!item)return;this.onClosed?.(id);if(!this.window.isDestroyed())this.window.contentView.removeChildView(item.view);if(!item.view.webContents.isDestroyed())item.view.webContents.close();this.views.delete(id);if(this.active===id){this.active=this.views.keys().next().value||'';if(this.active)this.activate(this.active);}this.change();}
 async target(id:string){await this.wait(100);const deadline=Date.now()+4000;while(this.hidden||Date.now()-this.layoutAt<180){if(Date.now()>deadline)fail('VIEW_NOT_READY','대화상자를 닫고 웹페이지가 보이는 상태에서 다시 실행하세요.');await this.wait(50);}const item=this.views.get(id);if(!item)fail('STALE_TARGET','대상 탭 없음');const wc=item.view.webContents;if(this.window.isMinimized())this.window.restore();this.window.show();this.window.focus();wc.focus();await this.wait(100);const attached=wc.debugger.isAttached();if(!attached)wc.debugger.attach('1.3');try{const r=await wc.debugger.sendCommand('Target.getTargetInfo');item.info.targetId=r.targetInfo.targetId;return item.info.targetId;}finally{if(!attached)wc.debugger.detach();}}
 async authCheck(id:string){const item=this.views.get(id);if(!item)return true;if(item.info.authPaused)return true;const u=new URL(item.info.url);if(/(^|\.)(accounts\.google\.com|auth\.openai\.com)$/.test(u.hostname)||/\/(login|signin|sign-in|oauth|challenge|captcha|2fa)(\/|$)/i.test(u.pathname))return true;return item.view.webContents.executeJavaScript(`Boolean([...document.querySelectorAll('input[type="password"],input[autocomplete="one-time-code"],iframe[src*="recaptcha"],iframe[src*="challenges.cloudflare"]')].some(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height))`);}
 async pageText(id:string){const item=this.views.get(id)!;return item.view.webContents.executeJavaScript(`(()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node,out='';while((node=walker.nextNode())&&out.length<200000){const p=node.parentElement;if(!p||p.closest('script,style,input,textarea,[contenteditable="true"],[hidden],[aria-hidden="true"]')||!p.getClientRects().length||getComputedStyle(p).visibility==='hidden')continue;const text=node.textContent.trim();if(text)out+=text+'\\n';}return out;})()`);}
 async limitedDom(id:string){return this.views.get(id)!.view.webContents.executeJavaScript(`JSON.stringify(Array.from(document.querySelectorAll('button,a,input,textarea,select,[role]')).filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).slice(0,60).map(e=>({tag:e.tagName,role:e.getAttribute('role'),type:e.getAttribute('type'),label:(e.getAttribute('aria-label')||e.labels?.[0]?.textContent||(!['INPUT','TEXTAREA'].includes(e.tagName)?e.textContent:'' )||'').slice(0,120),disabled:e.disabled===true})))`);}
 async screenshot(id:string){const wc=this.views.get(id)!.view.webContents;const img=await wc.capturePage();return img.resize({width:Math.min(img.getSize().width,1400)}).toJPEG(70).toString('base64');}
 async fileFields(id:string){return this.views.get(id)!.view.webContents.executeJavaScript(`Array.from(document.querySelectorAll('input[type="file"]')).map(e=>{let n=e;const parts=[];while(n&&n.nodeType===1){const tag=n.tagName.toLowerCase();const siblings=Array.from(n.parentElement?.children||[]).filter(x=>x.tagName===n.tagName);parts.unshift(tag+':nth-of-type('+Math.max(1,siblings.indexOf(n)+1)+')');n=n.parentElement;}return {name:e.getAttribute('aria-label')||e.labels?.[0]?.innerText||'파일 선택',selector:parts.join(' > ')};})`);}
 async chooseApprovedFile(id:string,path:string,trigger:()=>Promise<void>,check:()=>Promise<void>){
  const wc=this.views.get(id)!.view.webContents;const dbg=wc.debugger;const attached=dbg.isAttached();if(!attached)dbg.attach('1.3');let timer:ReturnType<typeof setTimeout>|undefined;let handler:any;
  try{await check();const frame=(await dbg.sendCommand('Page.getFrameTree')).frameTree.frame.id;await dbg.sendCommand('Page.enable');await dbg.sendCommand('Page.setInterceptFileChooserDialog',{enabled:true});
   const chosen=new Promise<void>((resolve,reject)=>{let used=false;timer=setTimeout(()=>reject(new Error('파일 선택기 응답 시간 초과')),15000);handler=(_event:unknown,method:string,params:any)=>{if(method!=='Page.fileChooserOpened'||used)return;used=true;void(async()=>{await check();if(params.frameId!==frame||!params.backendNodeId)fail('UPLOAD_TARGET_INVALID','승인한 문서의 파일 선택기가 아닙니다.');await dbg.sendCommand('DOM.setFileInputFiles',{files:[path],backendNodeId:params.backendNodeId});resolve();})().catch(reject);};dbg.on('message',handler);});
   // Register the rejection handler before the trigger can fail.
   await Promise.all([chosen,trigger()]);await check();
  }finally{clearTimeout(timer);if(handler)dbg.removeListener('message',handler);try{await dbg.sendCommand('Page.setInterceptFileChooserDialog',{enabled:false});}catch{}if(!attached&&dbg.isAttached())dbg.detach();}
 }
 async mediaPage(id:string){const site=mediaSite(this.tab(id).url);if(!site)return;return this.views.get(id)!.view.webContents.executeJavaScriptInIsolatedWorld(942,[{code:`(${readMediaDom.toString()})(${JSON.stringify({site,rule:mediaRules[site]})})`}]);}
 async controls(id:string){const wc=this.views.get(id)!.view.webContents;return wc.executeJavaScriptInIsolatedWorld(941,[{code:`(()=>{
 const cache=globalThis.__honmoonIdentity||(globalThis.__honmoonIdentity={ids:new WeakMap(),next:0});
 return [...document.querySelectorAll('input,textarea,select,button,a,[role]')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!['password','hidden'].includes(e.type)&&e.autocomplete!=='one-time-code').slice(0,500).map(e=>{
 if(!cache.ids.has(e))cache.ids.set(e,String(++cache.next));
 const role=e.getAttribute('role')||({BUTTON:'button',A:'link',TEXTAREA:'textbox',SELECT:'combobox'}[e.tagName])||(e.tagName==='INPUT'?({checkbox:'checkbox',search:'searchbox',file:'file',button:'button',submit:'button'}[e.type]||'textbox'):'');
 const labelled=(e.getAttribute('aria-labelledby')||'').split(/\\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
 const name=(e.getAttribute('aria-label')||labelled||e.labels?.[0]?.textContent||(['BUTTON','A'].includes(e.tagName)||e.getAttribute('role')?e.textContent:'')||'').trim();
 return {key:cache.ids.get(e),role,name,value:String(e.type==='checkbox'?e.checked:e.value||''),options:e.tagName==='SELECT'?[...e.options].map(o=>o.label):[],disabled:!!e.disabled||!!e.readOnly||e.getAttribute('aria-disabled')==='true',href:e.href||'',type:e.type||''};});})()`}]);}
 wait(ms:number){return new Promise<void>(resolve=>setTimeout(resolve,ms));}
 dispose(){for(const id of [...this.views.keys()])this.close(id);if(this.guard&&!this.guard.webContents.isDestroyed())this.guard.webContents.close();}
}
