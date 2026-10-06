import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer,connect} from 'node:net';
import {agentBrowserName,packageLayout,codexPaths,runtimePath} from '../main/platform.js';
import {localTransport} from '../main/local-transport.js';
import {integrationConfigs} from '../main/integrations.js';

test('native package selects only the requested architecture and rejects unsupported targets',()=>{
 assert.equal(agentBrowserName('darwin','arm64'),'agent-browser-darwin-arm64');
 assert.equal(agentBrowserName('darwin','x64'),'agent-browser-darwin-x64');
 assert.equal(agentBrowserName('win32','x64'),'agent-browser-win32-x64.exe');
 assert.throws(()=>agentBrowserName('darwin','universal'));
 assert.throws(()=>agentBrowserName('win32','arm64'));
 assert.throws(()=>packageLayout('darwin','arm64','../../profile'));
 assert.ok(packageLayout('darwin','arm64').resources.endsWith(join('HONMOON.app','Contents','Resources')));
});
test('Finder Codex lookup includes Homebrew without empty or duplicate path entries',()=>{
 assert.equal(runtimePath('/usr/bin:/usr/bin','darwin').split(':').filter(p=>p==='/usr/bin').length,1);
 assert.ok(codexPaths('','darwin').includes(join('/opt/homebrew/bin','codex')));
 assert.equal(runtimePath('C:\\Tools','win32'),'C:\\Tools');
});
test('macOS external MCP configurations preserve application paths containing spaces',()=>{
 const exe='/Users/test/Applications/HONMOON.app/Contents/MacOS/HONMOON';
 const args=['/Users/test/Applications/HONMOON.app/Contents/Resources/bridge.cjs','--connection','/Users/test/Library/Application Support/HONMOON/mcp-connection.json'];
 const config=integrationConfigs(exe,args,{ELECTRON_RUN_AS_NODE:'1'});
 assert.deepEqual(JSON.parse(config.claude).mcpServers.honmoon.args,args);
 assert.ok(config.codex.includes(exe));
});
test('Unix gateway protects credentials and supports paths independent of long profile names',{skip:process.platform==='win32'},async()=>{
 const data=mkdtempSync(join(tmpdir(),'honmoon-transport-test-'));const transport=localTransport(data+'x'.repeat(200));
 const server=createServer(socket=>{socket.end('ok');});
 try{
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(transport.pipe,resolve);});
  transport.secureSocket();
  const file=join(data,'connection.json');transport.connection(file,{pipe:transport.pipe,token:'test-only'});
  assert.equal(statSync(file).mode&0o777,0o600);assert.equal(statSync(transport.pipe).mode&0o777,0o600);
  assert.ok(Buffer.byteLength(transport.pipe)<104);
  assert.equal(JSON.parse(readFileSync(file,'utf8')).token,'test-only');
  const text=await new Promise<string>((resolve,reject)=>{const c=connect(transport.pipe);let data='';c.on('data',b=>data+=b);c.on('end',()=>resolve(data));c.on('error',reject);});
  assert.equal(text,'ok');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));transport.cleanup();rmSync(data,{recursive:true,force:true});}
 assert.equal(existsSync(transport.pipe),false);
});
