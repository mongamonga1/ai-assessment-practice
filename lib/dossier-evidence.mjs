// A deterministic reading aid over the supplied attachments, never an answer key.
// Both ledgers must be present; an unattached source cannot be reconstructed.
const recordId=/^S\d+-R\d+-B\d+-V\d+$/;
const cells=line=>line.split('|').map(v=>v.trim()).slice(0,-1);
const value=text=>/^-?\d+(?:\.\d+)?$/.test(text)?Number(text):text;

export function reconcileDossiers(documents){
 const raw=documents.find(d=>d.name==='02_통합원천기록_접수및수정본'&&typeof d.text==='string');
 const approval=documents.find(d=>d.name==='03_승인대장_버전및범위대사'&&typeof d.text==='string');
 if(!raw||!approval)return null;
 const approved=new Set();
 for(const line of approval.text.split('\n')){
  const row=cells(line);
  if(recordId.test(row[0]||'')&&row[2]==='본 검토'&&row[3]==='승인 유효')approved.add(row[0]);
 }
 const sources=[];let source=null;let excluded=0;
 const rawLines=raw.text.split('\n').filter(line=>{
  const heading=line.match(/^(S\d+) \| (심화_.+_원장)$/);
  if(heading){source={sourceId:heading[1],original:heading[2],columns:[],records:[]};sources.push(source);}
  const row=cells(line);
  if(row[0]==='레코드 ID'&&source)source.columns=row.slice(4);
  if(!recordId.test(row[0]||''))return true;
  if(!approved.has(row[0])){excluded++;return false;}
  if(source)source.records.push({recordId:row[0],entityId:row[1],batchId:row[2],values:row.slice(4).map(value)});
  return true;
 });
 if(!sources.length||sources.some(s=>!s.columns.length||!s.records.length))return null;
 const validApproval=approval.text.split('\n').filter(line=>approved.has(cells(line)[0]));
 return {
  evidence:{rule:'원천 레코드 ID와 승인대장을 대사하여 적용 범위=본 검토 AND 승인 상태=승인 유효만 남긴 원문 발췌. 자료사전의 합산 열만 분할 합계하며 요금·한도 등은 중복 합산하지 않는다. 정답·계산 결과가 아니라 검증 대상 입력값이다.',excludedRecords:excluded,sources},
  rawText:rawLines.join('\n'),
  approvalText:approval.name+'\n레코드 ID | 자료 코드 | 적용 범위 | 승인 상태 | 처리 근거 |\n'+validApproval.join('\n')
 };
}

const read=content=>{try{return JSON.parse(content);}catch{return null;}};
export function reconcileMessages(messages,{cleanSourceView=false,sourceIds=null}={}){
 const documents=messages.filter(m=>m.role==='user').flatMap(m=>read(m.content)?.documents||[]);
 const result=reconcileDossiers(documents);
 if(!result)return messages;
 let lastUser=messages.findLastIndex(m=>m.role==='user');
 return messages.map((message,i)=>{
  if(message.role!=='user')return message;
  const data=read(message.content);
  if(!data||typeof data!=='object')return message;
  if(data.documents)data.documents=data.documents.map(doc=>{
   if(!doc.text)return doc;
   if(cleanSourceView&&doc.name==='02_통합원천기록_접수및수정본')return {...doc,text:result.rawText};
   if(cleanSourceView&&doc.name==='03_승인대장_버전및범위대사')return {...doc,text:result.approvalText};
   return doc;
  });
  if(i===lastUser)data.reconciledEvidence={...result.evidence,sources:sourceIds?result.evidence.sources.filter(source=>sourceIds.has(source.sourceId)):result.evidence.sources};
  return {...message,content:JSON.stringify(data)};
 });
}
