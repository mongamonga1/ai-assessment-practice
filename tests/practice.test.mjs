import test from 'node:test';import assert from 'node:assert/strict';
import {createPractice,timeLeft,cooldownLeft,selectAnswer,finishPractice,submitHint,restorePractice} from '../dist/practice.js';
import {generators} from '../dist/scenarios.js';
test('사전 체험은 2문제, 무제한 시간이며 본 연습과 상태가 분리됨',()=>{const e=generators.ax(),s=createPractice(e,{rehearsal:true});assert.equal(s.exam.questions.length,2);assert.equal(e.questions.length,10);assert.equal(s.deadline,null);assert.equal(timeLeft(s),null);});
test('타이머는 절대 종료 시각 기준, 새로고침 후에도 남은 시간 유지',()=>{const s=createPractice(generators.survey(),{minutes:1,now:1000});assert.equal(timeLeft(s,1000),60);assert.equal(timeLeft(s,61000),0);assert.equal(timeLeft(restorePractice(JSON.stringify(s)),11000),50);});
test('종료 후 답안·힌트 수정 차단 및 종료 중복 방지',()=>{const s=createPractice(generators.survey(),{minutes:0});assert.equal(selectAnswer(s,0,1),true);assert.equal(finishPractice(s),true);assert.equal(finishPractice(s),false);assert.equal(selectAnswer(s,0,2),false);assert.equal(submitHint(s,'질문').ok,false);assert.equal(s.answers[0],1);});
test('어시스트 문제 선택, 1000자, 30초 재전송, 첨부 재사용 제한, 10회 차감',()=>{const s=createPractice(generators.survey(),{minutes:0});assert.equal(submitHint(s,'a'.repeat(1001),0).ok,false);assert.equal(s.hints,10);s.attachments=[0];assert.equal(submitHint(s,'자료 확인',0).ok,true);assert.equal(s.messages[0].question,null);assert.equal(s.messages[0].files.length,1);assert.equal(s.attachments.length,0);assert.equal(cooldownLeft(s,1000),29);assert.equal(submitHint(s,'추가 질문',29999).ok,false);s.selectedQuestion=1;assert.equal(submitHint(s,'두 번째 문제',30000).ok,true);assert.equal(s.messages[1].question,1);assert.deepEqual(s.messages[1].files,[]);for(let i=2;i<10;i++)assert.equal(submitHint(s,'질문',i*30000).ok,true);assert.equal(s.hints,0);assert.equal(submitHint(s,'초과',300000).ok,false);});
test('답안·메모·문제·첨부·종료 상태 복원 및 손상 데이터 처리',()=>{const s=createPractice(generators.ax(),{minutes:0});s.index=4;s.notes[4]='검수 조건 확인';s.flags[4]=true;selectAnswer(s,4,2);const r=restorePractice(JSON.stringify(s));assert.equal(r.index,4);assert.equal(r.notes[4],s.notes[4]);assert.equal(r.answers[4],2);assert.equal(restorePractice('bad'),null);s.answers[4]=99;assert.equal(restorePractice(JSON.stringify(s)),null);});
test('활용·AX 평가의 어시스트 기본 표시, 모바일 열기와 이전 저장 상태 복구',()=>{
 for(const mode of ['survey','usage','compliance','voc','campaign','procurement','education','ax']){
  const s=createPractice(generators[mode](),{minutes:0});assert.equal(s.assistantOpen,true);assert.equal(s.assistantMobileOpen,false);
  s.assistantOpen=false;assert.equal(restorePractice(JSON.stringify(s)).assistantOpen,false);
  delete s.assistantVisibilityVersion;delete s.assistantMobileOpen;
  const restored=restorePractice(JSON.stringify(s));assert.equal(restored.assistantOpen,true);assert.equal(restored.assistantMobileOpen,false);
 }
 assert.equal(createPractice(generators.knowledge(),{minutes:0}).assistantOpen,false);
});
