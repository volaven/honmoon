const {app}=require('electron');
const {join}=require('node:path');
const {createServer}=require('node:net');
const profile=join(__dirname,'../.runtime/live-benchmark-'+Date.now());
app.setPath('userData',profile);
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>{
 app.commandLine.appendSwitch('remote-debugging-port',String(port));app.commandLine.appendSwitch('remote-debugging-address','127.0.0.1');
 app.whenReady().then(()=>import(process.env.HONMOON_MEDIA_REGRESSION==='1'?'./media-regression.mjs':process.env.HONMOON_BENCH_REGRESSION==='1'?'./compact-regression.mjs':'./live-run.mjs')).catch(e=>{console.error(e);app.exit(1)});
})});
