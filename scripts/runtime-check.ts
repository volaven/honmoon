import {resolveCodex,checkBinary} from '../main/runtime.js';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
import {CodexAdapter} from '../packages/codex-adapter/index.js';
const home=resolve('.runtime/clean-path-runtime');mkdirSync(home,{recursive:true});const originalPath=process.env.PATH;process.env.PATH='';
const binary=resolveCodex(home);const c=new CodexAdapter(binary,home,resolve('.runtime/clean-path-workspace'),async()=>({}));
try{await c.connect();const report={codex:checkBinary(binary,'codex'),browser:checkBinary(resolve(process.argv[2]||'node_modules/agent-browser/bin/agent-browser-win32-x64.exe'),'agent-browser'),pathEmpty:true,status:c.status,models:c.models.length};writeFileSync('evidence/runtime-check.json',JSON.stringify(report,null,2));console.log(report);}finally{c.dispose();process.env.PATH=originalPath;}
