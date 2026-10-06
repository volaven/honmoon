import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {codexPaths,runtimePath} from './platform.js';

export function checkBinary(path:string,kind:'codex'|'agent-browser'){
 if(!existsSync(path))throw new Error(`${kind} 실행파일이 없습니다: ${path}`);
 try{const version=execFileSync(path,['--version'],{windowsHide:true,encoding:'utf8',timeout:5000,env:{...process.env,PATH:runtimePath(),ELECTRON_RUN_AS_NODE:undefined}}).trim();if(!version.startsWith(kind==='codex'?'codex-cli':'agent-browser'))throw new Error('지원하지 않는 실행파일');return {path,version};}
 catch(e){throw new Error(`${kind} 실행파일을 시작할 수 없습니다 (${(e as any).code||'VERSION_CHECK_FAILED'}): ${path}`);}
}
export function resolveCodex(dataDir:string){
 const candidates:string[]=[];const settings=join(dataDir,'runtime-settings.json');if(existsSync(settings)){try{const s=JSON.parse(readFileSync(settings,'utf8'));if(s.codexPath)candidates.push(s.codexPath);}catch{}}
 candidates.push(...codexPaths());
 if(process.platform==='win32'){
  try{candidates.push(...execFileSync(join(process.env.SystemRoot||'C:/Windows','System32','where.exe'),['codex.exe'],{encoding:'utf8',windowsHide:true,timeout:3000,stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/));}catch{}
  const base=join(process.env.LOCALAPPDATA||'','OpenAI','Codex','bin');if(existsSync(base))candidates.push(...readdirSync(base).map(d=>join(base,d,'codex.exe')).filter(existsSync).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs));
 }
 for(const path of [...new Set(candidates)]){try{return checkBinary(path,'codex').path;}catch{}}
 throw new Error('실행 가능한 Codex CLI를 찾지 못했습니다. 설정에서 Codex 실행파일 위치를 지정하세요. 웹 탐색과 수동 기능 실행은 계속 사용할 수 있습니다.');
}
