import {randomUUID} from 'node:crypto';
import type {Approval} from './types.js';
import {AppError} from './types.js';
export class Permissions{
 private grants=new Map<string,{expiresAt:number;allowUnknownCost:boolean;generationLimit:number;generations:Set<string>;fileIds:string[]}>();
 private covered=new Set(['task','batch','click','fill','select','check','upload','read','recovery','generation','unknown-cost']);
 pending=new Map<string,{approval:Approval;resolve:(value:boolean)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private changed:()=>void,private audit:(data:unknown)=>void=()=>{}){}
 taskGrant(taskId:string){const g=this.grants.get(taskId);if(!g||Date.now()>=g.expiresAt){this.grants.delete(taskId);return;}return {expiresAt:g.expiresAt,allowUnknownCost:g.allowUnknownCost,generationLimit:g.generationLimit,generationsUsed:g.generations.size,fileIds:[...g.fileIds]};}
 grantTask(taskId:string,scope:{expiresAt:number;allowUnknownCost:boolean;generationLimit:number;fileIds:string[];usedGenerations?:number}){if(scope.expiresAt<=Date.now()||!Number.isInteger(scope.generationLimit)||scope.generationLimit<1||scope.generationLimit>10)throw new AppError('APPROVAL_INVALID','잘못된 작업 승인 범위');if(this.grants.has(taskId))throw new AppError('APPROVAL_EXISTS','이미 승인된 작업입니다.');const prior=scope.usedGenerations||0;if(prior>scope.generationLimit)throw new AppError('APPROVAL_LIMIT','이미 제출한 횟수보다 적은 한도입니다.');this.grants.set(taskId,{...scope,fileIds:[...scope.fileIds],generations:new Set(Array.from({length:prior},(_,i)=>'prior:'+i))});for(const [id,p] of this.pending){if(p.approval.taskId===taskId){try{if(this.consume(p.approval))this.decide(id,true);}catch{this.decide(id,false);}}}this.changed();}
 private consume(a:Omit<Approval,'id'|'expiresAt'>){if(!a.taskId||!this.covered.has(a.kind))return false;const scope=this.taskGrant(a.taskId);if(!scope)return false;if(a.kind==='unknown-cost'&&!scope.allowUnknownCost)return false;const g=this.grants.get(a.taskId)!;if(a.kind==='generation'){if(g.generations.has(a.binding))throw new AppError('APPROVAL_REUSED','이미 사용한 생성 승인입니다.');if(g.generations.size>=g.generationLimit)throw new AppError('APPROVAL_LIMIT','승인한 생성 횟수를 초과했습니다.');g.generations.add(a.binding);}this.audit({taskId:a.taskId,kind:a.kind,binding:a.binding,mode:'task'});return true;}
 ask(input:Omit<Approval,'id'|'expiresAt'>):Promise<boolean>{try{if(this.consume(input))return Promise.resolve(true);}catch(e){return Promise.reject(e);}return new Promise(resolve=>{const approval={...input,id:randomUUID(),expiresAt:Date.now()+120000};const timer=setTimeout(()=>this.decide(approval.id,false),120000);this.pending.set(approval.id,{approval,resolve,timer});this.changed();});}
 decide(id:string,allow:boolean){const p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.timer);p.resolve(allow&&Date.now()<p.approval.expiresAt);this.changed();}
 cancel(taskId?:string){if(taskId)this.grants.delete(taskId);else this.grants.clear();for(const [id,p] of this.pending){if(!taskId||p.approval.taskId===taskId)this.decide(id,false);}}
 list(){return [...this.pending.values()].map(p=>p.approval);}
}
