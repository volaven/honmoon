import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tools as toolDefinitions} from '../packages/codex-adapter/index.js';
export async function tokenBenchmark(ctx:any){
 const {browser,adapter,core,fixtureUrl,root,window}=ctx;const rows:any[]=[];window.show();window.focus();
 const cases=[{name:'로컬 테스트 로그인 폼',url:fixtureUrl,kind:'local'},{name:'작은 시작 화면',url:fixtureUrl+'/newtab',kind:'local'},{name:'MDN JavaScript',url:'https://developer.mozilla.org/en-US/docs/Web/JavaScript',kind:'public'},{name:'Wikipedia Web browser',url:'https://en.wikipedia.org/wiki/Web_browser',kind:'public'}];
 for(const item of cases){let id='';try{const tab=item.url===fixtureUrl?browser.tab(browser.activeId()):await browser.create(item.url);id=tab.id;await browser.wait(1500);
  const task=await core.start('Observation benchmark',id,undefined,true);const wc=browser.views.get(id).view.webContents;const samples=[];
  for(let n=0;n<3;n++){const target=await browser.target(id);const full=await adapter.target(target,(c:any)=>c(['snapshot']));const interactive=await adapter.target(target,(c:any)=>c(['snapshot','-i','-c']));const payload=await core.tool('capabilities.list',{},task.id);const oldPayload={tabId:id,origin:task.origin,revision:browser.tab(id).revision,untrusted:true,approval:'Every invocation requires one-time approval in HONMOON UI.',capabilities:core.capabilities.map((c:any)=>({id:c.id,name:c.name,action:c.action,requiredInput:c.inputSchema.required||[],reviewed:c.reviewed})),files:[]};samples.push({fullAX:full.snapshot||JSON.stringify(full),interactiveAX:interactive.snapshot||JSON.stringify(interactive),previousPayload:JSON.stringify(oldPayload),honmoonPayload:JSON.stringify(payload)});}
  rows.push({...item,title:browser.tab(id).title,actualUrl:browser.tab(id).url,capabilityCount:core.capabilities.length,samples,html:await wc.executeJavaScript('document.documentElement.outerHTML'),text:await browser.pageText(id)});console.log('BENCHMARK CAPTURE',item.name,core.capabilities.length);core.cancel('BENCHMARK_COMPLETE');
 }catch(e){rows.push({...item,error:String((e as Error).message)});core.cancel('BENCHMARK_FAILED');}finally{if(id)browser.close(id);}}
 mkdirSync(join(root,'evidence'),{recursive:true});writeFileSync(join(root,'evidence','token-capture.json'),JSON.stringify({at:new Date().toISOString(),toolDefinitions,rows},null,2));
}
