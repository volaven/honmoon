import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCapabilities} from '../packages/capabilities/search.js';
import {discover} from '../packages/capabilities/index.js';
import {integrationConfigs} from '../main/integrations.js';
const tab={id:'tab',targetId:'target',url:'https://example.com',title:'test',revision:1,authPaused:false,loading:false};
test('assistant returns only label matches, ranks exact first and filters actions',()=>{const caps=discover(tab,{refs:{e1:{role:'button',name:'검색'},e2:{role:'searchbox',name:'검색어'},e3:{role:'button',name:'다운로드'}}});assert.equal(rankCapabilities(caps,'검색')[0].cap.name,'검색');assert.equal(rankCapabilities(caps,'검색','fill')[0].cap.name,'검색어');assert.equal(rankCapabilities(caps,'없는 기능').length,0);});
test('external client configs preserve Windows paths and require no installed Node',()=>{const c=integrationConfigs('C:\\App Space\\HONMOON.exe',['C:\\App Space\\resources\\bridge.cjs','--connection','C:\\Profile\\mcp-connection.json'],{ELECTRON_RUN_AS_NODE:'1'});const j=JSON.parse(c.claude);assert.equal(j.mcpServers.honmoon.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(c.antigravity,c.claude);assert.match(c.codex,/tool_timeout_sec = 150/);assert.ok(!c.codex.includes('token'));});

import {Orchestrator} from '../packages/core/orchestrator.js';
test('ambiguous duplicate controls stop before any approval or browser mutation',async()=>{
 let asked=0;const browser:any={tab:()=>tab,activeId:()=>tab.id};const store:any={task(){},event(){}};const permissions:any={ask(){asked++;throw Error('must not ask');},cancel(){}};
 const core=new Orchestrator(browser,{cancel(){}} as any,store,permissions,()=>{});
 core.task={id:'task',tabId:tab.id,origin:'https://example.com',prompt:'Save',status:'running',createdAt:Date.now(),updatedAt:Date.now(),expiresAt:Date.now()+60000};
 core.capabilities=discover(tab,{refs:{e1:{role:'button',name:'Save'},e2:{role:'button',name:'Save'}}});
 try{await assert.rejects(core.invoke({id:core.capabilities[0].id,input:{},requestId:'once'}),/같은 이름/);assert.equal(asked,0);}finally{core.dispose();}
});
