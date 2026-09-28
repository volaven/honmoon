import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';

// Benchmarks reuse the user's authenticated Codex home without reading/copying auth files.
export class BenchmarkCodex extends EventEmitter {
  pending = new Map(); counter = 0;
  constructor(binary, home, workspace) {
    super();
    const env={...process.env};
    for(const key of Object.keys(env))if(key.startsWith('CODEX_'))delete env[key];
    this.child = spawn(binary, ['-c','features.code_mode_host=true','-c','features.code_mode=true','app-server', '--stdio'], {cwd: workspace, windowsHide:true,
      env:{...env,CODEX_HOME:home},stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',()=>{});
    createInterface({input:this.child.stdout}).on('line',line=>{
      let m;try{m=JSON.parse(line);}catch{return;}
      if(m.id!==undefined&&!m.method){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}
      else this.emit('message',m);
    });
    this.child.on('error',e=>this.fail(e));
    this.child.on('exit',()=>this.fail(new Error('Codex process exited')));
  }
  fail(error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
  send(m){if(this.child.stdin.writable)this.child.stdin.write(JSON.stringify(m)+'\n');}
  request(method,params={}){return new Promise((resolve,reject)=>{const id=++this.counter;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(method+' timeout'));},45000);this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
  async initialize(){await this.request('initialize',{clientInfo:{name:'honmoon-benchmark',version:'0.1.0'},capabilities:{experimentalApi:true}});this.send({method:'initialized',params:{}});}
  close(){this.child.kill();this.fail(new Error('Closed'));}
}
