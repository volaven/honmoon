import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const bridge=process.argv[2]||resolve('dist/mcp/bridge.cjs');
const connection=process.argv[3]||join(process.env.APPDATA!,'HONMOON','mcp-connection.json');
const client=new Client({name:'honmoon-verifier',version:'0.1.0'});const transport=new StdioClientTransport({command:process.argv[4]||process.execPath,args:[bridge,'--connection',connection],env:{...process.env as Record<string,string>,...(process.argv[4]?{ELECTRON_RUN_AS_NODE:'1'}:{})}});
try{await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,13);assert.ok(!tools.tools.some(t=>/shell|eval|cookie|approvals/.test(t.name)));const sessions=await client.callTool({name:'sessions.list',arguments:{}});assert.ok(!sessions.isError);const tabs=await client.callTool({name:'tabs.list',arguments:{}});assert.ok(!tabs.isError);console.log(JSON.stringify({connected:true,tools:tools.tools.map(t=>t.name),sessionsRead:true,tabsRead:true}));}finally{await client.close();}
