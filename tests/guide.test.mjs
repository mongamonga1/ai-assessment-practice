import {questionHtml} from '../dist/exam-ui.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generators} from '../dist/scenarios.js';
import {configureExam,questionType} from '../dist/exam-model.js';
import {grade} from '../dist/questions.js';
import {createPractice,submitHint,selectAnswer,timeLeft,finishPractice,restorePractice} from '../dist/practice.js';
import {assistantRequest} from '../dist/assistant.js';
import {buildMessages,generateReply} from '../lib/assistant.mjs';
import {tokenCount,attachmentTokens,setAttachments} from '../dist/tokens.js';
const state=()=>createPractice(generators.usage(),{interactionMode:'guide',minutes:0});
test('가이드 모드는 공통 지문과 선택한 한 문제만 전송하고 이전 첨부 원문을 제거',()=>{
 const s=state();s.messages=[{source:'openai',input:'앞 질문',reply:'앞 답변',question:0,documents:[{name:'과거파일',text:'PREVIOUS_SECRET_FILE'}],files:[]}];
 let p=assistantRequest(s,'2번 도와줘');assert.deepEqual(p.questions,[]);
 assert.ok(!JSON.stringify(p).includes('PREVIOUS_SECRET_FILE'));
 let messages=buildMessages(p);assert.deepEqual(JSON.parse(messages[1].content).questions,[]);
 s.selectedQuestion=2;s.attachments=[0];
 p=assistantRequest(s,'조건만 설명해줘');assert.equal(p.questions.length,1);assert.equal(p.questions[0].number,3);
 Object.assign(s.exam.questions[2],{expected:'SECRET_KEY',hint:'SECRET_HINT',explanation:'SECRET_EXPLANATION'});
 messages=buildMessages(assistantRequest(s,'왜?'));const raw=JSON.stringify(messages);
 assert.deepEqual(JSON.parse(messages[1].content).questions.map(q=>q.number),[3]);
 for(const secret of ['PREVIOUS_SECRET_FILE','SECRET_KEY','SECRET_HINT','SECRET_EXPLANATION'])assert.ok(!raw.includes(secret));
 assert.throws(()=>buildMessages({...p,questions:[...p.questions,...p.questions]}),e=>e.status===400);
});
test('토크나이저로 20,000토큰 경계를 브라우저 상태와 서버 모두 검사',()=>{
 assert.equal(tokenCount('hello world'),2);
 const s=state(),p=assistantRequest(s,'계산해줘'),exact='a '.repeat(19999)+'a';assert.equal(tokenCount(exact),20000);
 assert.doesNotThrow(()=>buildMessages({...p,documents:[{name:'경계',text:exact}]}));
 assert.throws(()=>buildMessages({...p,documents:[{name:'초과',text:exact+' b'}]}),e=>e.status===413);
 s.exam.documents.push({name:'큰 파일',type:'memo',paragraphs:[exact+' b']});
 assert.equal(setAttachments(s,[s.exam.documents.length-1]).ok,false);assert.deepEqual(s.attachments,[]);
 assert.ok(setAttachments(s,[0]).ok);assert.equal(attachmentTokens(s.exam,[0,0]),attachmentTokens(s.exam,[0]));
});
test('가이드 어시스트는 자동 문제 추론 호출 없이 제공 맥락으로 실제 응답 요청',async()=>{
 const s=state();s.selectedQuestion=3;let calls=0;
 const result=await generateReply(assistantRequest(s,'어떤 자료가 필요해?'),{apiKey:'test-key',fetchImpl:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.equal(body.response_format,undefined);
  assert.deepEqual(JSON.parse(body.messages[1].content).questions.map(q=>q.number),[4]);
  return Response.json({choices:[{message:{content:'이번 질문에 필요한 파일을 첨부하세요.'},finish_reason:'stop'}]});
 }});
 assert.equal(calls,1);assert.deepEqual(result.context.questionNumbers,[4]);
});
test('전송 시점부터 30초·실패 무차감·10턴 기억과 전체 과정 기록 분리',async()=>{
 const s=createPractice(generators.survey(),{interactionMode:'guide',minutes:0,hintLimit:20});
 s.draft='질문';s.attachments=[0];const start=Date.now();let release;
 const pending=submitHint(s,s.draft,start,()=>new Promise(resolve=>release=resolve));
 assert.equal(s.cooldown,start+30000);release({reply:'답변'});await pending;assert.equal(s.hints,19);
 for(let i=1;i<12;i++)assert.equal((await submitHint(s,'다음 질문',s.cooldown,async()=>({reply:'답변'}))).ok,true);
 assert.equal(s.messages.length,10);assert.equal(s.auditLog.length,12);assert.equal(restorePractice(JSON.stringify(s)).hints,8);
 s.draft='재시도';s.attachments=[0];const old=s.cooldown;const failed=await submitHint(s,s.draft,old,async()=>{throw new Error('API 오류');});
 assert.equal(failed.ok,false);assert.equal(s.hints,8);assert.equal(s.cooldown,old);assert.equal(s.draft,'재시도');assert.deepEqual(s.attachments,[0]);
});
test('객관식 선택 저장·채점·종료 잠금과 유형별 세션 복원 검증',()=>{
 const s=state();
 assert.equal(selectAnswer(s,0,s.exam.questions[0].answer),true);
 assert.equal(grade(s.exam.questions,s.answers).correct,1);
 assert.equal(restorePractice(JSON.stringify(s)).answers[0],s.answers[0]);
 const legacy=JSON.parse(JSON.stringify(s));delete legacy.interactionMode;
 assert.equal(restorePractice(JSON.stringify(legacy)).interactionMode,'free');
 for(const type of ['short','essay']){
  const invalid=JSON.parse(JSON.stringify(s));invalid.exam.questions[0].type=type;
  assert.equal(restorePractice(JSON.stringify(invalid)),null);
 }
 const invalid=JSON.parse(JSON.stringify(s));invalid.answers[0]='보고서';assert.equal(restorePractice(JSON.stringify(invalid)),null);
 finishPractice(s);assert.equal(selectAnswer(s,0,0),false);
 const html=questionHtml(s,0);assert.match(html,/role="radio"/);assert.match(html,/disabled/);assert.ok(!html.includes('<textarea'));
 const timed=createPractice(generators.knowledge(),{now:0,minutes:1,interactionMode:'guide'});
 assert.equal(timeLeft(timed,60000),0);assert.equal(selectAnswer(timed,0,0),false);finishPractice(timed,'timeout');assert.equal(timed.completedReason,'timeout');
});
test('모든 메뉴는 객관식이며 가이드 체험은 전체 문항·무제한 시간 제공',()=>{
 for(const generator of Object.values(generators)){
  const exam=configureExam(generator());assert.equal(exam.format,'choice');
  assert.ok(exam.questions.every(q=>questionType(q)==='choice'&&Number.isInteger(q.answer)&&q.options.length>=2));
  const s=createPractice(exam,{interactionMode:'guide',rehearsal:true,minutes:1});
  assert.equal(s.exam.questions.length,exam.questions.length);assert.equal(s.deadline,null);
  assert.ok(!questionHtml(s,0).includes('<textarea'));
 }
 const single=configureExam(generators.survey());single.questions=single.questions.slice(0,1);
 assert.equal(assistantRequest(createPractice(single,{interactionMode:'guide',minutes:0}),'시작 방법').questions.length,1);
 const free=createPractice(generators.knowledge(),{rehearsal:true});assert.equal(free.exam.questions.length,2);
});

test('AI 답변의 표·강조 렌더링에서 HTML·스크립트는 실행할 수 없는 텍스트로 보존',async()=>{
 const {chatHtml}=await import('../dist/chat-format.js');
 const result=chatHtml('**핵심** <script>alert(1)</script>\n| 대안 | 금액 |\n| --- | --- |\n| A | `100` |');
 assert.match(result,/<strong>핵심<\/strong>/);assert.match(result,/<table>/);assert.match(result,/<code>100<\/code>/);assert.ok(!result.includes('<script>'));assert.match(result,/&lt;script&gt;/);
});
