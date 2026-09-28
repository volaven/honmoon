import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {Task,Artifact,Capability} from './types.js';
import type {MediaJob} from './media-contract.js';
export function redact(value:string){return value.replace(/\b(?:sk-[\w-]{12,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g,'[REDACTED]').replace(/((?:password|passwd|cookie|authorization|access_token|refresh_token|api_key)\s*[=:]\s*)[^\s,;]+/gi,'$1[REDACTED]');}
export function safeUrl(value:string){try{const u=new URL(value);u.username='';u.password='';u.search='';u.hash='';return u.href;}catch{return '[invalid URL]';}}
export class Store{
 db:DatabaseSync;
 constructor(file:string){mkdirSync(dirname(file),{recursive:true});this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, at INTEGER, kind TEXT, body TEXT); CREATE TABLE IF NOT EXISTS contracts(id TEXT PRIMARY KEY, body TEXT NOT NULL);');this.db.exec('CREATE TABLE IF NOT EXISTS operations(taskId TEXT NOT NULL, requestId TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(taskId,requestId))');for(const row of this.db.prepare('SELECT taskId,requestId,body FROM operations').all() as any[]){const op=JSON.parse(row.body);if(['running','in_flight'].includes(op.status))this.operation(row.taskId,row.requestId,{...op,status:'interrupted',error:'APP_RESTARTED',outcomeUnknown:op.status==='in_flight'});}for(const t of this.tasks()){if(['queued','running','awaiting_approval'].includes(t.status)){t.status='cancelled';t.error='APP_RESTARTED';this.task(t);}}this.recoverMediaJobs();}
 task(t:Task){this.db.prepare('INSERT OR REPLACE INTO tasks VALUES (?,?)').run(t.id,JSON.stringify({...t,prompt:redact(t.prompt),output:t.output?redact(t.output):undefined}));}
 tasks():Task[]{return this.db.prepare('SELECT body FROM tasks ORDER BY rowid DESC LIMIT 200').all().map((r:any)=>JSON.parse(r.body));}
 mediaJob(j:MediaJob){this.db.exec('CREATE TABLE IF NOT EXISTS media_jobs(id TEXT PRIMARY KEY, body TEXT NOT NULL)');this.db.prepare('INSERT OR REPLACE INTO media_jobs VALUES (?,?)').run(j.id,JSON.stringify(j));}
 mediaJobs():MediaJob[]{this.db.exec('CREATE TABLE IF NOT EXISTS media_jobs(id TEXT PRIMARY KEY, body TEXT NOT NULL)');return this.db.prepare('SELECT body FROM media_jobs ORDER BY rowid DESC LIMIT 200').all().map((r:any)=>JSON.parse(r.body));}
 recoverMediaJobs(){for(const j of this.mediaJobs())if(!['succeeded','failed','unknown','cancelled'].includes(j.status))this.mediaJob({...j,status:j.submittedAt?'unknown':'cancelled',error:'APP_RESTARTED · 자동 재실행하지 않음',updatedAt:Date.now()});}
 artifact(a:Artifact){this.db.prepare('INSERT OR REPLACE INTO artifacts VALUES (?,?)').run(a.id,JSON.stringify({...a,sourceUrl:safeUrl(a.sourceUrl)}));}
 artifacts():Artifact[]{return this.db.prepare('SELECT body FROM artifacts ORDER BY rowid DESC LIMIT 200').all().map((r:any)=>JSON.parse(r.body));}
 contract(c:Capability){this.db.prepare('INSERT OR REPLACE INTO contracts VALUES (?,?)').run(c.id,JSON.stringify(c));}
 event(kind:string,data:unknown){this.db.prepare('INSERT INTO events(at,kind,body) VALUES(?,?,?)').run(Date.now(),kind,redact(JSON.stringify(data)));}
 events(){return this.db.prepare('SELECT at,kind,body FROM events ORDER BY id DESC LIMIT 100').all().map((r:any)=>({...r,body:JSON.parse(r.body)}));}
 close(){this.db.close();}
 operation(taskId:string,requestId:string,body:unknown){this.db.exec('CREATE TABLE IF NOT EXISTS operations(taskId TEXT NOT NULL, requestId TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(taskId,requestId))');this.db.prepare('INSERT OR REPLACE INTO operations VALUES (?,?,?)').run(taskId,requestId,JSON.stringify(body));}
}
