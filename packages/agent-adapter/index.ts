import {spawn,type ChildProcess} from 'node:child_process';
import {AppError} from '../core/types.js';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {SnapshotCache} from './snapshot-cache.js';
export class AgentBrowser{
 optimized=false;commandCount=0;private bound='';private viewportKey='';private pinned=false;
 private snapshots=new Map<string,SnapshotCache>();
 private closedTargets=new Set<string>();
 async snapshot(targetId:string){return this.target(targetId,async c=>{if(!this.optimized)return c(['snapshot','-i','-c']);let cache=this.snapshots.get(targetId);if(!cache){cache=new SnapshotCache();this.snapshots.set(targetId,cache);}const result=cache.apply(await c(['snapshot','-i','-c','--delta']));return result||cache.apply(await c(['snapshot','-i','-c','--delta','--full']));});}
 private queue:Promise<unknown>=Promise.resolve();private children=new Set<ChildProcess>();private epoch=0;
 invalidateTarget(targetId:string){if(targetId)this.closedTargets.add(targetId);if(targetId&&this.bound===targetId)this.cancel();}
 secrets?:()=>Record<string,string>;
 constructor(public binary:string,public endpoint:string,public session:string,public home:string){mkdirSync(home,{recursive:true});writeFileSync(join(home,'config.json'),'{}');}
 private environment(extra:Record<string,string>={}){const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('AGENT_BROWSER_'))delete env[key];return {...env,AGENT_BROWSER_SOCKET_DIR:this.home,AGENT_BROWSER_RESTORE_SAVE:'never',...this.secrets?.(),...extra};}
 daemonPid(){try{const n=Number(readFileSync(join(this.home,this.session+'-'+this.epoch+'.pid'),'utf8').trim());return Number.isSafeInteger(n)&&n>0?n:undefined;}catch{return undefined;}}
 viewport?:()=>{width:number;height:number};
 cancel(){const daemon=this.daemonPid();this.epoch++;this.bound='';this.viewportKey='';this.pinned=false;this.snapshots.clear();for(const child of this.children)child.kill();if(daemon){try{process.kill(daemon);}catch{}}}
 exclusive<T>(fn:(command:(args:string[])=>Promise<any>)=>Promise<T>):Promise<T>{const epoch=this.epoch;const next=this.queue.then(async()=>{if(epoch!==this.epoch)throw new AppError('CANCELLED','실행 취소됨');return fn(async args=>{if(epoch!==this.epoch)throw new AppError('CANCELLED','실행 취소됨');const result=await this.raw(args);if(epoch!==this.epoch)throw new AppError('CANCELLED','실행 취소됨');return result;});});this.queue=next.catch(()=>{});return next;}
 async target<T>(targetId:string,fn:(command:(args:string[])=>Promise<any>)=>Promise<T>):Promise<T>{return this.exclusive(async command=>{if(this.closedTargets.has(targetId))throw new AppError('STALE_TARGET','대상 탭이 닫혔습니다.');const list=await command(['tab','list']);if(!list.tabs?.some((t:any)=>t.targetId===targetId))throw new AppError('STALE_TARGET','대상 탭이 닫혔습니다.');if(!this.optimized||this.bound!==targetId){await command(['tab',targetId]);this.bound=targetId;this.viewportKey='';this.pinned=this.optimized;}if(this.viewport){const v=this.viewport(),key=JSON.stringify(v);if(!this.optimized||this.viewportKey!==key){await command(['set','viewport',String(v.width),String(v.height),'1']);this.viewportKey=key;await new Promise(r=>setTimeout(r,300));}}return fn(command);});}
 async raw(args:string[],input?:string,extraEnv:Record<string,string>={}):Promise<any>{const epoch=this.epoch;return new Promise((resolve,reject)=>{
  if(args[0]==='tab'&&args[1]!=='list'){this.bound='';this.viewportKey='';}
  this.commandCount++;let out='',err='',settled=false;const child=spawn(this.binary,['--config',join(this.home,'config.json'),'--session',this.session+'-'+epoch,'--cdp',this.endpoint,...(this.pinned?['--pin-tab']:[]),'--json','--content-boundaries',...args],{windowsHide:true,env:this.environment(extraEnv),stdio:['pipe','pipe','pipe']});this.children.add(child);
  const done=(error?:Error,value?:any)=>{if(settled)return;settled=true;clearTimeout(timer);this.children.delete(child);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{this.cancel();done(new AppError('TIMEOUT_UNKNOWN',`브라우저 ${args[0]} 명령 시간 초과. 재실행 전에 결과를 확인하세요.`));},20000);
  child.stdout!.on('data',b=>{out+=b;if(out.length>2_000_000){child.kill();done(new AppError('OUTPUT_LIMIT','응답 크기 제한'));}});child.stderr!.on('data',b=>{err=(err+b).slice(-4000);});child.on('error',e=>done(e));child.on('exit',code=>{setTimeout(()=>{try{const value=JSON.parse(out);if(code||!value.success)done(new AppError('BROWSER_ERROR',String(value.error||'브라우저 명령 실패').slice(0,500)));else done(undefined,value.data);}catch{done(new AppError('BROWSER_UNAVAILABLE',`브라우저 실행기 응답 실패 (${code}). ${err.slice(0,250)}`));}},100);});if(input)child.stdin!.write(input);child.stdin!.end();
 });}
}
