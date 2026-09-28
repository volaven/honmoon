import type {Writable} from 'node:stream';
/** GUI launchers may close their output pipe before Electron exits. */
export function guardBrokenPipe(stream:Writable){stream.on('error',(error:NodeJS.ErrnoException)=>{if(error.code!=='EPIPE')throw error;});}
export function guardConsoleOutput(){
 for(const stream of [process.stdout,process.stderr])guardBrokenPipe(stream);
 for(const name of ['log','info','warn','error','debug'] as const){
  const write=console[name].bind(console);
  console[name]=(...args:unknown[])=>{try{write(...args);}catch(error){if((error as NodeJS.ErrnoException).code!=='EPIPE')throw error;}};
 }
}
