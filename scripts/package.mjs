import {packager} from '@electron/packager';
import {build} from 'esbuild';
import {copyFileSync,cpSync,writeFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,existsSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
// Allowlist staging: no source, caches, profiles, unused modules or duplicate binaries.
mkdirSync('.runtime',{recursive:true});
const stage=mkdtempSync(resolve('.runtime/package-'));
const variant=process.env.HONMOON_PACKAGE_VARIANT||'';
if(variant&&!/^media-preview(?:-r\d+)?$/.test(variant))throw Error('Unknown package variant');
const preview=!!variant;
const output=preview?'release/'+variant:'release';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
mkdirSync(join(stage,'dist/main'),{recursive:true});
await build({entryPoints:['main/main.ts'],outfile:join(stage,'dist/main/main.js'),bundle:true,platform:'node',format:'esm',target:'node24',external:['electron'],legalComments:'eof'});
for(const file of ['entry.cjs','preload.cjs','guard.cjs'])copyFileSync('dist/main/'+file,join(stage,'dist/main',file));
cpSync('dist/ui',join(stage,'dist/ui'),{recursive:true});
writeFileSync(join(stage,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,description:pkg.description,main:'dist/main/entry.cjs',type:'module',honmoonVariant:preview?'media-preview':undefined}));
copyFileSync('THIRD_PARTY_NOTICES.md',join(stage,'THIRD_PARTY_NOTICES.md'));
mkdirSync(join(stage,'licenses'));
for(const item of JSON.parse(readFileSync('licenses/npm-production.json','utf8'))){if(!existsSync(item.path))continue;for(const file of readdirSync(item.path).filter(f=>/^(license|copying|notice)(\.|-|$)/i.test(f))){const target=join(stage,'licenses',item.name.replaceAll('/','_')+'-'+file);copyFileSync(join(item.path,file),target);}}
cpSync('node_modules/agent-browser/cli/src/native/a11y',join(stage,'licenses/agent-browser-a11y'),{recursive:true});
copyFileSync('licenses/npm-production.json',join(stage,'licenses/npm-production.json'));
for(const name of ['agent-browser','zod','react','react-dom'])copyFileSync('node_modules/'+name+'/LICENSE',join(stage,'licenses',name+'.txt'));
const paths=await packager({dir:stage,name:'HONMOON',platform:'win32',arch:'x64',electronVersion:pkg.devDependencies.electron,out:output,overwrite:!preview,prune:false,asar:true,
 extraResource:[resolve('dist/mcp/bridge.cjs'),resolve('node_modules/agent-browser/bin/agent-browser-win32-x64.exe')],
 win32metadata:{ProductName:'HONMOON',FileDescription:'HONMOON Chromium Agent Browser',CompanyName:'HONMOON',OriginalFilename:'HONMOON.exe'},
});
for(const path of paths){
 for(const locale of readdirSync(join(path,'locales'))){if(/^[A-Za-z0-9-]+\.pak$/.test(locale)&&!['en-US.pak','ko.pak'].includes(locale))unlinkSync(join(path,'locales',locale));}
 copyFileSync('README.md',join(path,'START-HERE.md'));
 mkdirSync(join(path,'docs'),{recursive:true});for(const doc of ['INTEGRATIONS.md','RELEASE.md','TOKEN-COMPARISON.md','VALIDATION.md','REVISION-2026-09-28.md','COMPACT-EXECUTOR.md','MEDIA-GENERATION.md','MEDIA-VALIDATION.md','TASK-APPROVAL.md'])if(existsSync('docs/'+doc))copyFileSync('docs/'+doc,join(path,'docs',doc));
 copyFileSync('THIRD_PARTY_NOTICES.md',join(path,'THIRD_PARTY_NOTICES.md'));
 writeFileSync(join(path,'Start-HONMOON.cmd'),'@echo off\r\nset ELECTRON_RUN_AS_NODE=\r\nstart "" "%~dp0HONMOON.exe"'+(preview?' --media-preview':'')+'\r\n');
}
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/package-stage.json',JSON.stringify({stage,output,at:new Date().toISOString()},null,2));
console.log(paths.join('\n'));
