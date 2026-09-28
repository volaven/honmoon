import test from 'node:test';
import assert from 'node:assert/strict';
import {codexEnvironment} from '../packages/codex-adapter/environment.js';
test('dedicated Codex child cannot inherit calling thread desktop tool bridge',()=>{
 const source={PATH:'runtime-path',APPDATA:'appdata',CODEX_HOME:'parent-home',CODEX_THREAD_ID:'parent-thread',CODEX_APP_TOOLS_PIPE_PATH:'private-parent-pipe',CODEX_INTERNAL_ORIGINATOR_OVERRIDE:'desktop'};
 const env=codexEnvironment('honmoon-home',source);
 assert.deepEqual(env,{PATH:'runtime-path',APPDATA:'appdata',CODEX_HOME:'honmoon-home'});
 assert.equal(source.CODEX_APP_TOOLS_PIPE_PATH,'private-parent-pipe');
});
