import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),['.',process.argv.includes('--tokens')?'--token-benchmark':'--self-test'],{stdio:'inherit',env,windowsHide:false});child.on('exit',code=>process.exit(code||0));
