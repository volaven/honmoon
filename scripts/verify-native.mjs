import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {existsSync,cpSync,mkdirSync} from 'node:fs';
import {packageTarget} from './package-target.mjs';
const target=packageTarget();
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(resolve(target.executable),['--self-test'],{env,stdio:'inherit'});
const timeout=setTimeout(()=>{child.kill('SIGKILL');process.exitCode=1;},300000);
child.on('error',error=>{clearTimeout(timeout);console.error(error);process.exitCode=1;});
child.on('exit',code=>{
 clearTimeout(timeout);
 const reports=join(tmpdir(),'honmoon-package-verification','evidence');
 if(existsSync(reports)){mkdirSync('evidence',{recursive:true});cpSync(reports,'evidence',{recursive:true});}
 process.exitCode=code??1;
});
