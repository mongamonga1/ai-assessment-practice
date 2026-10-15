import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdvancedBank} from '../dist/advanced-bank.js';
import {buildDossiers} from '../dist/dossiers.js';
import {generators} from '../dist/scenarios.js';
import {documentText,documentHtml,assistantPacket} from '../dist/documents.js';
import {assistantRequest} from '../dist/assistant.js';
import {attachmentTokens,TOKEN_LIMIT} from '../dist/tokens.js';
import {buildMessages,focusMessages} from '../lib/assistant.mjs';
import {reconcileDossiers,reconcileMessages} from '../lib/dossier-evidence.mjs';

const modes=['survey','usage','compliance','voc','campaign','procurement','education','ax'];
test('승인·범위 대사와 분할 집계로 기존 모든 원장 수치를 정확히 복원',()=>{
 const originalRandom=Math.random;
 try{
  for(const mode of modes)for(let k=1;k<=4;k++){
   Math.random=()=>((k-1)/4+.01);
   const e={mode,title:mode,documents:[]};e.questions=buildAdvancedBank(e);
   const originals=new Map(e.documents.filter(d=>d.type==='table').map(d=>[d.name,structuredClone(d)]));
   const answers=e.questions.map(q=>({answer:q.answer,options:q.options,explanation:q.explanation}));
   buildDossiers(e);
   const approvals=e.documents[2].sections[0].rows;
   const usable=new Set(approvals.filter(r=>r[2]==='본 검토'&&r[3]==='승인 유효').map(r=>r[0]));
   for(const source of e.documents[1].sections){
    const original=originals.get(source.name.split(' | ')[1]);
    const valid=source.rows.filter(row=>usable.has(row[0]));
    // Independently specified count columns: all other columns are snapshots, never additive.
    const countHeaders=new Set(['모집단','유효 응답','품목 P 선택','초기 P 선택','초기 응답','추가 P 선택','추가 응답','건수','표본 수','인원']);
    const entityIds=[...new Set(valid.map(r=>r[1]))].sort();
    assert.equal(entityIds.length,original.rows.length);
    for(const [i,entity] of entityIds.entries()){
     const parts=valid.filter(r=>r[1]===entity);
     assert.equal(new Set(parts.map(r=>r[2])).size,parts.length,'업무·분할별 유효 버전 유일');
     const actual=original.headers.map((header,col)=>{
      const values=parts.map(row=>row[col+4]);
      if(col>0&&countHeaders.has(header)&&typeof values[0]==='number')return values.reduce((a,b)=>a+b,0);
      assert.ok(values.every(v=>v===values[0]),'비합산 항목은 같은 관측값');return values[0];
     });
     assert.deepEqual(actual,original.rows[i],mode+'/'+source.name+'/'+entity);
    }
    assert.ok(source.rows.length>valid.length,'미승인·대체·전월 기록 존재');
   }
   assert.deepEqual(e.questions.map(q=>({answer:q.answer,options:q.options,explanation:q.explanation})),answers);
   for(const q of e.questions){
    assert.ok(q.evidence.some(r=>r.document===e.documents[2].name));
    for(const ref of q.evidence){
     const doc=e.documents.find(d=>d.name===ref.document);assert.ok(doc);
     if(ref.document===e.documents[1].name)assert.ok(documentText(doc).includes(ref.locator.split(' / ')[0]));
    }
   }
  }
 }finally{Math.random=originalRandom;}
});

test('새 세트는 소수의 긴 자료·복수 업무·승인 충돌을 포함하고 전체 첨부도 API 한도 이내',()=>{
 for(const mode of modes)for(let iteration=0;iteration<12;iteration++){
  const exam=generators[mode]();
  assert.equal(exam.documents.length,4);assert.equal(exam.contentVersion,'enterprise-dossier-v2');
  const lengths=exam.documents.map(d=>documentText(d).length);
  assert.ok(lengths.every(n=>n>2000),mode+' 파일별 실질 분량 '+lengths);
  assert.ok(lengths.reduce((a,b)=>a+b,0)>18000,mode+' 총분량');
  if(iteration===0)assert.ok(attachmentTokens(exam,[0,1,2,3])<=TOKEN_LIMIT,mode+' 전체 첨부 토큰 한도');
  assert.ok(exam.materialProfile.sources>=5);assert.ok(exam.materialProfile.sourceRows>=32);
  const s={exam,index:0,selectedQuestion:null,attachments:[0,1,2,3],messages:[]};
  const messages=buildMessages(assistantRequest(s,'자료 핵심과 불일치를 정리해줘'));
  assert.ok(JSON.stringify(messages).length<100000);
  const focused=focusMessages(messages,{scope:'question',questionNumbers:[1],extraDocuments:[]});
  assert.equal(JSON.parse(focused.at(-1).content).documents.length,3,'정책·원장·승인대장 함께 전달');
 }
});

test('뷰어와 TXT는 전체 원문·기록 ID를 보존하고 답안 메타데이터를 포함하지 않음',()=>{
 const exam=generators.education();
 exam.questions[0].explanation='SECRET_EXPLANATION';exam.questions[0].optionReasons=['SECRET_REASON'];
 const packet=assistantPacket(exam,[0,1,2,3],0,'검토표를 작성해줘');
 for(const doc of exam.documents){
  const html=documentHtml(doc);assert.match(html,/dossierSection/);
  for(const section of doc.sections){assert.ok(html.includes(section.name));assert.ok(packet.includes(section.name));}
 }
 for(const row of exam.documents[2].sections[0].rows)assert.ok(packet.includes(row[0]));
 assert.ok(!packet.includes('SECRET_EXPLANATION'));assert.ok(!packet.includes('SECRET_REASON'));
 assert.equal(generators.knowledge().documents.length,0);
});

test('AI 대사 보조는 실제 첨부 두 원문에서만 유효 레코드를 추출하며 요약 시 전체 이력 보존',()=>{
 const exam=generators.usage();
 const documents=exam.documents.map(d=>({name:d.name,text:documentText(d)}));
 const original=structuredClone(documents);
 assert.equal(reconcileDossiers(documents.filter(d=>!d.name.startsWith('03_'))),null);
 const result=reconcileDossiers(documents);assert.ok(result);assert.ok(result.evidence.excludedRecords>0);
 const approval=exam.documents[2].sections[0].rows;
 for(const source of result.evidence.sources)for(const record of source.records){
  const status=approval.find(row=>row[0]===record.recordId);
  assert.equal(status[2],'본 검토');assert.equal(status[3],'승인 유효');
  const raw=exam.documents[1].sections.find(s=>s.name.startsWith(source.sourceId+' | ')).rows.find(r=>r[0]===record.recordId);
  assert.deepEqual(record.values,raw.slice(4));
 }
 const current={role:'user',content:JSON.stringify({documents})};
 const messages=[{role:'system',content:'검토 지침'},{role:'user',content:'이전 질문 원문'},current];
 const summary=reconcileMessages(messages),calculation=reconcileMessages(messages,{cleanSourceView:true});
 assert.equal(summary[1].content,'이전 질문 원문');
 assert.equal(JSON.parse(summary.at(-1).content).documents[1].text,documents[1].text);
 const clean=JSON.parse(calculation.at(-1).content).documents[1].text;
 for(const row of approval.filter(row=>row[2]!=='본 검토'||row[3]!=='승인 유효'))assert.ok(!clean.includes(row[0]+' |'));
 assert.deepEqual(documents,original,'뷰어·내려받기 원문은 변경하지 않음');
 assert.ok(!JSON.stringify(result.evidence).includes('"answer"'));
});
