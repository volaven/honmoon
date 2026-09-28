import {createServer} from 'node:http';
export async function startBenchmarkFixture(){
  const records=Array.from({length:24},(_,i)=>({id:i+1,name:`자료 ${String(i+1).padStart(2,'0')}`,price:12000+i*700,status:i===16?'검토 완료':'검토 중'}));
  const server=createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/file'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="benchmark-result.txt"'});res.end(`title=${u.searchParams.get('title')}\nratio=${u.searchParams.get('ratio')}\n`);return;}
    const kind=u.pathname.slice(1);
    let body=kind==='lookup'?`<h1>자료 목록</h1>${records.map(r=>`<article><h2>${r.name}</h2><p>작업 자료와 검토 상태를 관리하는 항목입니다. 세부 정보를 열어 가격과 상태를 확인하세요.</p><button data-id="${r.id}" onclick="showRecord(${r.id})">${r.name} 열기</button></article>`).join('')}<section id="detail" aria-live="polite"></section>`:
      `<h1>${kind==='download'?'결과 파일 만들기':'작업 설정'}</h1><label>제목 <input aria-label="제목" id="title"></label><label>화면 비율 <select aria-label="화면 비율" id="ratio"><option>16:9</option><option>1:1</option><option>9:16</option></select></label><button id="save" onclick="save()">${kind==='download'?'결과 파일 만들기':'설정 저장'}</button><p id="status" role="status">준비</p><div id="result"></div>`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>HONMOON 비교 실험 · ${kind}</title><style>body{font:16px system-ui;max-width:900px;margin:35px auto;background:#17121d;color:#eee}label{display:block;margin:20px 0}input,select,button{font:inherit;padding:12px;margin:6px}article{display:inline-block;vertical-align:top;width:260px;margin:10px}#detail{padding:25px;border-top:1px solid #83639d}</style><p>로컬 비교 실험 · 실제 결제 및 외부 전송 없음</p>${body}<script>
    window.benchmarkState={clicks:[],saves:0,downloadClicks:0,history:[]};
    document.addEventListener('click',e=>{if(e.target.tagName==='BUTTON'||e.target.tagName==='A')benchmarkState.clicks.push(e.target.textContent)},true);
    const records=${JSON.stringify(records)};
    function showRecord(id){const r=records.find(x=>x.id===id);benchmarkState.selected=id;document.querySelector('#detail').textContent=r.name+' 상세: 가격 '+r.price+'원, 상태 '+r.status;document.querySelector('#detail').scrollIntoView()}
    if(${JSON.stringify(kind)}==='dynamic')document.querySelector('#ratio').onchange=()=>{if(document.querySelector('#ratio').value==='1:1'&&!document.querySelector('#memo')){const label=document.createElement('label');label.textContent='상세 메모';const input=document.createElement('input');input.id='memo';input.setAttribute('aria-label','상세 메모');label.append(input);document.querySelector('#save').before(label)}};
    function save(){const title=document.querySelector('#title').value,ratio=document.querySelector('#ratio').value;benchmarkState.saves++;benchmarkState.history.push(title);benchmarkState.memo=document.querySelector('#memo')?.value;benchmarkState.title=title;benchmarkState.ratio=ratio;document.querySelector('#status').textContent='저장 완료: '+title+' / '+ratio;
      if(${JSON.stringify(kind)}==='download'){const a=document.createElement('a');a.textContent='결과 다운로드';a.href='/file?title='+encodeURIComponent(title)+'&ratio='+encodeURIComponent(ratio);a.onclick=()=>benchmarkState.downloadClicks++;document.querySelector('#result').replaceChildren(a)}}
    </script></html>`);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
