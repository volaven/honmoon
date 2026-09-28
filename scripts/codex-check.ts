import {CodexAdapter,tools} from '../packages/codex-adapter/index.js';
import {resolve} from 'node:path';
const c=new CodexAdapter(process.argv[2],resolve('.runtime/codex-check'),resolve('.runtime/codex-check-workspace'),async()=>({}));
try{await c.connect();const t=await c.request('thread/start',{cwd:c.workspace,sandbox:'read-only',approvalPolicy:'on-request',environments:[],dynamicTools:tools,ephemeral:true});console.log(JSON.stringify({status:c.status,accountPresent:!!c.account,models:c.models.length,threadCreated:!!t.thread?.id,sandbox:t.sandbox,approvalPolicy:t.approvalPolicy}));}catch(e){console.error(String(e));process.exitCode=1;}finally{c.dispose();}
