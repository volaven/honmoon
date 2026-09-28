import test from 'node:test';
import assert from 'node:assert/strict';
import {CapabilityPresenter} from '../packages/capabilities/presenter.js';
import {discover} from '../packages/capabilities/index.js';
const tab={id:'tab',targetId:'target',url:'https://example.com',title:'test',revision:1,authPaused:false,loading:false};
const scope={tabId:tab.id,origin:'https://example.com',revision:1};
test('model capabilities reuse short IDs, return changes, and refresh actual execution targets',()=>{
 const p=new CapabilityPresenter();const first=discover(tab,{refs:{e1:{role:'button',name:'Save'}}});const a:any=p.present(first,scope,[]);assert.equal(a.capabilities[0].id,'c1');assert.equal(p.resolve('c1'),first[0].id);
 const same:any=p.present(first,scope,[]);assert.equal(same.unchanged,true);assert.ok(!same.capabilities);
 const updated=discover(tab,{refs:{e2:{role:'button',name:'Save'},e3:{role:'link',name:'Download'}}});const delta:any=p.present(updated,scope,[]);assert.equal(p.resolve('c1'),updated[0].id);assert.equal(delta.changed.length,1);assert.equal(delta.changed[0].name,'Download');
 const removed:any=p.present([updated[1]],scope,[]);assert.deepEqual(removed.removed,['c1']);assert.equal(p.resolve('c1'),'c1');p.reset();const restored:any=p.present(first,scope,[]);assert.ok(restored.capabilities);
});
test('navigation sends a complete model contract set instead of misleading unchanged state',()=>{const p=new CapabilityPresenter();const caps=discover(tab,{refs:{e1:{role:'button',name:'Save'}}});p.present(caps,scope,[]);const result:any=p.present(discover({...tab,revision:2},{refs:{e1:{role:'button',name:'Save'}}}),{...scope,revision:2},[]);assert.ok(result.capabilities);assert.notEqual(result.capabilities[0].id,'c1');});
