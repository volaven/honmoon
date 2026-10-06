import {chmodSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export function localTransport(dataDir:string){
 // Darwin's Unix socket path is limited to roughly 104 bytes. Keep even long
 // profile paths out of both the gateway and agent-browser socket addresses.
 const directory=process.platform==='win32'?undefined:mkdtempSync('/tmp/honmoon-');
 if(directory)chmodSync(directory,0o700);
 return {pipe:directory?join(directory,'mcp.sock'):'\\\\.\\pipe\\honmoon-'+randomUUID(),agentHome:directory?join(directory,'agent'):join(dataDir,'agent-browser'),
  secureSocket(){if(directory)chmodSync(join(directory,'mcp.sock'),0o600);},
  connection(file:string,body:unknown){
   writeFileSync(file,JSON.stringify(body),{mode:0o600});
   if(process.platform==='win32')execFileSync('icacls',[file,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(F)`],{windowsHide:true,stdio:'ignore'});
   else chmodSync(file,0o600);
  },
  cleanup(){if(directory)rmSync(directory,{recursive:true,force:true});}
 };
}
