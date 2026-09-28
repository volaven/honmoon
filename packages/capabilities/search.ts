import type {Capability} from '../core/types.js';
export function rankCapabilities(caps:Capability[],query:string,action?:string){
 const q=query.normalize('NFKC').toLocaleLowerCase().trim();const words=q.split(/\s+/).filter(Boolean);
 return caps.map(cap=>{const name=cap.name.normalize('NFKC').toLocaleLowerCase();const score=name===q?100:name.includes(q)?60:words.reduce((n,w)=>n+(name.includes(w)?10:0),0);return {cap,score};}).filter(r=>(!action||r.cap.action===action)&&r.score>0).sort((a,b)=>b.score-a.score||a.cap.name.localeCompare(b.cap.name));
}
