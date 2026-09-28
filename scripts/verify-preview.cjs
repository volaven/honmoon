const {spawn}=require('node:child_process');
const {openSync,closeSync,mkdirSync}=require('node:fs');
const {resolve}=require('node:path');
const variant=process.argv[2]||'media-preview-r4';if(!/^media-preview-r\d+$/.test(variant))throw Error('Invalid preview');
mkdirSync('evidence',{recursive:true});const out=openSync(`evidence/${variant}-verify.stdout.log`,'w');const err=openSync(`evidence/${variant}-verify.stderr.log`,'w');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(resolve(`release/${variant}/HONMOON-win32-x64/HONMOON.exe`),['--self-test'],{env,stdio:['ignore',out,err],windowsHide:true});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>{closeSync(out);closeSync(err);console.log('PREVIEW SELFTEST EXIT',code);process.exitCode=code??1;});
