import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKnowledge,generateUsage,grade} from '../dist/questions.js';
test('생성 문항의 정답 인덱스, 보기 유일성, 해설 및 주제 범위',()=>{
  for(let i=0;i<300;i++)for(const generate of [generateKnowledge,generateUsage]){
    const exam=generate();
    assert.equal(exam.questions.length,exam.mode==='knowledge'?10:4);
    assert.equal(new Set(exam.questions.map(q=>q.topic)).size,exam.questions.length);
    for(const q of exam.questions){assert.ok(q.answer>=0&&q.answer<q.options.length);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.explanation.length>20);assert.ok(q.hint);}
    assert.equal(grade(exam.questions,exam.questions.map(q=>q.answer)).score,100);
    assert.equal(grade(exam.questions,exam.questions.map(()=>null)).score,0);
  }
});
test('자료와 최소 크레딧·최저 구독료·절감액 정답이 일치',()=>{
  for(let i=0;i<300;i++){
    const exam=generateUsage(),team=exam.documents[1],roster=exam.documents[3];
    const correct=n=>exam.questions[n].options[exam.questions[n].answer];
    assert.equal(correct(1),`${Math.ceil(team.usage/10000)}개`);
    assert.equal(correct(2),`S1 ${roster.active}개 · 월 USD ${roster.active*20}`);
    assert.equal(correct(3),`USD ${team.cost-roster.active*20}`);
    assert.ok(roster.active*10000>=team.usage);
    assert.equal(roster.active+roster.inactive,team.seats);
  }
});
test('평가 재생성 시 상황과 수치·보기 조합이 달라짐',()=>{
  assert.ok(new Set(Array.from({length:20},()=>JSON.stringify(generateKnowledge()))).size>15);
  assert.ok(new Set(Array.from({length:20},()=>JSON.stringify(generateUsage()))).size>15);
});
test('O/X는 O와 X만 포함하고 오답 및 미응답을 0점 처리',()=>{
  const exam=generateKnowledge();
  for(const q of exam.questions.filter(q=>q.options.length===2))assert.deepEqual(q.options,['O','X']);
  const a=exam.questions.map(q=>(q.answer+1)%q.options.length);assert.equal(grade(exam.questions,a).score,0);
  a[0]=exam.questions[0].answer;assert.equal(grade(exam.questions,a).score,10);
});
