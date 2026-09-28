import {app,dialog} from 'electron';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const root=join(__dirname,'../..');
const mediaPreview=process.argv.includes('--media-preview')||require(join(root,'package.json')).honmoonVariant==='media-preview';
const testing=process.argv.includes('--self-test')||process.argv.includes('--token-benchmark');
app.setPath('userData',testing?join(app.isPackaged?app.getPath('temp'):join(root,'.runtime'),'honmoon-test-'+Date.now()):join(app.getPath('appData'),mediaPreview?'HONMOON-Media-Preview':'HONMOON'));
// Keep the preview's stable profile, and exit before initializing a second
// gateway/window against that profile when its launcher is clicked twice.
const primary=testing||app.requestSingleInstanceLock();
if(!primary)app.quit();
if(primary){
const port=execFileSync(process.execPath,['-e',"const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"],{encoding:'utf8',windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}}).trim();
app.commandLine.appendSwitch('remote-debugging-port',port);
app.commandLine.appendSwitch('remote-debugging-address','127.0.0.1');
// Agent input must remain available when another window covers the browser.
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.whenReady().then(()=>import('./main.js')).catch(error=>{console.error(error);if(!testing)dialog.showErrorBox('HONMOON 시작 실패',String(error.message));app.exit(1);});
}
