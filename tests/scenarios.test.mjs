import test from 'node:test';
import assert from 'node:assert/strict';
import {generators} from '../dist/scenarios.js';
import {grade} from '../dist/questions.js';
test('모든 메뉴의 반복 생성, 고유 보기, 정답, 자료 유효성',()=>{
 for(const [mode,generate] of Object.entries(generators)){
  const topics=new Set(),sets=new Set();
  for(let i=0;i<400;i++){
   const exam=generate();sets.add(JSON.stringify(exam));
   assert.equal(exam.questions.length,mode==='education'?8:['ax','knowledge'].includes(mode)?10:4);
   for(const q of exam.questions){
    topics.add(q.topic);assert.ok(q.options.length>=2);assert.equal(new Set(q.options).size,q.options.length,mode+' '+q.topic+' '+q.options);
    assert.ok(q.answer>=0&&q.answer<q.options.length);assert.ok(q.prompt&&q.explanation&&q.hint);
   }
   assert.equal(grade(exam.questions,exam.questions.map(q=>q.answer)).score,100);
   if(mode!=='knowledge')assert.ok(exam.documents.length>=2);
  }
  assert.ok(sets.size>100,mode+' 생성 폭');
  if(!['education'].includes(mode))assert.ok(topics.size>(mode==='knowledge'?10:mode==='ax'?10:4),mode+' 질문 주제 폭');
 }
});
test('AX는 기본 직무역량과 AX 문제해결을 각 5문제 포함',()=>{
 for(let i=0;i<100;i++){
  const exam=generators.ax();
  assert.equal(exam.questions.filter(q=>q.dimension==='기본 직무역량').length,5);
  assert.equal(exam.questions.filter(q=>q.dimension==='AX 문제해결').length,5);
  assert.ok(exam.questions.every(q=>q.difficulty==='상'));
  assert.equal(exam.selection.poolSize,22);
 }
});
test('심화 원장은 기초 자료와 별도 범위임을 표시하고 해설 근거가 존재',()=>{
 for(const [mode,generate] of Object.entries(generators)){
  if(mode==='knowledge')continue;
  const exam=generate(),tables=exam.documents.filter(d=>d.name.startsWith('심화_')&&d.type==='table');
  assert.ok(tables.length>=9);assert.ok(tables.every(d=>d.note.includes('별도 모집단·기간')));
  for(const q of exam.questions)for(const ref of q.evidence)assert.ok(exam.documents.some(d=>d.name===ref.document));
 }
});
