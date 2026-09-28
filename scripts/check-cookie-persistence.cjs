const {spawnSync}=require('node:child_process');
const {mkdtempSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const dir=mkdtempSync(join(tmpdir(),'honmoon-cookie-check-'));
const file=join(dir,'check.cjs');
writeFileSync(file,`const {app,session}=require('electron');
app.setPath('userData',${JSON.stringify(join(dir,'profile'))});
app.whenReady().then(async()=>{const s=session.fromPartition('persist:honmoon-default');if(process.argv.includes('--write')){await s.cookies.set({url:'https://fixture.invalid',name:'honmoon_test',value:'local-fixture-only',expirationDate:Date.now()/1000+3600});s.flushStorageData();await s.cookies.flushStore();}else{const rows=await s.cookies.get({url:'https://fixture.invalid',name:'honmoon_test'});if(rows.length!==1||rows[0].value!=='local-fixture-only')throw Error('Cookie did not persist');console.log('COOKIE_PERSISTENCE_PASS');}app.quit();}).catch(e=>{console.error(e.message);app.exit(1);});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
for(const phase of ['--write','--read']){const r=spawnSync(require('electron'),[file,phase],{env,encoding:'utf8',timeout:20000,windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.error||'cookie test failed');if(phase==='--read'&&!r.stdout.includes('COOKIE_PERSISTENCE_PASS'))throw Error('No verification output');}
writeFileSync('evidence/cookie-persistence.json',JSON.stringify({at:new Date().toISOString(),passed:true,scope:'isolated fixture cookie survives two Electron processes; no user cookies read',partition:'persist:honmoon-default'},null,2));console.log('PASS persistent cookie across two Electron launches');
