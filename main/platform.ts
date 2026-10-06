import {join} from 'node:path';

export function agentBrowserName(platform:string=process.platform,arch:string=process.arch){
 if(platform==='win32'&&arch==='x64')return 'agent-browser-win32-x64.exe';
 if(platform==='darwin'&&['arm64','x64'].includes(arch))return `agent-browser-darwin-${arch}`;
 throw new Error(`지원하지 않는 플랫폼입니다: ${platform}/${arch}`);
}

export function runtimePath(path=process.env.PATH||'',platform:string=process.platform){
 if(platform!=='darwin')return path;
 // Finder launches do not inherit the terminal's Homebrew PATH.
 return [...new Set([...path.split(':'),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin'].filter(Boolean))].join(':');
}

export function codexPaths(path=process.env.PATH||'',platform:string=process.platform){
 const separator=platform==='win32'?';':':';
 const name=platform==='win32'?'codex.exe':'codex';
 return runtimePath(path,platform).split(separator).filter(Boolean).map(dir=>join(dir,name));
}

export function packageLayout(platform:string,arch:string,variant=''){
 agentBrowserName(platform,arch);
 if(variant&&!/^media-preview(?:-r\d+)?$/.test(variant))throw Error('Unknown package variant');
 const directory=join('release',variant,`HONMOON-${platform}-${arch}`);
 return {directory,resources:platform==='darwin'?join(directory,'HONMOON.app','Contents','Resources'):join(directory,'resources'),executable:platform==='darwin'?join(directory,'HONMOON.app','Contents','MacOS','HONMOON'):join(directory,'HONMOON.exe')};
}
