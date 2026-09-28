import {BenchmarkCodex} from './codex-rpc.mjs';
import {resolveCodex} from '../dist/main/runtime.js';
import {disabledFeatures} from '../dist/packages/codex-adapter/index.js';
import {join,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const data=join(process.env.APPDATA,'HONMOON'),workspace=resolve('.runtime/tool-probe');mkdirSync(workspace,{recursive:true});
const c=new BenchmarkCodex(resolveCodex(data),join(data,'codex'),workspace);const rows=[];let active;
c.on('message',m=>{
 if(m.id!==undefined&&m.method){if(m.method==='item/tool/call'){active.calls.push(m.params.tool);c.send({id:m.id,result:{success:true,contentItems:[{type:'inputText',text:'{"pong":true}'}]}});}else c.send({id:m.id,error:{code:-32601,message:'Denied'}});return;}
 if(!active||m.params?.threadId!==active.threadId)return;
 if(m.method==='item/agentMessage/delta')active.output+=m.params.delta;
 if(m.method==='thread/tokenUsage/updated')active.usage=m.params.tokenUsage.total;
 if(m.method==='turn/completed'){active.status=m.params.turn.status;active.resolve();}
});
try{await c.initialize();for(const variant of ['startup-host-enabled','environment-omitted']){
 active={variant,calls:[],output:''};
 const env=variant==='environment-omitted'?{}:{environments:[]};
 const features=Object.fromEntries(disabledFeatures.map(x=>[x,false]));features.code_mode_host=true;features.code_mode=true;
 const t=await c.request('thread/start',{cwd:workspace,model:'gpt-6-luna',ephemeral:true,sandbox:'read-only',approvalPolicy:'on-request',...env,config:{web_search:'disabled',project_doc_max_bytes:0,features},baseInstructions:'Use the provided benchmark_ping tool once. No other tools. Report the returned pong value.',dynamicTools:[{type:'function',name:'benchmark_ping',description:'Return a harmless test pong.',inputSchema:{type:'object',properties:{},additionalProperties:false},deferLoading:false}]});
 active.threadId=t.thread.id;let timer;const p=new Promise(r=>{active.resolve=r;timer=setTimeout(r,40000)});await c.request('turn/start',{threadId:t.thread.id,input:[{type:'text',text:'Call benchmark_ping once and report its result.'}],effort:'low',...env});await p;clearTimeout(timer);delete active.resolve;rows.push(active);console.log(JSON.stringify(active));if(active.calls.length)break;
}writeFileSync(resolve('evidence/tool-probe.json'),JSON.stringify(rows,null,2));}finally{c.close();}
