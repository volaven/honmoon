import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MediaDownloadGate} from '../packages/core/media-download.js';
import {isVideo} from '../packages/core/media-runner.js';
const id='11111111-2222-4333-8444-555555555555';
test('Grok blob download is bound to the exact tab, origin, result filename and single event',()=>{const g=new MediaDownloadGate();const token=g.arm('tab',id,'https://grok.com');const url='blob:https://grok.com/random';const name=`grok-video-${id}.mp4`;assert.equal(g.claim('wrong',url,name),undefined);assert.equal(g.claim('tab','blob:https://other.com/random',name),undefined);assert.equal(g.claim('tab',url,'unrelated.mp4'),undefined);assert.equal(g.claim('tab',url,name),token);assert.equal(g.claim('tab',url,name),undefined);});
test('cancelled download binding cannot be consumed by a later event',()=>{const g=new MediaDownloadGate();g.arm('tab',id,'https://grok.com');g.clear();assert.equal(g.claim('tab','blob:https://grok.com/x',`grok-video-${id}.mp4`),undefined);});
test('video validation rejects a bare ftyp or truncated file and accepts a real video track',()=>{const mp4=readFileSync('benchmarks/fixtures/grok-test.mp4');assert.equal(isVideo(mp4),true);assert.equal(isVideo(mp4.subarray(0,64)),false);assert.equal(isVideo(Buffer.from('0000ftypavif0000000000000000000000000000')),false);});
