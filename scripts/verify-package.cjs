const {spawn}=require('node:child_process');const {resolve}=require('node:path');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(resolve('release/HONMOON-win32-x64/HONMOON.exe'),['--self-test'],{env,stdio:'inherit',windowsHide:false});child.on('error',e=>{console.error(e);process.exit(1);});child.on('exit',code=>process.exit(code??1));
