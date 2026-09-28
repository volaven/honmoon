import {hash} from './index.js';
import type {Capability} from '../core/types.js';

/** Only this representation crosses the model boundary. Execution keeps full contracts. */
export class CapabilityPresenter {
 private aliases=new Map<string,string>();private targets=new Map<string,string>();private previous=new Map<string,string>();private scope='';private serial=0;
 reset(){this.aliases.clear();this.targets.clear();this.previous.clear();this.scope='';this.serial=0;}
 resolve(id:string){return this.targets.get(id)||id;}
 refresh(caps:Capability[]){const seen=new Map<string,number>();return caps.map(c=>{const base=JSON.stringify([c.tabId,c.origin,c.revision,c.role,c.name,c.action]);const n=seen.get(base)||0;seen.set(base,n+1);const key=base+':'+n;let id=this.aliases.get(key);if(!id){id='c'+(++this.serial);this.aliases.set(key,id);}this.targets.set(id,c.id);return {id,cap:c};});}
 present(caps:Capability[],context:{tabId:string;origin:string;revision:number},files:unknown[]){
  const scope=JSON.stringify(context);const full=scope!==this.scope;const seen=new Map<string,number>();const rows=caps.map(c=>{const base=JSON.stringify([c.tabId,c.origin,c.revision,c.role,c.name,c.action]);const n=seen.get(base)||0;seen.set(base,n+1);const key=base+':'+n;let alias=this.aliases.get(key);if(!alias){alias='c'+(++this.serial);this.aliases.set(key,alias);}this.targets.set(alias,c.id);return {id:alias,action:c.action,name:c.name,...(['fill','select'].includes(c.action)?{input:'value'}:c.action==='upload'?{input:'fileId'}:{})};});
  const next=new Map(rows.map(r=>[r.id,JSON.stringify(r)]));const removed=[...this.previous.keys()].filter(id=>!next.has(id));for(const id of removed)this.targets.delete(id);
  const changed=rows.filter(r=>full||this.previous.get(r.id)!==JSON.stringify(r));const state=hash([context,rows,files]).slice(0,8);const result=full?{...context,state,untrusted:true,approval:'Every action requires HONMOON UI approval.',capabilities:rows,files}:changed.length||removed.length?{state,changed,removed,files}:{state,unchanged:true,files};this.scope=scope;this.previous=next;return result;
 }
}
