import {BenchmarkCodex} from './codex-rpc.mjs';
import {resolveCodex} from '../main/runtime.js';
import {join,resolve} from 'node:path';
const data=join(process.env.APPDATA!,'HONMOON');
const client=new BenchmarkCodex(resolveCodex(data),join(data,'codex'),resolve('.'));
try{await client.initialize();const a=await client.request('account/read',{refreshToken:false});const m=await client.request('model/list',{limit:100});console.log(JSON.stringify({authenticated:!!a.account,models:m.data.map((x:any)=>({id:x.id,model:x.model,isDefault:x.isDefault,supportedReasoningEfforts:x.supportedReasoningEfforts}))},null,2));}finally{client.close();}
