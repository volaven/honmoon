import {ipcRenderer} from 'electron';
window.addEventListener('pointerdown',()=>ipcRenderer.send('honmoon:handoff'));
window.addEventListener('keydown',()=>ipcRenderer.send('honmoon:handoff'));
