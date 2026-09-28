import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {AgentBrowser} from '../packages/agent-adapter/index.js';
test('known closed Chromium targets reject before starting an automation daemon',async()=>{const dir=mkdtempSync(join(tmpdir(),'honmoon-closed-target-'));const adapter=new AgentBrowser('unused','unused','test',dir);let commands=0;adapter.raw=async()=>{commands++;throw Error('must not run');};try{adapter.invalidateTarget('closed');await assert.rejects(adapter.target('closed',async()=>{}),/대상 탭/);assert.equal(commands,0);}finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('honmoon-closed-target-'));rmSync(dir,{recursive:true,force:true});}});
