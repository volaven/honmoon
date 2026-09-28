const {spawn}=require('node:child_process');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),['benchmarks/live-entry.cjs'],{stdio:'inherit',env,windowsHide:false});
child.on('exit',(code,signal)=>{console.log('ELECTRON EXIT',code,signal);process.exit(code===0?0:1)});
