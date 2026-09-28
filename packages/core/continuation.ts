import {redact} from './store.js';
import type {Task,Artifact} from './types.js';
export function continuationContext(task:Task,artifacts:Artifact[]){return redact(JSON.stringify({instruction:task.prompt.slice(0,400),result:task.output?.slice(0,1100),status:task.status,artifacts:artifacts.filter(a=>a.taskId===task.id&&a.status==='completed').map(({id,name})=>({id,name})).slice(0,5)})).slice(0,2000);}
