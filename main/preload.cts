import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('honmoon',{call:(method:string,args:unknown={})=>ipcRenderer.invoke('honmoon',method,args),subscribe:(fn:(state:unknown)=>void)=>{const listener=(_event:unknown,state:unknown)=>fn(state);ipcRenderer.on('honmoon:state',listener);return ()=>ipcRenderer.removeListener('honmoon:state',listener);}});
