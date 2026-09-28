import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'honmoon-mcp-test-'));const pipe='\\\\.\\pipe\\honmoon-test-'+randomUUID();const token=randomUUID();const connection=join(dir,'connection.json');writeFileSync(connection,JSON.stringify({pipe,token}));const forwarded=[];
const gateway=createServer(s=>{let input='';s.on('data',b=>{input+=b;if(!input.includes('\n'))return;const packet=JSON.parse(input);assert.equal(packet.token,token);forwarded.push({method:packet.method,args:packet.args});s.end(JSON.stringify({result:{status:'test-only',method:packet.method}})+'\n');});});await new Promise(resolveReady=>gateway.listen(pipe,resolveReady));
try{for(const mode of ['legacy','compact']){const client=new Client({name:'honmoon-schema-test',version:'1'});const transport=new StdioClientTransport({command:process.execPath,args:[resolve('dist/mcp/bridge.cjs'),'--connection',connection,'--toolset',mode],stderr:'pipe'});try{await client.connect(transport);const {tools}=await client.listTools();assert.equal(tools.length,mode==='compact'?10:13);if(mode==='compact'){assert.ok(tools.find(t=>t.name==='browser.execute').inputSchema.properties.workflow);await client.callTool({name:'browser.execute',arguments:{workflow:'media.generate',state:'s',requestId:'r',kind:'image',prompt:'test'}});assert.equal(forwarded.at(-1).method,'browser.execute');assert.equal(forwarded.at(-1).args.kind,'image');}else{assert.ok(tools.some(t=>t.name==='capabilities.find'));assert.ok(tools.some(t=>t.name==='capabilities.inspect'));}console.log('PASS MCP',mode,tools.length);}finally{await client.close();}}writeFileSync('evidence/media-mcp.json',JSON.stringify({at:new Date().toISOString(),compactTools:10,legacyTools:13,mediaSchemaForwarded:true,scope:'isolated local gateway protocol test'},null,2));}
finally{await new Promise(done=>gateway.close(done));assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('honmoon-mcp-test-'));rmSync(dir,{recursive:true,force:true});}
