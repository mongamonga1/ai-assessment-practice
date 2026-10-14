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
  const cost=exam.documents[2].rows;
  const expected=cost[0][1]+cost[1][1]*cost[2][1];
  const q=exam.questions.find(q=>q.topic==='총소유비용');if(q)assert.equal(q.options[q.answer],expected+'만원');
 }
});
test('설문 분모·구매 수량·교육 가중평균을 자료로 재계산',()=>{
 for(let i=0;i<200;i++){
  const exam=generators.survey(),rows=exam.documents[0].rows,total=rows.reduce((sum,r)=>sum+r[1],0);
  const max=Math.max(...rows.map(r=>r[1]));
  const q=exam.questions.find(q=>q.topic==='선호도 비율');if(q)assert.equal(q.options[q.answer],(max/total*100).toFixed(1)+'%');
  const edu=generators.education(),r=edu.documents[0].rows;
  const avg=((r[0][1]*r[0][3]+r[1][1]*r[1][3])/(r[0][1]+r[1][1])).toFixed(1);
  const eq=edu.questions.find(q=>q.topic==='가중평균');assert.equal(eq.options[eq.answer],avg+'점');
 }
});
