export function validateLiveRun(run){
 const s=run.observed;if(!s)return false;
 if(run.caseId==='lookup')return s.selected===17&&s.clicks.length===1&&/23200/.test(run.output.replaceAll(',',''))&&/검토[^.!?\n]*완료/.test(run.output);
 if(run.caseId==='dynamic')return s.title==='한밤 연구소'&&s.ratio==='1:1'&&s.memo==='승인 검토'&&s.saves===1;
 if(run.caseId==='repeat')return s.title==='최종안'&&s.saves===2&&JSON.stringify(s.history)===JSON.stringify(['초안','최종안']);
 if(run.caseId==='form')return s.title==='보라색 연구소'&&s.ratio==='1:1'&&s.saves===1&&s.clicks.length===1;
 return s.title==='혼문 비교 실험'&&s.ratio==='9:16'&&s.saves===1&&s.downloadClicks===1&&run.downloads.length===1&&run.downloads[0].content==='title=혼문 비교 실험\nratio=9:16\n';
}
