import {createNavigation} from './navigation.js?v=20261016-history1';
import {modelPrompt} from './model-prompts.js?v=20261015-review1';
import {chatHtml} from './chat-format.js?v=20261015-review1';
import {configureExam,typeLabel,answered,isCorrect,processSummary} from './exam-model.js?v=20261015-review1';
import {questionHtml} from './exam-ui.js?v=20261015-review1';
import {attachmentTokens,documentTokens,setAttachments} from './tokens.js?v=20261015-review1';
import { grade } from "./questions.js?v=20261015-review1";
import { practiceMenus, generators } from "./scenarios.js?v=20261015-review1";
import {
  escape,
  documentHtml,
  documentText,
  assistantPacket,
} from "./documents.js?v=20261015-review1";
import {
  createPractice,
  timeLeft,
  cooldownLeft,
  selectAnswer,
  finishPractice,
  submitHint,
  restorePractice,
  hintPending,
  isReview,
  assistantHistory,
  preparePromptReview,
} from "./practice.js?v=20261015-review1";
import { answerTemplates } from "./assistant.js?v=20261015-review1";
const $ = (selector) => document.querySelector(selector),
  app = $("#app"),
  storageKey = "ai-practice-session-v1";
let s = null,
  view = "menu",
  dialogAction = null,
  saveOK = true,
  assistantError = "",
  assistantStatus = "연결 확인 중";
fetch("/api/assistant/status")
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((data) => {
    assistantStatus = data.configured
      ? "gpt-4o-mini · 실제 AI"
      : "API 키 설정 필요";
    if (view === "exam" && s) rerender();
  })
  .catch(() => {
    assistantStatus = "로컬 서버 실행 필요";
    if (view === "exam" && s) rerender();
  });
try {
  s = restorePractice(sessionStorage.getItem(storageKey));
} catch {
  saveOK = false;
}
const utility = document.createElement("dialog");
utility.id = "utilityDialog";
document.body.append(utility);
utility.addEventListener("close", () => {
  if (view === "exam" && s) rerender();
});
function save() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(s));
    saveOK = true;
  } catch {
    saveOK = false;
  }
  if ($("#saveState"))
    $("#saveState").textContent = saveOK
      ? "현재 탭에 자동 저장됨"
      : "자동 저장 불가 · 탭을 유지하세요";
}
function confirmAction(title, text, action) {
  $("#dialogTitle").textContent = title;
  $("#dialogText").textContent = text;
  dialogAction = action;
  $("#confirmDialog").showModal();
}
$("#cancelDialog").onclick = () => $("#confirmDialog").close();
$("#acceptDialog").onclick = () => {
  $("#confirmDialog").close();
  dialogAction?.();
};
function utilityContent(title, html) {
  utility.innerHTML = `<h2>${escape(title)}</h2>${html}<div class="dialogActions"><button id="closeUtility">닫기</button></div>`;
  $("#closeUtility").onclick = () => utility.close();
  utility.showModal();
}
const guideBody = `<ol class="guideSteps"><li>가이드 맞춤: 공통 지문 아래 여러 문제가 있으면 선택 전에는 공통 지문만 전달됩니다. 단일 문제는 자동 전달됩니다. 패널의 문제 선택에서 대상을 지정하세요. 자유 연습은 질문·대화·현재 문제를 자동 해석합니다.</li><li>파일 목록에서 원문을 읽고 AI 질문에 추가하세요. 가이드 맞춤의 첨부는 질문당 최대 20,000토큰이며 이전 첨부 원문은 기억하지 않습니다. 파일을 검증하려면 매번 다시 첨부하세요.</li><li>질문은 최대 1,000자, 최근 10개 대화 쌍을 기억합니다. 가이드 맞춤은 전송 시점부터 30초 대기하며 그동안 다음 질문·첨부를 준비할 수 있습니다. 시스템 오류는 횟수에서 차감하지 않습니다.</li><li>객관식은 번호 선택 즉시 저장합니다. 이 연습은 모든 문항을 객관식으로 유지합니다. 실제 시험에는 단답형·서술형도 있지만 이 연습의 응답 유형에는 포함하지 않습니다.</li><li>다시 풀 문제를 깃발로 표시하고 내 답안에서 미응답을 확인하세요. 시간 종료 시 저장된 답안으로 자동 종료되며 이후 수정할 수 없습니다.</li><li>시간 제한 없는 사전 체험은 채점·결과 리포트가 없습니다. 본 연습의 객관식 점수와 과정 기록은 자체 학습 기능입니다.</li></ol><p>공식 체험은 시간 제한·화상 감독이 없고 실제 시험의 시간·질문 횟수·감독 여부는 주최 측 설정에 따릅니다. 이 사이트는 가상 자료로 조작과 문제 해결을 연습하며, 감독·신원 인증·공식 과정 채점은 수행하지 않습니다. 공식 시험에서는 허용된 AI 어시스트만 이용해야 합니다.</p><p>연습용 GPT는 로컬 서버에서 동작합니다. 질문·현재 허용된 문제·이번 첨부·대화 텍스트가 OpenAI로 전송됩니다. 정답표·선택 답안·메모는 보내지 않습니다. 공식 모델·내부 프롬프트·점수와 동일하다고 보장하지 않습니다.</p><p><a href="https://user-guide.grepp.co/ko/articles/AI-%EC%97%AD%EB%9F%89%ED%8F%89%EA%B0%80-0ff4a226" target="_blank" rel="noopener">공식 AI 응시 가이드</a> · <a href="https://programmers.co.kr/ai-assessment/preview" target="_blank" rel="noopener">공식 환경 체험</a></p>`;
function showGuide() {
 const sections=[['풀이·답안','객관식은 보기 선택 즉시 저장됩니다. 실제 단답형·서술형 유형은 이 연습에서 객관식 상황 판단으로 대체합니다. 문제 이동과 깃발 표시 후 내 답안에서 미제출을 점검하세요.'],['AI 어시스트','가이드 맞춤은 공통 지문과 선택한 문제만 전달합니다. 단일 문제는 자동 전달됩니다. 이번 질문에 첨부한 파일만 읽으며 이전 파일 원문은 기억하지 않습니다. 질문 1,000자, 첨부 20,000토큰, 최근 10턴 기억, 전송부터 30초 대기를 적용합니다. 자유 연습은 자동 맥락과 이전 첨부 참고를 지원합니다.'],['진행·유의사항','공식 공개 체험에는 시간 제한·화상 감독이 없고 실제 시험 설정은 주최 측에 따릅니다. 이 연습의 점수·과정 기록은 공식 평가와 다릅니다. 공식 시험에서는 허용된 AI만 사용하고 답변을 원문으로 교차 검증하세요. 지문·문제·자료 뷰어의 복사를 제한하며 답안 입력과 AI 대화는 사용할 수 있습니다.']];
 utilityContent('유형별 연습 가이드',`<div class="guideTabs" role="tablist" aria-label="가이드 항목">${sections.map(([name],i)=>`<button role="tab" id="guideTab${i}" aria-controls="guideContent${i}" aria-selected="${i===0}" data-guide-tab="${i}">${name}</button>`).join('')}</div>${sections.map(([name,text],i)=>`<section role="tabpanel" id="guideContent${i}" aria-labelledby="guideTab${i}" ${i===0?'':'hidden'}><h3>${name}</h3><p>${text}</p></section>`).join('')}<details><summary>전체 가이드와 출처</summary>${guideBody}</details>`);
 document.querySelectorAll('[data-guide-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-guide-tab]').forEach(el=>el.setAttribute('aria-selected',String(el===b)));sections.forEach((_,i)=>$('#guideContent'+i).hidden=i!==Number(b.dataset.guideTab));});
}
$("#home").onclick = $("#menuButton").onclick = () => {
  if (s && !s.graded && view === "exam")
    confirmAction(
      "평가 메뉴로 이동",
      "현재 연습은 저장되고 제한 시간은 계속 흐릅니다. 메뉴에서 이어서 풀 수 있습니다.",
      menu,
    );
  else menu();
};
$("#exit").onclick = () =>
  view === "exam" && s && !s.graded ? review(true) : menu();
function menu() {
  navigation.show({screen:'menu'});
  view = "menu";
  $("#menuButton").textContent = "평가 메뉴";
  $("#examTitle").textContent = "AI 역량평가 연습";
  $("#exit").textContent = "이용 가이드";
  $("#exit").onclick = showGuide;
  const row = (mode, title, description, count) =>
    `<section class="menuRow"><div><h2>${title}</h2><p>${description}<br>객관식 ${count}문제 · ${mode === "knowledge" ? "개념 및 상황 판단" : "업무 자료 + AI 어시스트(gpt-4o-mini)"}</p></div><button class="primary" data-start="${mode}">체험 진행하기 ›</button></section>`;
  app.innerHTML = `<main class="menu"><h1>AI 역량평가 연습</h1>${s ? `<div class="resumeRow"><span>${escape(s.exam.title)}${s.exam.mode === "knowledge" ? "" : s.exam.materialProfile ? " · 통합 심층 자료" : s.exam.contentVersion ? " · 이전 자료(새 연습에 통합 자료 적용)" : " · 이전 난이도(새 연습에 상향 적용)"} · ${s.graded ? "종료됨" : "진행 중"}</span><button id="resume">${s.graded ? "결과 확인" : "이어서 풀기"}</button></div>` : ""}${row("ax", "AX 직무역량평가 · B2B 컨설팅 & 영업", "KT 채용공고 참고 · 기본 직무역량 5문제 + AX 문제해결 5문제", 10)}<h2 class="menuGroup">AI 활용평가 · 비개발 직군 업무 상황</h2>${practiceMenus.map(([mode, title, desc, count]) => row(mode, title, desc, count)).join("")}<h2 class="menuGroup">AI 지식평가</h2>${row("knowledge", "AI 기본 개념 및 실무 적용", "생성형 AI · 검증 · 보안 · 프롬프트 · 업무 판단", 10)}<p class="menuNote">새 연습에서는 자료·수치·조건과 질문을 새로 조합합니다. 첫 화면에서 평가를 선택하세요. 저장된 연습은 ‘이어서 풀기’ 또는 ‘결과 확인’으로 열 수 있습니다.<br>공식 KT·프로그래머스 시험이 아닌 가상 자료 기반 객관식 연습입니다. 어시스트는 로컬 서버와 API 키 설정 후 gpt-4o-mini로 답합니다.</p><details class="sources"><summary>참고 자료</summary><p><a href="https://user-guide.grepp.co/ko" target="_blank" rel="noopener">공식 응시자 가이드</a><a href="https://kt.recruiter.co.kr/career/jobs/125780" target="_blank" rel="noopener">KT 채용공고</a><a href="https://programmers.co.kr/ai-assessment?locale=ko" target="_blank" rel="noopener">프로그래머스 AI 평가</a></p></details></main>`;
  document
    .querySelectorAll("[data-start]")
    .forEach((b) => (b.onclick = () => prepare(b.dataset.start)));
  if ($("#resume")) $("#resume").onclick = render;
}
function prepare(requestedMode, settings={}) {
  const validMode=Object.hasOwn(generators,requestedMode);if(!validMode){menu();return;}
  navigation.show({screen:'prepare',mode:requestedMode});
  view='prepare';const mode=requestedMode;
  $('#examTitle').textContent='연습 시작 안내';
  $('#menuButton').textContent='평가 메뉴';$('#exit').textContent='이용 가이드';$('#exit').onclick=showGuide;
  const title=mode==='ax'?'AX 직무역량평가 · B2B 컨설팅 & 영업':mode==='knowledge'?'AI 지식평가':practiceMenus.find(x=>x[0]===mode)[1];
  app.innerHTML=`<main class="menu prepare"><h1>${escape(title)}</h1><h2>연습 환경 설정</h2><p>공개된 응시 가이드와 체험 화면을 기준으로 조작을 연습합니다. 모든 문항은 객관식입니다. 실제 전문평가의 자료 해석·검증·개선안 판단도 객관식 상황 문제로 연습합니다.</p><div class="prepareSettings"><label>진행 방식<select id="interactionMode"><option value="guide">가이드 맞춤 · 공통 지문 / 문제 선택 / 파일 재첨부</option><option value="free">자유 연습 · 자동 문제 해석 / 이전 첨부 참고</option></select></label><label>본 연습 제한 시간<select id="practiceMinutes"><option value="1">1분</option><option value="10">10분</option><option value="20" selected>20분</option><option value="30">30분</option><option value="60">60분</option><option value="0">시간 제한 없음</option></select></label><label>AI 질문 총 횟수<select id="hintLimit"><option value="10">10회 · 체험 기준</option><option value="20">20회</option><option value="30">30회</option></select></label></div><p class="menuNote">시간·횟수는 연습용 설정입니다. 실제 시험은 응시 안내에 제시된 설정을 따릅니다. 체험은 시간 제한·채점·결과 리포트가 없습니다.</p><details open><summary>유형별 가이드와 실제 시험과의 차이</summary>${guideBody}</details><div class="prepareActions"><button id="backMenu">평가 메뉴</button><button id="rehearsal">시간 제한 없는 체험</button><button class="primary" id="beginPractice">본 연습 시작</button></div></main>`;
  for(const id of ['interactionMode','practiceMinutes','hintLimit']){
    const el=$('#'+id);if([...el.options].some(option=>option.value===settings[id]))el.value=settings[id];
    el.onchange=()=>navigation.remember();
  }
  $('#backMenu').onclick=menu;
  const begin=rehearsal=>{
    const options={rehearsal,minutes:Number($('#practiceMinutes').value),interactionMode:$('#interactionMode').value,hintLimit:Number($('#hintLimit').value)};
    const action=()=>{s=createPractice(configureExam(generators[mode]()),options);s.navigationId=crypto.randomUUID();assistantError='';save();render();};
    if(s&&!s.graded)confirmAction('새 연습 시작','진행 중인 이전 연습을 새 자료와 문제로 교체합니다. 계속할까요?',action);else action();
  };
  $('#rehearsal').onclick=()=>begin(true);$('#beginPractice').onclick=()=>begin(false);
}
function filesHtml() {
 const d=s.exam.documents[s.fileIndex],guide=s.interactionMode==='guide';
 return `<div class="fileLabel">파일 목록 · ${s.exam.documents.length}개${s.exam.materialProfile?' · 통합 원문·이력':''} ${guide?'': '<button class="outline" data-download-all>전체 자료 내려받기</button>'}</div><div class="files" style="--file-tree-width:${s.fileTreeWidth||220}px"><div class="fileTree"><small>파일명 <span class="tokenHeading">토큰량</span></small>${s.exam.documents.map((doc,i)=>`<div class="fileEntry"><button data-file="${i}" class="${i===s.fileIndex?'selected':''}" title="${escape(doc.name)}">${escape(doc.name)}.txt <small>${documentTokens(doc).toLocaleString()}</small></button><button data-attach="${i}" aria-label="${escape(doc.name)} AI 질문에 추가" title="AI 질문에 추가" ${s.graded&&!isReview(s)?'disabled':''}>＋</button></div>`).join('')}</div><div class="resizeHandle" role="separator" aria-label="파일 목록 너비 조절" aria-orientation="vertical" tabindex="0" data-resize-files></div><div class="fileView"><div class="fileToolbar"><span>${escape(d.name)}.txt · ${documentTokens(d).toLocaleString()} 토큰</span>${guide?'':'<button class="outline" data-download-file>내려받기</button>'}<button class="outline" data-attach="${s.fileIndex}" ${s.graded&&!isReview(s)?'disabled':''}>AI 질문에 추가</button><button class="outline" id="fullscreenFile" aria-label="자료 전체 화면">⛶</button></div><div class="documentViewport" style="zoom:${s.zoom/100}">${documentHtml(d)}</div><div class="zoomControls"><button data-zoom="-10" aria-label="자료 축소">−</button><button data-zoom="0" aria-label="자료 배율 초기화">${s.zoom}%</button><button data-zoom="10" aria-label="자료 확대">＋</button></div></div></div><small class="tokenNotice">${s.exam.materialProfile?'원천기록·승인대장·정책을 함께 첨부해 유효 기록 추출과 비교를 요청하세요. ':''}토큰은 연습용 GPT의 o200k_base 기준이며 공식 시험의 내부 계산과 다를 수 있습니다.</small>`;
}
function dimensionResult() {
  return ["기본 직무역량", "AX 문제해결"]
    .map((d) => {
      const indices = s.exam.questions
        .map((q, i) => (q.dimension === d ? i : -1))
        .filter((i) => i >= 0);
      const correct = indices.filter(
        (i) => isCorrect(s.exam.questions[i],s.answers[i]),
      ).length;
      return `${d}: ${correct}/${indices.length} 정답 (${Math.round((correct / indices.length) * 100)}점)`;
    })
    .join("<br>");
}
function render() {
 if(!s){menu();return;}navigation.show({screen:'exam',sessionId:s.navigationId});view='exam';
 const {exam,index,answers,graded,rehearsal}=s,q=exam.questions[index],count=exam.questions.length,guide=s.interactionMode==='guide',show=graded&&!rehearsal,result=grade(exam.questions,answers),numberScore=i=>isCorrect(exam.questions[i],answers[i])?'100':'0';
 $('#menuButton').textContent=exam.mode==='ax'?'AX 직무역량평가':exam.mode==='knowledge'?'AI 지식평가':'AI 활용평가';$('#examTitle').textContent=exam.title;$('#exit').textContent=graded?'평가 메뉴':'연습 종료';$('#exit').onclick=()=>graded?menu():review(true);
 const resultHtml=!graded?'':rehearsal?'<div class="resultLine" role="status">체험 완료<small>채점·결과 리포트 없이 조작을 체험했습니다. 본 연습은 새 문제로 시작합니다.</small></div>':`<div class="resultLine" role="status">자체 연습 점수: ${result.score} / 100<small>${s.completedReason==='timeout'?'제한 시간 종료 · 저장된 답안이 자동 제출되었습니다.<br>':''}${result.objectiveTotal}문제 중 ${result.correct}문제 정답${exam.mode==='ax'?'<br>'+dimensionResult():''} · ${guide?'가이드 맞춤':'자유 연습'}</small></div>`;
 app.innerHTML=`<div class="layout"><aside class="sidebar"><button class="sideicon" id="backToMenu" aria-label="평가 메뉴">⇥</button><div aria-hidden="true">☷</div><nav class="numbers" aria-label="문제 목록">${exam.questions.map((item,i)=>`<button data-question="${i}" aria-label="${i+1}번 문제${answered(answers[i])?' 답안 제출 완료':''}${s.flags[i]?' 다시 풀 문제':''}" aria-current="${i===index?'step':'false'}" class="${i===index?'active':''} ${answered(answers[i])?'answered':''} ${s.flags[i]?'flagged':''}">${answered(answers[i])?'<span class="answerCheck">✓</span>':''}${i+1}</button><small>${(show?numberScore(i):'-')+' / 100'}</small>`).join('')}</nav></aside><main class="workspace"><div class="questionTop"><button data-step="-1" aria-label="이전 문제" ${index===0?'disabled':''}>‹</button><span id="currentQuestionLabel">${index+1}. ${typeLabel(q)} ( ${show?numberScore(index):'-'} / 100 )</span><button data-step="1" aria-label="다음 문제" ${index===count-1?'disabled':''}>›</button><span class="examClock" id="examClock"></span></div><div class="middle"><div class="paperScroll ${guide||!rehearsal?'examContent':''}" id="paper">${resultHtml}<section class="intro" id="intro"><div class="introTitle"><span class="pill">1 ~ ${count}</span>다음을 읽고 문제를 풀어주세요.</div><p>${escape(exam.intro)}</p><p class="menuNote">${guide?'가이드 맞춤 · '+(count===1?'현재 1번 문제는 AI에 자동 전달됩니다.':'문제를 선택하기 전에는 AI에 공통 지문만 전달됩니다.')+' 파일은 질문마다 다시 첨부하세요.':'자유 연습 · 질문·대화·현재 문제를 자동으로 참고합니다.'}</p>${exam.documents.length?`<button class="outline assistLauncher" id="openAssistant">● AI 어시스트 · ${s.hints}회 남음</button>${filesHtml()}`:''}</section><hr class="divider">${(guide?exam.questions.map((_,i)=>i):[index]).map(i=>questionHtml(s,i)).join('')}</div>${exam.documents.length||isReview(s)?'<div class="assistantResize" role="separator" aria-label="어시스트 너비 조절" tabindex="0" data-resize-assistant></div>'+assistantHtml():''}</div><div class="navigation"><span class="progress" id="answerProgress">${count}문제 중 ${answers.filter(answered).length}문제 제출</span><button data-step="-1" ${index===0?'disabled':''}>‹ 이전 문제</button><button data-step="1" ${index===count-1?'disabled':''}>다음 문제 ›</button></div><div class="bottom"><small id="saveState"></small>${exam.documents.length||isReview(s)?`<button class="assistLauncher" data-open-assistant>${isReview(s)?'AI 복습':'AI 어시스트 · '+s.hints+'회'}</button>`:''}<button id="practiceGuide">가이드</button><button id="answersReview">내 답안</button><button id="notes">메모</button>${graded?'<button id="processReview">과정 기록</button>':''}<button id="reset">${graded?'새 연습':'초기화'}</button><button class="primary" id="finish">${graded?'평가 메뉴':rehearsal?'체험 종료':'최종 제출 및 종료'}</button></div></main><aside class="rail"><button id="help" aria-label="연습 이용 가이드">▣</button><button id="guide" aria-label="공식 가이드 안내">ⓘ</button></aside></div>`;
 document.querySelectorAll('[data-retry-prompt]').forEach(button=>button.onclick=async()=>{
  const result=preparePromptReview(s,Number(button.dataset.retryPrompt));
  assistantError=result.ok?'':result.error;
  rerender();
  if(result.ok)await sendAssistantRequest();
 });
 document.querySelectorAll('[data-copy-prompt]').forEach(button=>button.onclick=async()=>{
  const index=Number(button.dataset.copyPrompt),status=$('#promptCopyStatus-'+index);
  try{await navigator.clipboard.writeText(modelPrompt(s.exam,index));status.textContent='복사했습니다.';}
  catch{status.textContent='복사를 사용할 수 없습니다. 위 프롬프트를 선택해 복사하세요.';}
 });
 document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>move(Number(b.dataset.question)));
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>move(s.index+Number(b.dataset.step)));
 document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(selectAnswer(s,Number(b.dataset.answerQuestion),Number(b.dataset.answer))){s.index=Number(b.dataset.answerQuestion);rerender();}});
 document.querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>{if(!s.graded){const i=Number(b.dataset.flag);s.index=i;s.flags[i]=!s.flags[i];rerender();}});
 document.querySelectorAll('[data-intro]').forEach(b=>b.onclick=()=>$('#intro').scrollIntoView({behavior:'smooth'}));
 document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{s.fileIndex=Number(b.dataset.file);rerender();});
 document.querySelectorAll('[data-attach]').forEach(b=>b.onclick=()=>attach(Number(b.dataset.attach)));
 document.querySelectorAll('[data-download-all]').forEach(b=>b.onclick=()=>downloadText(exam.title+'_전체자료.txt',assistantPacket(exam,exam.documents.map((_,i)=>i))));
 document.querySelectorAll('[data-download-file]').forEach(b=>b.onclick=()=>downloadText(exam.documents[s.fileIndex].name+'.txt',documentText(exam.documents[s.fileIndex])));
 document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{const amount=Number(b.dataset.zoom);s.zoom=amount?Math.max(50,Math.min(150,s.zoom+amount)):100;rerender();});
 if($('#fullscreenFile'))$('#fullscreenFile').onclick=()=>utilityContent('자료 전체 화면',`<div class="fullDocument ${guide?'examContent':''}">${documentHtml(exam.documents[s.fileIndex])}</div>`);
 $('#backToMenu').onclick=()=>$('#home').click();$('#practiceGuide').onclick=showGuide;$('#answersReview').onclick=()=>review(false);$('#notes').onclick=notes;$('#help').onclick=showGuide;$('#guide').onclick=showGuide;
 $('#reset').onclick=()=>graded?prepare(exam.mode):confirmAction('답안 초기화','자료·제한 시간·대화·AI 횟수는 유지하고 답안과 깃발만 초기화합니다.',()=>{s.answers.fill(null);s.flags.fill(false);rerender();});
 $('#finish').onclick=()=>graded?menu():review(true);
 if($('#openAssistant'))$('#openAssistant').onclick=openAssistant;document.querySelectorAll('[data-open-assistant]').forEach(b=>b.onclick=openAssistant);
 if($('#assistantForm'))bindAssistant();if($('#processReview'))$('#processReview').onclick=processReview;
 if(guide){const paper=$('#paper');let scheduled=false;paper.onscroll=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(s?.exam!==exam||view!=='exam'||!paper.isConnected)return;const top=paper.getBoundingClientRect().top+40;const sections=[...paper.querySelectorAll('[data-question-section]')];const active=sections.find(el=>el.getBoundingClientRect().bottom>top);if(!active)return;const i=Number(active.dataset.questionSection);if(s.index===i)return;s.index=i;document.querySelectorAll('[data-question]').forEach(b=>{const yes=Number(b.dataset.question)===i;b.classList.toggle('active',yes);b.setAttribute('aria-current',yes?'step':'false');});$('#currentQuestionLabel').textContent=`${i+1}. ${typeLabel(exam.questions[i])} ( ${show?numberScore(i):'-'} / 100 )`;document.querySelectorAll('[data-step]').forEach(b=>b.disabled=i+Number(b.dataset.step)<0||i+Number(b.dataset.step)>=count);save();});};}
 $('#paper').addEventListener('scroll',()=>navigation.remember(),{passive:true});
 bindResizing();save();tick();
}
function updateAnswerIndicators(){
 $('#answerProgress').textContent=`${s.exam.questions.length}문제 중 ${s.answers.filter(answered).length}문제 제출`;
 document.querySelectorAll('[data-question]').forEach(b=>{const i=Number(b.dataset.question),done=answered(s.answers[i]);b.classList.toggle('answered',done);b.setAttribute('aria-label',`${i+1}번 문제${done?' 답안 제출 완료':''}${s.flags[i]?' 다시 풀 문제':''}`);b.innerHTML=(done?'<span class="answerCheck">✓</span>':'')+(i+1);});
}
function bindResizing(){
 const setup=(el,key,initial,min,max,apply)=>{if(!el)return;el.onpointerdown=e=>{const start=e.clientX,base=initial();el.setPointerCapture(e.pointerId);el.onpointermove=ev=>{s[key]=Math.max(min,Math.min(max,base+(ev.clientX-start)*(key==='assistantWidth'?-1:1)));apply(s[key]);};el.onpointerup=()=>{el.onpointermove=null;save();};};el.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();s[key]=Math.max(min,Math.min(max,initial()+(e.key==='ArrowRight'?10:-10)));apply(s[key]);save();}};};
 const applyFiles=v=>document.querySelector('.files').style.setProperty('--file-tree-width',v+'px');
 setup(document.querySelector('[data-resize-files]'),'fileTreeWidth',()=>s.fileTreeWidth||220,120,400,applyFiles);
 const applyAssistant=v=>document.querySelector('.middle').style.setProperty('--assistant-width',v+'px');
 setup(document.querySelector('[data-resize-assistant]'),'assistantWidth',()=>s.assistantWidth||360,280,600,applyAssistant);if(s.assistantWidth)applyAssistant(s.assistantWidth);
}
function processReview(){
 const summary=processSummary(s),logs=s.auditLog?.length?s.auditLog:s.messages;
 utilityContent('과정 기록 · 자체 학습용',`<p>성공 질문 ${summary.successfulRequests}회 · 파일 첨부 질문 ${summary.withAttachments}회 · 문제 선택 질문 ${summary.selectedQuestion}회 · 최종 저장 답안 ${summary.finalSaved}개</p><p>아래는 행동 기록이며 공식 역량 점수나 자동 과정 채점 결과가 아닙니다. 자료 선별·검증·보안 통제를 스스로 검토하세요.</p>${logs.map((m,i)=>`<details><summary>${i+1}. ${escape(m.input.slice(0,80))}</summary><p>첨부: ${escape((m.files||[]).join(', ')||'없음')}</p><pre>${escape(m.input)}

${escape(m.reply)}</pre></details>`).join('')}`);
}
function rerender(){const paper=$('#paper')?.scrollTop||0,chat=$('.assistantBody')?.scrollTop||0;render();if($('#paper'))$('#paper').scrollTop=paper;if($('.assistantBody'))$('.assistantBody').scrollTop=chat;}
function move(next){if(next<0||next>=s.exam.questions.length)return;s.index=next;render();$(`#question-${next}`).scrollIntoView({block:'start'});}
function review(finishing){
 const count=s.answers.filter(answered).length;
 utilityContent(finishing?'종료 전 내 답안 확인':'내 답안',`<p>${s.exam.questions.length}문제 중 ${count}문제 제출 · ${s.exam.questions.length-count}문제 미응답</p><div class="answerReview">${s.exam.questions.map((q,i)=>`<button data-review="${i}" class="outline">${i+1}번 객관식 · ${!answered(s.answers[i])?'미제출':(s.answers[i]+1)+'번 선택'}${s.flags[i]?' · ⚑':''}</button>`).join('')}</div>${finishing?`<p>${s.rehearsal?'체험은 채점·결과 리포트 없이 종료됩니다.':'종료 후 답안을 수정할 수 없습니다. 선택한 답안만 최종 제출됩니다.'}</p><button class="primary" id="submitFinal">최종 제출 및 종료</button>`:''}`);
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{utility.close();move(Number(b.dataset.review));});if($('#submitFinal'))$('#submitFinal').onclick=()=>{utility.close();finishPractice(s);save();render();};
}
function notes() {
  utilityContent(
    `${s.index + 1}번 문제 메모`,
    `<textarea id="questionNote" aria-label="문제 메모" maxlength="2000" rows="7" ${s.graded ? "readonly" : ""}>${escape(s.notes[s.index])}</textarea><p class="menuNote">현재 탭에만 저장되며 답안으로 채점되지 않습니다.</p>`,
  );
  $("#questionNote").oninput = (e) => {
    if (!s.graded) {
      s.notes[s.index] = e.target.value;
      save();
    }
  };
}
function openAssistant() {
  s.assistantOpen = true;
  s.assistantMobileOpen = true;
  rerender();
}
function attach(i){if((s.graded&&!isReview(s))||hintPending(s))return;const result=setAttachments(s,[...s.attachments,i]);assistantError=result.ok?'':result.error;s.assistantOpen=true;s.assistantMobileOpen=true;rerender();}
function assistantHtml() {
  const pending = hintPending(s), guide=s.interactionMode==='guide', review=isReview(s), locked=s.graded&&!review, messages=assistantHistory(s);
  return `<aside id="assistantPanel" class="assistant ${s.assistantOpen ? "assistantOpen" : ""} ${s.assistantMobileOpen ? "assistantMobileOpen" : ""}">
    <div class="assistantHead">AI 어시스트 <small>${review?'복습 '+(s.reviewRequests||0)+'회':s.hints+'회 남음'}</small><button id="closeAssistant" aria-label="어시스트 닫기">→</button></div>
    <p class="assistantConnection">${escape(assistantStatus)} · ${review?"채점 후 복습 · 시험 횟수와 별도":guide?"가이드 맞춤":"자유 연습"}</p>
    <div class="assistantOptions ${guide?'guideOptions':''}">
      <label class="assistantSelect">문제<select id="assistQuestion" aria-label="어시스트 문제 선택" ${locked ? "disabled" : ""}><option value="">${guide?(s.exam.questions.length===1?"현재 1번 문제":"공통 지문만"):"자동 · 질문/대화/현재 문제"}</option>${s.exam.questions.map((q, i) => `<option value="${i}" ${s.selectedQuestion === i ? "selected" : ""}>${i + 1}번 · ${escape(q.topic)}</option>`).join("")}</select></label>
      <label class="assistantSelect" ${guide?'hidden':''}>답변 형식<select id="answerTemplate" ${locked ? "disabled" : ""}>${Object.entries(answerTemplates).map(([key, [label]]) => `<option value="${key}" ${(s.answerTemplate || "auto") === key ? "selected" : ""}>${escape(label)}</option>`).join("")}</select></label>
    </div>
    <div class="assistantBody" role="log" aria-label="AI 어시스트 대화" aria-live="polite" aria-busy="${pending}">
      ${!messages.length ? '<p class="assistantEmpty">먼저 문제와 자료를 선택해 질문하세요.<br>파일 내용이 필요하면 매번 다시 첨부하세요.</p>' : ''}
      ${messages.map((m) => `<div class="message messageUser"><small>나</small>${escape(m.input)}${m.files.length ? '<span class="messageFiles">첨부: ' + escape(m.files.join(", ")) + '</span>' : ""}</div><div class="message messageAssistant"><small>AI 어시스트</small>${chatHtml(m.reply)}</div>`).join("")}
      <div id="assistantPending" ${pending ? '' : 'hidden'}>
        <div class="message messageUser"><small>나</small><span id="pendingQuestion">${pending ? escape(s.draft) : ''}</span></div>
        <div class="message messageAssistant assistantThinking" role="status"><span class="thinkingDots" aria-hidden="true"><i></i><i></i><i></i></span><span>답변을 생성하고 있어요</span></div>
      </div>
    </div>
    <div class="assistantComposer"><p class="attachmentMeter" id="attachmentMeter">첨부 ${attachmentTokens(s.exam,s.attachments).toLocaleString()} / 20,000토큰${guide?" · 이전 원문 기억 안 함":" · 자유 연습은 한도 안내만"}</p>
      <details class="assistantRules"><summary>자료 첨부 · 제약조건 <span>${s.attachments.length ? s.attachments.length + '개 첨부' : '설정'}</span></summary>
        <div class="assistantSettings">
          <div class="assistantTools"><button class="outline" id="attachAll" ${locked ? "disabled" : ""}>전체 첨부</button><button class="outline" id="hintFiles" ${locked ? "disabled" : ""}>첨부 파일</button><button class="outline" id="exportAssistant" ${guide?'hidden':''}>내려받기</button></div>
          <p>제공 자료만 근거로 사용 · 출처·계산식 표시 · 추정과 미확인 구분</p>
          <label ${guide?'hidden':''}>추가 제약조건<textarea id="assistantConstraints" maxlength="1000" rows="2" placeholder="예: 5줄 이내, 표로 비교, 정답 대신 힌트만" ${locked ? "disabled" : ""}>${escape(s.assistantConstraints || "")}</textarea></label>
          <p>예: “이 자료 요약해줘”, “3번 대안의 총비용 비교해줘”, “왜 이 분모야?”</p>
        </div>
      </details>
      <div class="attachments">${s.attachments.map((i) => `<button class="outline" data-remove="${i}" aria-label="${escape(s.exam.documents[i].name)} 첨부 해제">${escape(s.exam.documents[i].name)} ×</button>`).join("")}</div>
      <p id="assistantError" role="alert">${escape(assistantError)}</p>
      <form id="assistantForm"><textarea id="assistantInput" aria-label="어시스트 질문" placeholder="질문을 입력하세요. 예: 이 자료 핵심 정리해줘" maxlength="1000" rows="3" ${locked || (!review && s.hints === 0) ? "disabled" : ""}>${escape(s.draft)}</textarea><button id="sendHint" aria-label="어시스트 질문 전송">↑</button></form>
      <div class="assistantFoot"><span id="charCount">${s.draft.length}/1,000자</span><span id="cooldownText"></span></div>
    </div>
  </aside>`;
}
function bindAssistant() {
  $("#assistantInput").oninput = (e) => {
    s.draft = e.target.value;
    $("#charCount").textContent = s.draft.length + "/1,000자";
    save();
  };
  $("#assistQuestion").onchange = (e) => {
    s.selectedQuestion = e.target.value === "" ? null : Number(e.target.value);
    save();
  };
  $("#answerTemplate").onchange = (e) => {
    s.answerTemplate = e.target.value;
    save();
  };
  $("#assistantConstraints").oninput = (e) => {
    s.assistantConstraints = e.target.value;
    save();
  };
  $("#assistantForm").onsubmit = async (e) => {
    e.preventDefault();
    await sendAssistantRequest();
  };
  $("#closeAssistant").onclick = () => {
    s.assistantOpen = false;
    s.assistantMobileOpen = false;
    rerender();
  };
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        s.attachments = s.attachments.filter(
          (i) => i !== Number(b.dataset.remove),
        );
        rerender();
      }),
  );
  $("#attachAll").onclick = () => {
    const result=setAttachments(s,s.exam.documents.map((_,i)=>i));assistantError=result.ok?'':result.error;
    rerender();
  };
  $("#exportAssistant").onclick = () =>
    downloadText(
      s.exam.title + "_AI입력.txt",
      assistantPacket(s.exam, s.attachments, s.selectedQuestion, s.draft) +
        "\n\n답변 형식: " +
        answerTemplates[s.answerTemplate || "auto"][1] +
        "\n추가 제약조건: " +
        (s.assistantConstraints || "없음"),
    );
  $("#hintFiles").onclick = () => {
    utilityContent(
      "이번 질문의 첨부 자료",
      `<p>${s.interactionMode==='guide'?'가이드 맞춤에서는 이번 첨부 원문만 전달되며 다음 질문에는 다시 첨부해야 합니다.':'자유 연습에서는 이전 첨부도 후속 대화에 전달됩니다.'}</p><p id="modalTokenCount">${attachmentTokens(s.exam,s.attachments).toLocaleString()} / 20,000토큰</p>${s.exam.documents.map((d, i) => `<label class="attachmentOption"><input type="checkbox" data-choose-file="${i}" ${s.attachments.includes(i) ? "checked" : ""}> ${escape(d.name)}.txt</label>`).join("")}<p class="menuNote">토큰량을 확인해 필요한 자료를 선택하세요. 가이드 맞춤은 최대 20,000토큰을 적용하며, 파일명만 선택하지 않고 질문에 첨부해야 원문이 전달됩니다.</p>`,
    );
    document.querySelectorAll("[data-choose-file]").forEach(
      (b) =>
        (b.onchange = () => {
          const i = Number(b.dataset.chooseFile);
          const result=setAttachments(s,b.checked?[...s.attachments,i]:s.attachments.filter(v=>v!==i));
          assistantError=result.ok?'':result.error;
          if(!result.ok)b.checked=false;
          $('#modalTokenCount').textContent=assistantError||attachmentTokens(s.exam,s.attachments).toLocaleString()+' / 20,000토큰';
          save();
        }),
    );
    $("#closeUtility").onclick = () => {
      utility.close();
      rerender();
    };
  };
}
async function sendAssistantRequest(){
 const target=s;
 assistantError='';
 const promise=submitHint(target,$('#assistantInput').value);
 tick();
 const result=await promise;
 if(s!==target)return;
 if(!result.ok)assistantError=result.error;
 save();
 if(view==='exam'){rerender();const body=$('.assistantBody');if(body)body.scrollTop=body.scrollHeight;}
}
function tick() {
  if (!s) return;
  const pending = hintPending(s);
  const pendingMessage = $("#assistantPending");
  if (pendingMessage) {
    const justStarted = pending && pendingMessage.hidden;
    pendingMessage.hidden = !pending;
    $(".assistantBody").setAttribute("aria-busy", String(pending));
    if (pending) $("#pendingQuestion").textContent = s.draft;
    const empty = $(".assistantEmpty");
    if (empty) empty.hidden = pending;
    if (justStarted) $(".assistantBody").scrollTop = $(".assistantBody").scrollHeight;
  }
  document.querySelectorAll('[data-retry-prompt]').forEach(button=>button.disabled=pending);
  if ($("#assistantError")) $("#assistantError").textContent = assistantError;
  document
    .querySelectorAll(
      "#assistQuestion,#answerTemplate,#assistantConstraints,#assistantInput,#attachAll,#hintFiles,[data-remove]",
    )
    .forEach((el) => {
      el.disabled =
        hintPending(s) ||
        (s.graded&&!isReview(s)) ||
        (el.id === "assistantInput" && !isReview(s) && s.hints === 0);
    });
  if (!s.graded && timeLeft(s) === 0) {
    finishPractice(s, "timeout");
    save();
    if (view === "exam") {
      $("#confirmDialog").close();
      utility.close();
      render();
    } else if (view === "menu") menu();
    return;
  }
  const left = timeLeft(s);
  if ($("#examClock"))
    $("#examClock").textContent = s.graded
      ? "종료됨"
      : s.rehearsal
        ? "사전 체험"
        : left === null
          ? "시간 제한 없음"
          : `남은 시간 ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  if ($("#sendHint"))
    $("#sendHint").disabled =
      hintPending(s) || (s.graded&&!isReview(s)) || (!isReview(s)&&(s.hints === 0 || cooldownLeft(s) > 0));
  if ($("#cooldownText"))
    $("#cooldownText").textContent = hintPending(s)
      ? "AI 답변 생성 중…"
      : isReview(s)
        ? "복습 · 횟수 제한 없음"
      : cooldownLeft(s) > 0
        ? `${cooldownLeft(s)}초 후 재전송 가능`
        : s.hints === 0
          ? "사용 횟수 소진"
          : "";
}
setInterval(tick, 1000);
document.addEventListener("copy", (e) => {
  if (view === "exam" && (s?.interactionMode==='guide'||!s?.rehearsal) && e.target.closest?.(".examContent") && !e.target.closest?.("textarea,input,[data-model-prompt-text]"))
    e.preventDefault();
});
// New visits and reloads begin at the menu; back/forward restores screen entries.
if(s&&typeof s.navigationId!=='string')s.navigationId=crypto.randomUUID();
const navigation=createNavigation({history:window.history,location:window.location,modes:Object.keys(generators),
 capture:()=>({scrollY:window.scrollY,paperScroll:$('#paper')?.scrollTop||0,settings:view==='prepare'?Object.fromEntries(['interactionMode','practiceMinutes','hintLimit'].map(id=>[id,$('#'+id).value])):undefined}),
 onNavigate:route=>{
  $('#confirmDialog').close();utility.close();dialogAction=null;
  if(route.screen==='prepare')prepare(route.mode,route.settings||{});
  else if(route.screen==='exam'&&s?.navigationId===route.sessionId){render();$('#paper').scrollTop=Math.max(0,Number(route.paperScroll)||0);}
  else {menu();if(route.screen!=='menu')return {screen:'menu'};}
  window.scrollTo(0,Math.max(0,Number(route.scrollY)||0));
 }
});
window.addEventListener('popstate',event=>navigation.restore(event.state));
window.addEventListener('scroll',()=>navigation.remember(),{passive:true});
navigation.start();menu();

function downloadText(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
