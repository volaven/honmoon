import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {executeSchema,compactTools} from '../packages/core/browser-contract.js';
import {registry} from '../packages/core/tool-registry.js';
import {continuationContext} from '../packages/core/continuation.js';
import {Store} from '../packages/core/store.js';
import {CodexAdapter} from '../packages/codex-adapter/index.js';
import {SnapshotCache} from '../packages/agent-adapter/snapshot-cache.js';
test('compact execution cannot smuggle JS, paths, approval or more than ten steps',()=>{
 const good={state:'s',requestId:'r',steps:[{target:'b1',action:'click'}],expect:[{kind:'text',value:'Done'}]};assert.ok(executeSchema.safeParse(good).success);
 for(const altered of [{...good,steps:Array(11).fill(good.steps[0])},{...good,approved:true},{...good,steps:[{target:'b1',action:'eval',value:'x'}]},{...good,steps:[{target:'b1',action:'upload',path:'C:/private'}]},{...good,expect:[{kind:'text',target:'Done'}]}])assert.equal(executeSchema.safeParse(altered).success,false);
 assert.equal(compactTools.length,3);
});
test('shared registry covers assistant tools and guards all task control',()=>{
 for(const name of ['browser.observe','browser.execute','browser.recover','capabilities.find','capabilities.inspect','tasks.cancel','tasks.status','artifacts.list'] as const)assert.equal(registry[name].owner,true);
 assert.equal(Object.keys(registry).filter(k=>k.includes('approve')).length,0);
});
test('continuation carries selected result only, capped at 2000 characters',()=>{
 const task:any={id:'one',prompt:'p'.repeat(4000),output:'result'.repeat(3000),status:'succeeded',threadId:'DO_NOT_RESUME',usage:{inputTokens:9000}};
 const c=continuationContext(task,[{id:'file',taskId:'one',name:'output.txt',status:'completed'} as any]);assert.ok(c.length<=2000);assert.ok(!c.includes('DO_NOT_RESUME'));assert.ok(!c.includes('inputTokens'));
});
test('interrupted batch journal is retained on restart without replay',()=>{
 const dir=mkdtempSync(join(tmpdir(),'honmoon-journal-'));try{let s=new Store(join(dir,'test.sqlite'));s.operation('task','req',{status:'in_flight',completed:[{step:0}]});s.close();s=new Store(join(dir,'test.sqlite'));const row=s.db.prepare('SELECT body FROM operations').get() as any;const op=JSON.parse(row.body);assert.equal(op.status,'interrupted');assert.equal(op.outcomeUnknown,true);assert.deepEqual(op.completed,[{step:0}]);s.close();}finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('honmoon-journal-'));rmSync(dir,{recursive:true,force:true});}
});
test('new tasks create independent Codex threads instead of replaying tool history',async()=>{
 const calls:any[]=[];const c=new CodexAdapter('unused','unused','unused',async()=>({}));c.account={};c.connect=async()=>{};c.request=async(method,params)=>{calls.push({method,params});return method==='thread/start'?{thread:{id:'thread-'+calls.length}}:{turn:{id:'turn'}};};
 const task:any={id:'one',origin:'https://example.com',prompt:'first',executionMode:'compact'};await c.run(task);await c.run({...task,id:'two',prompt:'second',continuation:'selected receipt'});
 assert.equal(calls.filter(x=>x.method==='thread/start').length,2);assert.equal(calls.some(x=>x.method==='thread/resume'),false);assert.equal(calls[0].params.dynamicTools.length,3);assert.match(calls[2].params.developerInstructions,/selected receipt/);assert.ok(!calls[0].params.developerInstructions.includes('selected receipt'));
});
test('snapshot delta requires a valid local baseline',()=>{const cache=new SnapshotCache();assert.equal(cache.apply({snapshot:{kind:'unchanged',baseRevision:1,revision:2}}),undefined);assert.equal(cache.apply({snapshot:{kind:'full',revision:1,refs:{e1:{name:'x'}},tree:'x'}}).snapshot,'x');assert.equal(cache.apply({snapshot:{kind:'unchanged',baseRevision:1,revision:2}}).refs.e1.name,'x');assert.equal(cache.apply({snapshot:{kind:'unchanged',baseRevision:1,revision:3}}),undefined);});
