import type {MediaPage,MediaSite} from '../packages/core/media-contract.js';
import {mediaRules} from '../packages/core/media-contract.js';
// Serialized into an isolated Chromium world. This function only reads DOM.
export function readMediaDom(arg:{site:MediaSite;rule:typeof mediaRules[MediaSite]}):MediaPage{
 const doc=(globalThis as any).document;const win=globalThis as any;const rule=arg.rule;
 const visible=(e:any)=>!!e.getClientRects().length&&win.getComputedStyle(e).visibility!=='hidden'&&win.getComputedStyle(e).display!=='none';
 const accessibleText=(e:any):string=>!e?'':e.nodeType===3?e.textContent:e.getAttribute?.('aria-hidden')==='true'||['SCRIPT','STYLE','MAT-ICON'].includes(e.tagName)?'':[...e.childNodes||[]].map(accessibleText).join(' ');
 const name=(e:any)=>String(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map((id:string)=>accessibleText(doc.getElementById(id))).join(' ').trim()||accessibleText(e.labels?.[0])||e.getAttribute('title')||accessibleText(e)||'').replace(/\s+/g,' ').trim().slice(0,180);
 const cache=win.__honmoonMediaIds||(win.__honmoonMediaIds={ids:new WeakMap(),next:0});
 const selector=(e:any)=>{const p:string[]=[];let n=e;while(n&&n.nodeType===1){const tag=n.tagName.toLowerCase();const siblings=[...n.parentElement?.children||[]].filter((x:any)=>x.tagName===n.tagName);p.unshift(tag+':nth-of-type('+Math.max(1,siblings.indexOf(n)+1)+')');n=n.parentElement;}return p.join(' > ');};
 // ProseMirror inserts a trailing <br> into an empty paragraph. It is not prompt text.
 const editableText=(e:any):string=>{if(!e.textContent)return '';const walk=(n:any):string=>n.nodeType===3?n.textContent:n.classList?.contains('ProseMirror-trailingBreak')?'':n.tagName==='BR'?'\n':[...n.childNodes||[]].map(walk).join('');const blocks=[...e.children];return blocks.length&&blocks.every((n:any)=>['P','DIV'].includes(n.tagName))?blocks.map(walk).join('\n'):walk(e);};
 const control=(e:any)=>{if(!cache.ids.has(e))cache.ids.set(e,'m'+(++cache.next));const group=e.closest('[role="radiogroup"],[role="group"],[role="menu"],fieldset');return {key:cache.ids.get(e),focused:doc.activeElement===e,selector:selector(e),name:name(e),role:e.getAttribute('role')||(e.isContentEditable?'textbox':({BUTTON:'button',SELECT:'combobox',TEXTAREA:'textbox'} as any)[e.tagName])||(e.type==='file'?'file':e.type==='radio'?'radio':e.type==='checkbox'?'checkbox':'textbox'),scope:group?(group.getAttribute('aria-label')||group.getAttribute('aria-labelledby')||group.tagName):'',value:String(e.isContentEditable?editableText(e):e.tagName==='BUTTON'?e.innerText:e.value||''),checked:e.checked===true||e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-selected')==='true'||e.getAttribute('aria-pressed')==='true'||e.getAttribute('data-state')==='checked',disabled:!!e.disabled||e.getAttribute('aria-disabled')==='true',hidden:!visible(e)};};
 const editors=[...doc.querySelectorAll(rule.editor)].filter(visible);const editor=editors.length===1?editors[0]:undefined;
 let composer=editor?.closest('form')||editor?.parentElement;while(composer&&composer.tagName!=='FORM'&&composer!==doc.body&&!(composer.querySelector('button')&&composer.querySelectorAll(rule.editor).length===1))composer=composer.parentElement;
 const nodes=[...doc.querySelectorAll('button,input,textarea,select,[role="radio"],[role="menuitemradio"],[role="menuitem"],[role="option"],[role="checkbox"]')].filter((e:any)=>visible(e)||(e.type==='file'&&composer?.contains(e)));
 // On Grok post pages both the result toolbar and composer have e.g. ratio buttons.
 // Only the composer and its open portalled menus are preparation controls.
 const controls=nodes.filter((e:any)=>arg.site!=='grok'||composer?.contains(e)||e.closest('[role="menu"],[role="listbox"]')).slice(0,500).map(control);
 const containers=[...doc.querySelectorAll(arg.site==='grok'?'a[href*="/imagine/post/"],[data-testid="media-card"],article':'flow-grid-tile-container,[data-testid="media-card"],flow-image-tile,flow-video-tile')].filter((e:any)=>visible(e)&&e.querySelector('img,video'));
 const urls=(elements:any[])=>[...new Set<string>(elements.map((m:any)=>m.currentSrc||m.src).filter(Boolean))];
 const results:MediaPage['results']=containers.filter((e:any)=>!containers.some((c:any)=>c!==e&&e.contains(c))).map((e:any)=>{const rawId=e.querySelector('[data-media-id]')?.getAttribute('data-media-id')||e.getAttribute('data-media-id')||e.getAttribute('href')||e.getAttribute('data-testid')+':'+selector(e);const id=rawId.match(/\/imagine\/post\/([a-f0-9-]{36})/i)?.[1]||rawId;const imageMedia=urls([...e.querySelectorAll('img')]);const videoMedia=urls([...e.querySelectorAll('video')]);const media=[...imageMedia,...videoMedia];return {id,selector:selector(e),opener:control(e),media,imageMedia,videoMedia,ready:media.length>0&&[...e.querySelectorAll('img,video')].every((m:any)=>m.tagName==='VIDEO'?m.readyState>=2:m.complete&&m.naturalWidth>0),busy:!!e.querySelector('[role="progressbar"],[aria-busy="true"]'),failed:/생성 실패|generation failed|could not generate/i.test(e.innerText||''),downloads:[...e.querySelectorAll('button,a[download],[role="menuitem"]')].filter(visible).filter((b:any)=>(rule.download as readonly string[]).includes(name(b))||b.hasAttribute('download')).map(control)};});
 if(arg.site==='grok'){
  const id=win.location.pathname.match(/^\/imagine\/post\/([a-f0-9-]{36})\/?$/i)?.[1];
  const main=doc.querySelector('main');
  if(id&&main){
   // Bind the viewer to the post ID. Exclude template media, filmstrip thumbnails,
   // composer attachments and unrelated saved posts, even when visible.
   const mediaNodes=[...main.querySelectorAll('img,video')].filter((m:any)=>visible(m)&&!composer?.contains(m)&&(()=>{try{return new URL(m.currentSrc||m.src).pathname.split('/').includes(id);}catch{return false;}})());
   const imageMedia=urls(mediaNodes.filter((m:any)=>m.tagName==='IMG'));
   const videoNodes=mediaNodes.filter((m:any)=>m.tagName==='VIDEO');const videoMedia=urls(videoNodes);
   const downloads=[...main.querySelectorAll('button,a[download]')].filter((b:any)=>visible(b)&&!composer?.contains(b)&&(rule.download as readonly string[]).includes(name(b))).map(control);
   if(mediaNodes.length){results.splice(0,results.length);results.push({id,selector:selector(main),media:[...imageMedia,...videoMedia],imageMedia,videoMedia,ready:videoNodes.length?videoNodes.every((m:any)=>m.readyState>=2):mediaNodes.every((m:any)=>m.complete&&m.naturalWidth>0),busy:!!main.querySelector('[role="progressbar"],[aria-busy="true"]'),failed:/생성 실패|generation failed|could not generate/i.test(main.innerText||''),downloads});}
  }
 }
 if(arg.site==='flow'&&/\/edit\//.test(win.location.pathname)){const media=doc.querySelector('img[data-media-id],video[data-media-id]');if(media){const id=media.getAttribute('data-media-id');const existing=results.find((r:any)=>r.id===id);const downloads=controls.filter(c=>['미디어 다운로드','Download media'].includes(c.name));if(existing)existing.downloads=downloads;}}
 const attachments=composer?[...composer.querySelectorAll('img')].filter(visible).map((e:any)=>e.currentSrc||e.src).filter(Boolean):[];
 const costNodes=[...doc.querySelectorAll('a[href*="credit"],[data-testid*="credit"],[role="dialog"],[role="menu"]')].filter(visible);const cost=costNodes.map((e:any)=>e.parentElement?.innerText||e.innerText||'').join('\n').match(/(?:\d[\d,.]*\s*(?:크레딧|credits)|(?:크레딧|credits)\s*:?\s*\d[\d,.]*)/gi)?.join('; ')||'비용 확인 불가';
 const settings=controls.filter(c=>c.checked).map(c=>c.scope+': '+c.name);
 for(const c of controls)if(c.role==='button'&&[...rule.settings,...Object.values(rule.menus).flat()].includes(c.name as never))settings.push(c.name+': '+c.value);
 return {site:arg.site,version:rule.version,url:win.location.href,editor:editor?control(editor):undefined,controls,results,attachments,cost,settings,problem:editors.length!==1?'unsupported_screen: 프롬프트 편집기를 유일하게 식별하지 못했습니다.':undefined};
}
