import {randomUUID} from 'node:crypto';
// Internal only: binds one Electron download event to one result UI click.
export class MediaDownloadGate {
 private pending?:{token:string;tabId:string;resultId:string;origin:string;expiresAt:number};
 arm(tabId:string,resultId:string,origin:string){const token=randomUUID();this.pending={token,tabId,resultId,origin,expiresAt:Date.now()+60000};return token;}
 clear(){this.pending=undefined;}
 claim(tabId:string,url:string,filename:string){
  const p=this.pending;if(!p||p.tabId!==tabId||p.expiresAt<Date.now()||p.origin!=='https://grok.com')return;
  try{const u=new URL(url);if(u.protocol!=='blob:'||u.origin!==p.origin)return;}catch{return;}
  if(!/^[a-f0-9-]{36}$/i.test(p.resultId)||!new RegExp('(?:^|[-_])'+p.resultId+'(?:[._-]|$)','i').test(filename))return;
  this.clear();return p.token;
 }
}
