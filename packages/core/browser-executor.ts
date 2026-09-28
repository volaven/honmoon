import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import type {Orchestrator} from './orchestrator.js';
import {executeSchema,observeSchema,type ExecutionPlan} from './browser-contract.js';
import {fail,type Capability,type ControlState} from './types.js';
import {hash} from '../capabilities/index.js';
import {redact,safeUrl} from './store.js';
type Bound={id:string;cap:Capability;dom?:ControlState;identity:string};
export class BrowserExecutor{
 private taskId='';private serial=0;private aliases=new Map<string,string>();private last=new Map<string,Bound>();private sent=new Map<string,string>();private state='';private query='';
 private requests=new Map<string,{digest:string;promise:Promise<any>}>();busy=false;private unknown=false;
 constructor(private core:Orchestrator){}
 private sync(){const task=this.core.assert();this.core.adapter.optimized=true;if(task.id!==this.taskId){this.taskId=task.id;this.aliases.clear();this.last.clear();this.sent.clear();this.requests.clear();this.state='';this.serial=0;this.unknown=false;this.query='';}return task;}
 private async guard(id:string,revision?:number){const task=this.core.assert(id);if(await this.core.browser.authCheck(task.tabId))fail('AUTH_REQUIRED','인증 화면에서는 중단합니다.');this.core.assert(id);if(revision!==undefined&&this.core.browser.tab(task.tabId).revision!==revision)fail('STALE_TARGET','문서가 변경되었습니다.');return task;}
 private async capture(){const task=this.sync();await this.guard(task.id);const revision=this.core.browser.tab(task.tabId).revision;
  const caps=await this.core.list(task.tabId);const controls=await this.core.browser.controls?.(task.tabId)||[];await this.guard(task.id,revision);
  const rows=caps.map(cap=>{const matches=controls.filter(d=>d.role===cap.role&&d.name===cap.name);const dom=matches.length===1?matches[0]:undefined;const identity=dom?`${revision}:${dom.key}`:`unsupported:${cap.id}`;const key=identity+':'+cap.action;let id=this.aliases.get(key);if(!id){id='b'+(++this.serial);this.aliases.set(key,id);}return {id,cap,dom,identity};});
  rows.sort((a,b)=>a.identity.localeCompare(b.identity)||a.cap.action.localeCompare(b.cap.action));this.last=new Map(rows.map(r=>[r.id,r]));const textDigest=hash((await this.core.browser.pageText(task.tabId)).slice(0,200000));await this.guard(task.id,revision);this.state=hash([task.id,task.tabId,revision,textDigest,rows.map(r=>[r.identity,r.cap.name,r.cap.action,r.dom])]).slice(0,16);return rows;
 }
 private publicRow(r:Bound){return {id:r.id,name:r.cap.name,action:r.cap.action,...(['fill','select'].includes(r.cap.action)?{input:'value'}:r.cap.action==='upload'?{input:'fileId'}:{}),...(r.dom?.options.length?{options:r.dom.options.slice(0,50)}:{}),...(!r.dom||r.dom.disabled?{unavailable:true}:{}),...(this.ambiguous(r)?{ambiguous:true}:{})};}
 private ambiguous(r:Bound){return [...this.last.values()].filter(x=>x.cap.role===r.cap.role&&x.cap.name===r.cap.name&&x.cap.action===r.cap.action).length!==1;}
 private delta(rows:Bound[],full=false){const items=rows.map(r=>this.publicRow(r));const next=new Map(items.map(r=>[r.id,JSON.stringify(r)]));const changed=items.filter(r=>this.sent.get(r.id)!==JSON.stringify(r));const removed=[...this.sent.keys()].filter(id=>!next.has(id));this.sent=next;return full?{controls:items}:changed.length||removed.length?{changed,removed}:{unchanged:true};}
 async observe(raw:unknown){if(this.busy)fail('EXECUTOR_BUSY','묶음 실행 중입니다.');const input=observeSchema.parse(raw);const task=this.sync();const full=!this.state||this.query!==(input.query||'');const rows=await this.capture();this.query=input.query||'';const relevant=rows.filter(r=>!input.query||r.cap.name.toLocaleLowerCase().includes(input.query.toLocaleLowerCase()));return {state:this.state,...this.delta(relevant.slice(0,input.limit),full),total:relevant.length,truncated:relevant.length>input.limit,files:[...this.core.files.values()].map(({id,name})=>({id,name}))};}
 private resolve(target:ExecutionPlan['steps'][number]['target'],rows=[...this.last.values()]):Bound{
  const matches=typeof target==='string'?rows.filter(r=>r.id===target):rows.filter(r=>r.cap.name===target.name&&r.cap.action===target.action);
  if(matches.length!==1)fail(matches.length?'AMBIGUOUS_TARGET':'TARGET_NOT_FOUND','대상이 없거나 여러 개입니다.');const r=matches[0];if(this.ambiguous(r))fail('AMBIGUOUS_TARGET','같은 이름의 기능이 여러 개입니다.');if(!r.dom||r.dom.disabled)fail('TARGET_UNAVAILABLE','현재 조작할 수 없는 대상입니다.');return r;
 }
 private signature(r:Bound){return hash([r.identity,r.cap.role,r.cap.name,r.cap.action,r.dom?.disabled,r.dom?.options,r.dom?.href,r.dom?.type]);}
 private file(id?:string){this.core.assertFileApproved(id||'');const f=this.core.files.get(id||'');if(!f)fail('FILE_NOT_ALLOWED','사용자가 선택한 파일 ID가 필요합니다.');const canonical=realpathSync(f.path),s=statSync(canonical);if(canonical!==f.path||s.size!==f.size||s.mtimeMs!==f.mtime||createHash('sha256').update(readFileSync(canonical)).digest('hex')!==f.digest)fail('FILE_CHANGED','파일이 변경되었습니다.');return f;}
 execute(raw:unknown){const p=executeSchema.parse(raw),task=this.sync(),digest=hash(p),existing=this.requests.get(p.requestId);if(existing){if(existing.digest!==digest)fail('REQUEST_ID_REUSED','동일 키에 다른 계획을 사용할 수 없습니다.');return existing.promise;}if(this.busy)fail('EXECUTOR_BUSY','다른 묶음이 실행 중입니다.');if(this.unknown)fail('OUTCOME_UNKNOWN','불명확한 실행 결과를 사람이 먼저 확인해야 합니다.');if(p.state!==this.state)fail('STALE_STATE','현재 상태를 다시 관측하세요.');
  this.busy=true;const promise=this.run(p,task.id,digest).finally(()=>{this.busy=false;});this.requests.set(p.requestId,{digest,promise});return promise;
 }
 private async run(p:ExecutionPlan,taskId:string,digest:string){
  const started=Date.now(),deadline=started+120000;const task=this.core.assert(taskId);const revision=this.core.browser.tab(task.tabId).revision;const expected=new Map(this.last);const written=new Map<string,string>();const receipts:any[]=[];const evidence:any[]=[];let inFlight=false,stepIndex=0;let timedOut=false;
  const result:any={requestId:p.requestId,status:'stopped',completed:receipts,evidence,artifacts:[]};
  const checkpoint=()=>this.core.store.operation(taskId,p.requestId,{digest,started,status:inFlight?'in_flight':'running',completed:receipts});
  const timer=setTimeout(()=>{timedOut=true;this.core.adapter.cancel();this.core.permissions.cancel(taskId);},120000);
  const check=async()=>{if(timedOut||Date.now()>=deadline)fail('TIMEOUT_UNKNOWN','묶음 실행 제한 시간을 초과했습니다.');await this.guard(taskId,revision);};
  const approve=async(kind:string,title:string,detail:string,binding:string)=>{await check();task.status='awaiting_approval';this.core.update();const allowed=await this.core.permissions.ask({taskId,kind,title,detail,binding});await check();task.status='running';this.core.update();if(!allowed)fail('PERMISSION_DENIED','승인이 거절되었습니다.');this.core.store.event('approval.consumed',{taskId,binding,kind});};
  try{
   await check();await this.capture();if(this.state!==p.state)fail('STALE_STATE','관측 후 화면이 변경되었습니다.');
   // Validate all known targets/files before displaying a concrete approval.
   for(const s of p.steps){if(['fill','select'].includes(s.action)&&s.value===undefined)fail('INPUT_INVALID','입력값이 필요합니다.');if(s.action==='upload')this.file(s.fileId);if(typeof s.target==='string'){const r=this.resolve(s.target);if(r.cap.action!==s.action)fail('ACTION_MISMATCH','대상의 행동이 다릅니다.');}}
   const describe=p.steps.map((s,i)=>`${i+1}. ${s.action} · ${typeof s.target==='string'?expected.get(s.target)?.cap.name:s.target.name}${s.value!==undefined?' = '+redact(s.value):s.fileId?' / '+this.file(s.fileId).name:''}`).join('\n');
   await approve('batch','작업 묶음 승인',`${safeUrl(this.core.browser.tab(task.tabId).url)}\n${describe}\n결과 확인: ${JSON.stringify(p.expect)}\n알 수 없는 클릭과 파일 전송은 실행 직전에 별도 승인합니다.`,hash([taskId,digest]));
   await this.capture();if(this.state!==p.state)fail('STALE_STATE','승인 중 화면이 변경되었습니다.');const beforeText=redact(await this.core.browser.pageText(task.tabId)).slice(0,200000);checkpoint();
   for(stepIndex=0;stepIndex<p.steps.length;stepIndex++){
    await check();const s=p.steps[stepIndex];await this.capture();let r=this.resolve(s.target);const original=typeof s.target==='string'?expected.get(s.target):undefined;if(original&&this.signature(original)!==this.signature(r))fail('TARGET_REPLACED','승인한 대상이 변경되었습니다.');if(r.cap.action!==s.action)fail('ACTION_MISMATCH','행동 불일치');
    if(s.action==='select'&&!r.dom!.options.includes(s.value!))fail('INPUT_INVALID','선택지에 없는 값입니다.');
    if(s.action==='click'||s.action==='upload'){
     const signature=this.signature(r);await approve('commit','실행 직전 승인',`${safeUrl(this.core.browser.tab(task.tabId).url)}\n${s.action} · ${r.cap.name}\n${s.action==='upload'?'외부 전송 파일: '+this.file(s.fileId).name:'클릭의 효과는 사이트에 따라 다릅니다. 게시·생성·결제 여부를 확인하세요.'}`,hash([taskId,digest,stepIndex,signature]));
     await this.capture();r=this.resolve(s.target);if(this.signature(r)!==signature)fail('TARGET_REPLACED','승인 중 대상이 바뀌었습니다.');
    }
    await check();const file=s.action==='upload'?this.file(s.fileId):undefined;const target=await this.core.browser.target(task.tabId);const signature=this.signature(r);
    await this.core.adapter.target(target,async command=>{
     // Refresh refs in this pinned session; never use cached refs as permission.
     const snap=await command(['snapshot','-i','-c']);const matches=Object.entries(snap.refs||{}).filter(([,d]:any)=>d.role===r.cap.role&&d.name===r.cap.name);if(s.action!=='upload'&&matches.length!==1)fail('AMBIGUOUS_TARGET','실행 직전 대상 불일치');
     const fresh=await this.core.browser.controls!(task.tabId);const d=fresh.find(x=>x.key===r.dom!.key&&x.role===r.cap.role&&x.name===r.cap.name);if(!d||this.signature({...r,dom:d})!==signature)fail('TARGET_REPLACED','실행 직전 요소가 교체되었습니다.');for(const [key,value] of written){if(fresh.find(x=>x.key===key)?.value!==value)fail('INPUT_CHANGED','승인된 입력값이 실행 도중 변경되었습니다.');}await check();
     const selector=s.action==='upload'?(await this.core.browser.fileFields(task.tabId)).find(x=>x.name===r.cap.name)?.selector:'@'+matches[0][0];if(!selector)fail('TARGET_NOT_FOUND','업로드 대상 없음');
     inFlight=true;checkpoint();await command([s.action,selector,...(s.action==='upload'?[file!.path]:['fill','select'].includes(s.action)?[s.value!]:[])]);inFlight=false;
    });
    receipts.push({step:stepIndex,action:s.action,target:r.id,status:'acknowledged'});checkpoint();await check();
    if(['fill','select','check'].includes(s.action)){const fields=await this.core.browser.controls!(task.tabId),after=fields.find(d=>d.key===r.dom!.key);const value=s.action==='check'?'true':s.value;if(!after||after.value!==value)fail('POSTCONDITION_FAILED','입력값을 확인하지 못했습니다.');written.set(r.dom!.key,value!);receipts.at(-1).status='verified';}
   }
   for(const condition of p.expect){let proof:any;const until=Math.min(deadline,Date.now()+10000);do{await check();
     if(condition.kind==='download'){const arts=this.core.store.artifacts().filter(a=>a.taskId===taskId&&a.createdAt>=started&&a.status==='completed');if(arts.length)proof={kind:'download',artifacts:arts.map(({id,name,bytes})=>({id,name,bytes}))};}
     else if(condition.kind==='text'){const text=redact(await this.core.browser.pageText(task.tabId)).slice(0,200000);let prefix=0;while(prefix<text.length&&prefix<beforeText.length&&text[prefix]===beforeText[prefix])prefix++;let suffix=0;while(suffix<text.length-prefix&&suffix<beforeText.length-prefix&&text[text.length-1-suffix]===beforeText[beforeText.length-1-suffix])suffix++;const changed=text.slice(Math.max(0,prefix-40),text.length-suffix);const source=changed.includes(condition.value)?changed:text;const pos=source.indexOf(condition.value);if(pos>=0)proof={kind:'text',changed:source===changed,snippet:source.slice(Math.max(0,pos-100),pos+condition.value.length+200)};}
     else{await this.capture();try{const r=this.resolve(condition.target!);if(condition.kind==='exists')proof={kind:'exists',target:r.id,name:r.cap.name};else if(r.dom?.value===condition.value)proof={kind:'value',target:r.id,value:condition.value};}catch(e){if((e as any).code==='AMBIGUOUS_TARGET')throw e;}}
     if(!proof)await this.core.browser.wait(150);
    }while(!proof&&Date.now()<until);if(!proof)fail('POSTCONDITION_FAILED','완료 조건이 확인되지 않았습니다.');evidence.push(proof);
   }
   await check();const rows=await this.capture();result.status=p.expect.length?'verified':'acknowledged';result.state=this.state;Object.assign(result,this.delta(rows.slice(0,20)));result.artifacts=this.core.store.artifacts().filter(a=>a.taskId===taskId&&a.createdAt>=started).map(({id,name,status,bytes})=>({id,name,status,bytes}));
  }catch(e){const code=(e as any).code||'ERROR';if(inFlight||code==='TIMEOUT_UNKNOWN'){this.unknown=true;result.status='unknown';}result.stoppedAt=stepIndex;result.notRun=p.steps.map((_,i)=>i).filter(i=>i>=stepIndex+(inFlight?1:0)&&!receipts.some(r=>r.step===i));result.error={code,message:redact((e as Error).message)};this.core.markRecoverable();}
  finally{clearTimeout(timer);if(this.core.task?.id===taskId){this.core.task.status='running';this.core.update();}result.elapsedMs=Date.now()-started;this.core.store.operation(taskId,p.requestId,{digest,...result});}
  return result;
 }
}
