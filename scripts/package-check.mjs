import {listPackage,extractFile} from '@electron/asar';
import {readFileSync,existsSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {normalize,join} from 'node:path';
import {packageTarget} from './package-target.mjs';
const target=packageTarget();
const variant=target.variant;
if(variant&&!/^media-preview(?:-r\d+)?$/.test(variant))throw Error('Unknown package variant');
const packageDir=target.directory;
const asar=join(target.resources,'app.asar');
const entries=listPackage(asar).map(p=>p.replaceAll('\\','/'));
assert.ok(!entries.some(p=>/^\/(?:node_modules|\.runtime|evidence|protocol-schema|tests|scripts)(?:\/|$)/.test(p)));
assert.ok(!entries.some(p=>/auth\.json|vault-key|mcp-connection|honmoon\.sqlite/.test(p)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const stage=JSON.parse(readFileSync('evidence/package-stage.json','utf8')).stage;
const paths=['dist/main/main.js','dist/main/entry.cjs','dist/main/preload.cjs','dist/main/guard.cjs'];
for(const p of paths)assert.equal(hash(extractFile(asar,normalize(p))),hash(readFileSync(join(stage,p))),p);
for(const p of entries.filter(p=>p.startsWith('/dist/ui/')&&existsSync(p.slice(1))&&statSync(p.slice(1)).isFile())){try{assert.equal(hash(extractFile(asar,normalize(p.slice(1)))),hash(readFileSync(p.slice(1))));}catch(e){if(e.code!=='EISDIR')throw e;}}
assert.ok(!existsSync(join(target.resources,'app.asar.unpacked')));
assert.equal(hash(readFileSync(join(target.resources,'bridge.cjs'))),hash(readFileSync('dist/mcp/bridge.cjs')));
const native=join(target.resources,target.nativeName);
if(target.platform==='win32')assert.equal(hash(readFileSync(native)),hash(readFileSync('node_modules/agent-browser/bin',target.nativeName)));
else {
 assert.ok(statSync(native).mode&0o111,'Native helper must be executable');
 const {execFileSync}=await import('node:child_process');
 assert.match(execFileSync(native,['--version'],{encoding:'utf8'}),/^agent-browser/);
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',join(packageDir,'HONMOON.app')]);
}
const report={at:new Date().toISOString(),platform:target.platform,arch:target.arch,noProfileOrCredentialData:true,noNodeModules:true,noDuplicateNativeBinary:true,compiledModulesMatch:paths,bridgeMatches:true,asarBytes:statSync(asar).size,executableSha256:hash(readFileSync(target.executable)),asarSha256:hash(readFileSync(asar))};
mkdirSync('evidence',{recursive:true});writeFileSync(variant?`evidence/${variant}-integrity.json`:'evidence/package-integrity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
