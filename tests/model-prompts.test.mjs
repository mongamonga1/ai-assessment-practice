import test from 'node:test';
import assert from 'node:assert/strict';
import {modelPrompt} from '../dist/model-prompts.js';
import {questionHtml} from '../dist/exam-ui.js';
import {generators} from '../dist/scenarios.js';
import {createPractice,finishPractice} from '../dist/practice.js';

test('모든 유형의 모범 프롬프트는 문제·분석·검증·출력 형식을 담고 1000자 이내',()=>{
 for(const [mode,g] of Object.entries(generators)){
  const seen=new Set();
  for(let round=0;round<20;round++){
   const exam=g();
   exam.questions.forEach((q,i)=>{
    seen.add(q.id);
    const prompt=modelPrompt(exam,i);
    assert.ok(prompt.length<=1000,mode+'/'+q.topic+'/'+prompt.length);
    assert.ok(prompt.includes(q.prompt));assert.match(prompt,/정답 번호·보기 문장/);assert.match(prompt,/탈락 이유/);
    assert.match(prompt,/검산/);
    if(exam.documents.length){
     for(const name of new Set(q.evidence.map(ref=>ref.document)))assert.ok(prompt.includes(name));
     assert.match(prompt,/본 검토 AND 승인 유효/);assert.match(prompt,/B1~B3/);
    }
   });
  }
  assert.equal(seen.size,mode==='knowledge'?21:mode==='ax'?22:18);
 }
});

test('정답·해설을 바꾸어도 모범 프롬프트는 변하지 않고 질문별 계산 접근법은 달라짐',()=>{
 const exam=generators.usage(),before=modelPrompt(exam,0);
 Object.assign(exam.questions[0],{answer:999,explanation:'SECRET_EXPLANATION',hint:'SECRET_HINT',optionReasons:['SECRET_REASON']});
 assert.equal(modelPrompt(exam,0),before);
 const q={topic:'혼합 라이선스 최저비용',prompt:'최소 비용은?',options:['a','b','c','d'],evidence:[]};
 const license=modelPrompt({...exam,questions:[q]},0);
 const precision=modelPrompt({...exam,questions:[{...q,topic:'탐지 재현율'}]},0);
 assert.match(license,/정수 변수/);assert.match(precision,/TP\/\(TP\+FN\)/);assert.notEqual(license,precision);
});

test('모범 프롬프트는 채점 후에만 표시되며 이전 저장 세션도 지원하고 HTML을 이스케이프',()=>{
 const s=createPractice(generators.education(),{minutes:0});
 assert.ok(!questionHtml(s,0).includes('data-copy-prompt'));
 finishPractice(s);const html=questionHtml(s,0);
 assert.match(html,/정답 도출 모범 프롬프트/);assert.match(html,/data-copy-prompt="0"/);assert.match(html,/data-model-prompt-text/);
 delete s.exam.materialProfile;assert.match(questionHtml(s,0),/정답 도출 모범 프롬프트/);
 s.exam.questions[0].prompt='<script>alert(1)</script>';
 const escaped=questionHtml(s,0);assert.ok(!escaped.includes('<script>'));assert.ok(escaped.includes('&lt;script&gt;'));
 s.rehearsal=true;assert.ok(!questionHtml(s,0).includes('data-copy-prompt'));
});
