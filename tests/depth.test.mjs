import test from 'node:test';
import assert from 'node:assert/strict';
import {generators,practiceMenus} from '../dist/scenarios.js';
import {selectFresh,resetQuestionHistory} from '../dist/assessment-engine.js';
import {assistantPacket,documentText} from '../dist/documents.js';

test('업무상황 유지, 169유형 확보, 상황별 확장 자료와 해설 근거 존재',()=>{
 assert.equal(practiceMenus.length,7);
 let types=0;
 for(const [mode,generate] of Object.entries(generators)){
  const first=generate();types+=first.selection.poolSize;
  if(mode!=='knowledge')assert.ok(first.documents.length>=12);
  const seen=new Set();
  for(let i=0;i<20;i++){
   const exam=generate();
   for(const q of exam.questions){
    seen.add(q.id);assert.equal(q.optionReasons.length,q.options.length);
    assert.ok(q.optionReasons.every(r=>r.length>8));
    for(const ref of q.evidence)assert.ok(exam.documents.some(d=>d.name===ref.document));
   }
  }
  assert.equal(seen.size,first.selection.poolSize,mode);
 }
 assert.equal(types,169);
});

test('미출제 우선: 수치·보기 변화와 무관하게 같은 유형을 순환 전 중복하지 않음',()=>{
 resetQuestionHistory();
 const pool=Array.from({length:17},(_,i)=>({id:'topic-'+i,topic:'유형'+i}));
 const seen=new Set();
 for(let round=0;round<5;round++){
  const {questions}=selectFresh('rotation-test',pool,4);
  if(round<4)for(const q of questions)assert.ok(!seen.has(q.id));
  for(const q of questions)seen.add(q.id);
 }
 assert.equal(seen.size,17);
 const a=selectFresh('separate',pool,4),b=selectFresh('separate',pool,4);
 assert.equal(a.questions.filter(x=>b.questions.some(y=>x.id===y.id)).length,0);
});

test('브라우저 저장 이력 복원 및 차단·손상 저장에서 계속 출제',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const data=new Map();
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});
  resetQuestionHistory();const pool=Array.from({length:8},(_,i)=>({id:'p'+i}));
  const first=selectFresh('persist-test',pool,4);
  const reloaded=await import('../dist/assessment-engine.js?reload-for-test');
  const next=reloaded.selectFresh('persist-test',pool,4);
  assert.ok(first.selection.persistent);assert.equal(first.questions.filter(q=>next.questions.some(x=>x.id===q.id)).length,0);
  for(const corrupt of ['broken','[]','{"persist-test":{"p1":{"count":"bad","last":null}}}']){
   data.set('ai-practice-topic-history-v2',corrupt);assert.equal(selectFresh('persist-test',pool,4).questions.length,4);
  }
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked');}});
  assert.equal(selectFresh('blocked',pool,4).selection.persistent,false);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;resetQuestionHistory();}
});

test('첨부 내보내기는 선택 자료 전체와 문제만 포함하며 정답·해설 메타데이터 제외',()=>{
 const exam=generators.education();
 exam.questions[0].explanation='SECRET_EXPLANATION';exam.questions[0].optionReasons=['SECRET_REASON'];
 const indices=exam.documents.map((_,i)=>i),packet=assistantPacket(exam,indices,0,'미확인 항목을 분리해 주세요');
 assert.ok(packet.includes('사용자 검토 요청: 미확인 항목을 분리해 주세요'));
 for(const d of exam.documents)assert.ok(packet.includes(documentText(d)));
 assert.ok(packet.includes(exam.questions[0].prompt));assert.ok(!packet.includes('SECRET_EXPLANATION'));assert.ok(!packet.includes('SECRET_REASON'));
 const single=assistantPacket(exam,[0,0,-1,999]);
 assert.equal(single.split('--- 첨부:').length-1,1);assert.ok(!single.includes(exam.documents.at(-1).name));
 assert.ok(!packet.includes('<table>'));assert.ok(packet.length>4000);
});

test('업무상황별 연속 세트는 문항 유형이 겹치지 않음',()=>{
 resetQuestionHistory();
 for(const [mode,generate] of Object.entries(generators)){
  let previous=generate();
  for(let i=0;i<40;i++){const next=generate();assert.equal(next.questions.filter(q=>previous.questions.some(p=>p.id===q.id)).length,0,mode);previous=next;}
 }
});
