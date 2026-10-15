import test from 'node:test';
import assert from 'node:assert/strict';
import {createPractice,finishPractice,selectAnswer,submitHint,preparePromptReview,restorePractice,isReview,assistantHistory} from '../dist/practice.js';
import {generators} from '../dist/scenarios.js';
import {modelPrompt} from '../dist/model-prompts.js';
import {grade} from '../dist/questions.js';
import {questionHtml} from '../dist/exam-ui.js';

test('시간 종료·횟수 소진 후에도 복습 가능, 시험 답안·점수·과정·횟수는 보존',async()=>{
 for(const mode of ['guide','free']){
  const s=createPractice(generators.usage(),{minutes:1,now:1000,interactionMode:mode});
  selectAnswer(s,0,1);s.hints=0;s.cooldown=Date.now()+60000;
  s.messages=[{input:'시험 질문',reply:'시험 답변',source:'openai',files:[]}];s.auditLog=[{...s.messages[0]}];
  finishPractice(s,'timeout');const before={answers:[...s.answers],score:grade(s.exam.questions,s.answers),hints:s.hints,cooldown:s.cooldown,messages:structuredClone(s.messages),audit:structuredClone(s.auditLog)};
  assert.equal(isReview(s),true);assert.equal(preparePromptReview(s,0).ok,true);
  assert.equal(s.draft,modelPrompt(s.exam,0));assert.equal(s.selectedQuestion,0);
  const files=new Set(s.exam.questions[0].evidence.map(r=>r.document));
  assert.deepEqual(s.attachments.map(i=>s.exam.documents[i].name),s.exam.documents.filter(d=>files.has(d.name)).map(d=>d.name));
  s.exam.questions[0].explanation='SECRET_EXPLANATION';
  const result=await submitHint(s,s.draft,Date.now(),async payload=>{
   assert.equal(payload.selectedQuestion,0);assert.equal(payload.history.length,0);
   assert.ok(!JSON.stringify(payload).includes('SECRET_EXPLANATION'));
   assert.equal(payload.documents.length,files.size);return {reply:'자료를 검증한 복습 답변'};
  });
  assert.equal(result.ok,true);assert.equal(s.reviewRequests,1);assert.equal(assistantHistory(s)[0].reply,'자료를 검증한 복습 답변');
  assert.equal(selectAnswer(s,0,2),false);assert.deepEqual(s.answers,before.answers);
  assert.deepEqual(grade(s.exam.questions,s.answers),before.score);assert.equal(s.hints,before.hints);assert.equal(s.cooldown,before.cooldown);
  assert.deepEqual(s.messages,before.messages);assert.deepEqual(s.auditLog,before.audit);
  assert.equal(s.draft,'');assert.deepEqual(s.attachments,[]);
  assert.equal(restorePractice(JSON.stringify(s)).reviewMessages.length,1);
 }
});

test('복습 반복 요청·후속 질문은 별도 최근 10턴에 보관하며 새로고침 복원',async()=>{
 const s=createPractice(generators.education(),{minutes:0,hintLimit:1});finishPractice(s);
 for(let i=0;i<12;i++){
  const result=await submitHint(s,'복습 '+i,Date.now(),async payload=>{
   assert.equal(payload.history.length,Math.min(10,i));return {reply:'복습 답변 '+i};
  });assert.equal(result.ok,true);
 }
 assert.equal(s.reviewRequests,12);assert.equal(s.reviewMessages.length,10);assert.equal(s.hints,1);assert.equal(s.auditLog.length,0);
 const restored=restorePractice(JSON.stringify(s));assert.equal(restored.reviewRequests,12);assert.equal(restored.reviewMessages[0].input,'복습 2');
 delete s.reviewMessages;delete s.reviewRequests;
 const old=restorePractice(JSON.stringify(s));assert.deepEqual(old.reviewMessages,[]);assert.equal(old.reviewRequests,0);
 old.reviewRequests=-1;assert.equal(restorePractice(JSON.stringify(old)),null);
});

test('복습 실패 시 질문·첨부 유지, 동시 재실행 차단, 자료 없는 지식평가도 지원',async()=>{
 const s=createPractice(generators.survey(),{minutes:0});
 assert.equal(preparePromptReview(s,0).ok,false);finishPractice(s);
 assert.equal(preparePromptReview(s,0).ok,true);const draft=s.draft,files=[...s.attachments];
 const failed=await submitHint(s,s.draft,Date.now(),async()=>{throw new Error('연결 오류');});
 assert.equal(failed.ok,false);assert.equal(s.draft,draft);assert.deepEqual(s.attachments,files);assert.equal(s.reviewRequests,0);
 let release;const pending=submitHint(s,s.draft,Date.now(),()=>new Promise(resolve=>release=resolve));
 assert.equal(preparePromptReview(s,1).ok,false);assert.equal((await submitHint(s,'중복')).ok,false);
 release({reply:'완료'});await pending;assert.equal(s.reviewRequests,1);
 const knowledge=createPractice(generators.knowledge(),{minutes:0});finishPractice(knowledge);
 assert.equal(preparePromptReview(knowledge,0).ok,true);assert.equal(knowledge.assistantOpen,true);assert.deepEqual(knowledge.attachments,[]);
 assert.equal((await submitHint(knowledge,knowledge.draft,Date.now(),async()=>({reply:'개념 검증'}))).ok,true);
 assert.match(questionHtml(knowledge,0),/data-retry-prompt="0"/);
 const rehearsal=createPractice(generators.survey(),{rehearsal:true});finishPractice(rehearsal);
 assert.equal(preparePromptReview(rehearsal,0).ok,false);assert.equal((await submitHint(rehearsal,'질문')).ok,false);
});
