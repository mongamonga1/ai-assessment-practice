import { grade } from "./questions.js?v=20261015-llm3";
import { practiceMenus, generators } from "./scenarios.js?v=20261015-llm3";
import {
  escape,
  documentHtml,
  documentText,
  assistantPacket,
} from "./documents.js?v=20261015-llm3";
import {
  createPractice,
  timeLeft,
  cooldownLeft,
  selectAnswer,
  finishPractice,
  submitHint,
  restorePractice,
  hintPending,
} from "./practice.js?v=20261015-llm3";
import { answerTemplates } from "./assistant.js?v=20261015-llm3";
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
const guideBody = `<ol class="guideSteps"><li>시작 안내에서 연습 시간과 유형을 확인합니다. 사전 체험은 채점 없이 조작을 익히는 별도 2문항입니다.</li><li>지문과 파일 자료를 읽고 보기 번호를 선택합니다. 답안은 즉시 저장되며 문제 이동·수정이 가능합니다.</li><li>다시 풀 문제는 깃발로 표시하고, 내 답안에서 미응답을 확인합니다. 메모는 문제마다 별도로 저장됩니다.</li><li>어시스트에 자연스럽게 질문하세요. 문제를 고르지 않으면 질문 내용·이전 대화·현재 화면을 참고합니다. 필요한 자료를 이번 질문에 첨부하세요. 질문은 최대 1,000자이며 전송 후 30초 동안 재전송할 수 없습니다.</li><li>첨부는 응답 성공 후 해제됩니다. 이전 대화에 제공한 자료는 후속 질문에서 참고하며, 다른 자료는 새로 첨부하세요. 최근 10개 대화 쌍만 표시하며 세트당 최대 10회 요청할 수 있습니다.</li><li>종료 전 내 답안을 확인합니다. 제한 시간이 끝나면 현재 답안으로 자동 종료됩니다. 종료 후에는 답안을 바꿀 수 없습니다.</li></ol><p>어시스트는 gpt-4o-mini를 사용합니다. 질문·지문·보기·첨부·이전 AI 대화가 OpenAI API로 전송됩니다. 정답표와 해설은 전달하지 않습니다. 공식 시험의 감독·인증 기능은 이 연습 페이지에 포함하지 않습니다. 답안·메모는 현재 브라우저 탭에 저장되며 AI 대화·첨부도 탭에 보관됩니다.</p><p><a href="https://user-guide.grepp.co/ko" target="_blank" rel="noopener">공식 응시자 가이드 확인</a></p>`;
function showGuide() {
  utilityContent("연습 이용 가이드", guideBody);
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
  view = "menu";
  $("#menuButton").textContent = "평가 메뉴";
  $("#examTitle").textContent = "AI 역량평가 연습";
  $("#exit").textContent = "이용 가이드";
  $("#exit").onclick = showGuide;
  const row = (mode, title, description, count) =>
    `<section class="menuRow"><div><h2>${title}</h2><p>${description}<br>상 난도 · 객관식 ${count}문제 · ${mode === "knowledge" ? "개념 및 상황 판단" : "업무 자료 + AI 어시스트(gpt-4o-mini)"}</p></div><button class="primary" data-start="${mode}">체험 진행하기 ›</button></section>`;
  app.innerHTML = `<main class="menu"><h1>AI 역량평가 연습</h1>${s ? `<div class="resumeRow"><span>${escape(s.exam.title)}${s.exam.contentVersion ? " · 상 난도" : " · 이전 난이도(새 연습에 상향 적용)"} · ${s.graded ? "종료됨" : "진행 중"}</span><button id="resume">${s.graded ? "결과 확인" : "이어서 풀기"}</button></div>` : ""}${row("ax", "AX 직무역량평가 · B2B 컨설팅 & 영업", "KT 채용공고 참고 · 기본 직무역량 5문제 + AX 문제해결 5문제", 10)}<h2 class="menuGroup">AI 활용평가 · 비개발 직군 업무 상황</h2>${practiceMenus.map(([mode, title, desc, count]) => row(mode, title, desc, count)).join("")}<h2 class="menuGroup">AI 지식평가</h2>${row("knowledge", "AI 기본 개념 및 실무 적용", "생성형 AI · 검증 · 보안 · 프롬프트 · 업무 판단", 10)}<p class="menuNote">새 연습에서는 자료·수치·조건과 질문을 새로 조합합니다. 새로고침하면 진행 중인 연습을 복원합니다.<br>공식 KT·프로그래머스 시험이 아닌 자체 객관식 연습입니다. 어시스트는 로컬 서버와 API 키 설정 후 gpt-4o-mini로 답합니다.</p><details class="sources"><summary>참고 자료</summary><p><a href="https://user-guide.grepp.co/ko" target="_blank" rel="noopener">공식 응시자 가이드</a><a href="https://kt.recruiter.co.kr/career/jobs/125780" target="_blank" rel="noopener">KT 채용공고</a><a href="https://programmers.co.kr/ai-assessment?locale=ko" target="_blank" rel="noopener">프로그래머스 AI 평가</a></p></details></main>`;
  document
    .querySelectorAll("[data-start]")
    .forEach((b) => (b.onclick = () => prepare(b.dataset.start)));
  if ($("#resume")) $("#resume").onclick = render;
}
function prepare(mode) {
  view = "prepare";
  $("#examTitle").textContent = "연습 시작 안내";
  const title =
    mode === "ax"
      ? "AX 직무역량평가 · B2B 컨설팅 & 영업"
      : mode === "knowledge"
        ? "AI 지식평가"
        : practiceMenus.find((x) => x[0] === mode)[1];
  app.innerHTML = `<main class="menu prepare"><h1>${escape(title)}</h1><h2>연습 시작 안내</h2><p>여러 자료의 조건·예외·수치를 교차 검토하는 상 난도 연습입니다. 계산이 맞아도 적용 범위나 필수조건을 놓친 보기는 오답입니다. 사전 체험에서 조작을 익힌 뒤 시작하세요.</p>${guideBody}<label class="timeChoice">본 연습 제한 시간 <select id="practiceMinutes"><option value="1">1분</option><option value="10">10분</option><option value="20" selected>20분</option><option value="30">30분</option><option value="60">60분</option><option value="0">시간 제한 없음</option></select></label><p class="menuNote">선택 시간은 이 연습용 설정이며 실제 시험 시간은 주최 측 안내를 확인하세요.</p><div class="prepareActions"><button id="backMenu">평가 메뉴</button><button id="rehearsal">사전 체험 시작</button><button class="primary" id="beginPractice">본 연습 시작</button></div></main>`;
  $("#backMenu").onclick = menu;
  const begin = (rehearsal) => {
    const minutes = Number($("#practiceMinutes").value);
    const action = () => {
      s = createPractice(generators[mode](), { rehearsal, minutes });
      save();
      render();
    };
    if (s && !s.graded)
      confirmAction(
        "새 연습 시작",
        "저장된 이전 연습을 초기화하고 새 자료와 문제를 생성합니다. 계속할까요?",
        action,
      );
    else action();
  };
  $("#rehearsal").onclick = () => begin(true);
  $("#beginPractice").onclick = () => begin(false);
}
function filesHtml() {
  return `<div class="fileLabel">파일 목록 · ${s.exam.documents.length}개 <button class="outline" data-download-all>전체 자료 내려받기</button></div><div class="files"><div class="fileTree"><small>파일명</small>${s.exam.documents.map((d, i) => `<div class="fileEntry"><button data-file="${i}" class="${i === s.fileIndex ? "selected" : ""}" title="${escape(d.name)}">${escape(d.name)}.txt</button><button data-attach="${i}" aria-label="${escape(d.name)} AI 질문에 추가" title="AI 질문에 추가" ${s.graded ? "disabled" : ""}>＋</button></div>`).join("")}</div><div class="fileView"><div class="fileToolbar"><span>${escape(s.exam.documents[s.fileIndex].name)}.txt</span><button class="outline" data-download-file>자료 내려받기</button><button class="outline" data-attach="${s.fileIndex}" ${s.graded ? "disabled" : ""}>AI 질문에 추가</button></div>${documentHtml(s.exam.documents[s.fileIndex])}</div></div>`;
}
function dimensionResult() {
  return ["기본 직무역량", "AX 문제해결"]
    .map((d) => {
      const indices = s.exam.questions
        .map((q, i) => (q.dimension === d ? i : -1))
        .filter((i) => i >= 0);
      const correct = indices.filter(
        (i) => s.answers[i] === s.exam.questions[i].answer,
      ).length;
      return `${d}: ${correct}/${indices.length} 정답 (${Math.round((correct / indices.length) * 100)}점)`;
    })
    .join("<br>");
}
function render() {
  if (!s) {
    menu();
    return;
  }
  view = "exam";
  const { exam, index, answers, flags, graded, rehearsal } = s,
    q = exam.questions[index],
    count = exam.questions.length,
    result = grade(exam.questions, answers),
    showGrade = graded && !rehearsal;
  $("#menuButton").textContent =
    exam.mode === "ax"
      ? "AX 직무역량평가"
      : exam.mode === "knowledge"
        ? "AI 지식평가"
        : "AI 활용평가";
  $("#examTitle").textContent = exam.title;
  $("#exit").textContent = graded ? "평가 메뉴" : "연습 종료";
  $("#exit").onclick = () => (graded ? menu() : review(true));
  app.innerHTML = `<div class="layout"><aside class="sidebar"><button class="sideicon" id="backToMenu" aria-label="평가 메뉴">⇥</button><div aria-hidden="true">☷</div><nav class="numbers" aria-label="문제 목록">${exam.questions.map((item, i) => `<button data-question="${i}" aria-label="${i + 1}번 문제${answers[i] !== null ? " 답안 선택 완료" : ""}${flags[i] ? " 다시 풀 문제" : ""}" aria-current="${i === index ? "step" : "false"}" class="${i === index ? "active" : ""} ${answers[i] !== null ? "answered" : ""} ${flags[i] ? "flagged" : ""} ${showGrade ? (answers[i] === item.answer ? "correct" : "incorrect") : ""}">${answers[i] !== null ? '<span class="answerCheck">✓</span>' : ""}${i + 1}</button><small>${showGrade ? (answers[i] === item.answer ? "100" : "0") : "-"} / 100</small>`).join("")}</nav></aside><main class="workspace"><div class="questionTop"><button data-step="-1" aria-label="이전 문제" ${index === 0 ? "disabled" : ""}>‹</button><span>${index + 1}. 객관식${q.difficulty ? " · " + escape(q.difficulty) + " 난도" : ""} ( ${showGrade ? (answers[index] === q.answer ? "100" : "0") : "-"} / 100 )</span><button data-step="1" aria-label="다음 문제" ${index === count - 1 ? "disabled" : ""}>›</button><span class="examClock" id="examClock"></span></div><div class="middle"><div class="paperScroll ${rehearsal ? "" : "examContent"}" id="paper">${graded ? (rehearsal ? '<div class="resultLine" role="status">사전 체험 완료<small>체험은 채점하지 않습니다. 본 연습은 새 자료와 문제로 시작합니다.</small></div>' : `<div class="resultLine" role="status">채점 결과: ${result.score} / 100 <small>${s.completedReason === "timeout" ? "제한 시간이 종료되어 자동 제출되었습니다.<br>" : ""}${result.total}문제 중 ${result.correct}문제 정답${exam.mode === "ax" ? "<br>" + dimensionResult() : ""}</small></div>`) : ""}<section class="intro" id="intro"><div class="introTitle"><span class="pill">1 ~ ${count}</span>${rehearsal ? "사전 체험 · 채점 없음" : "다음을 읽고 문제를 풀어주세요."}</div><p>${escape(exam.intro)}</p>${exam.selection ? `<p class="menuNote">${exam.selection.poolSize}개 유형 중 미출제 우선 · 이번 세트 이후 미출제 ${exam.selection.unseenRemaining}개 · ${exam.selection.persistent ? "이 브라우저에 출제 이력 저장" : "저장 불가: 이번 실행에서만 이력 유지"}<br>유형을 모두 풀면 오래전에 출제한 유형부터 복습합니다.</p>` : ""}${exam.documents.length ? `<p>자료와 조건을 교차 확인하세요. 자료는 연습용 가상 문서이며 텍스트로 내려받아 AI에 입력할 수 있습니다.</p><button class="outline assistLauncher" id="openAssistant" aria-controls="assistantPanel">● AI 어시스트 · ${s.hints}회 남음</button>${filesHtml()}` : ""}</section><hr class="divider"><section id="question"><div class="questionMeta"><span>${index + 1}. 객관식${q.difficulty ? " · " + escape(q.difficulty) + " 난도" : ""}${q.dimension ? " · " + escape(q.dimension) : ""}</span><button class="outline ${flags[index] ? "active" : ""}" id="flag" aria-pressed="${flags[index]}" ${graded ? "disabled" : ""}>다시 풀 문제 ⚑</button><button class="outline" id="toIntro">지문으로 이동 ↑</button>${exam.documents.length ? `<button class="outline assistLauncher" data-open-assistant aria-controls="assistantPanel">AI 어시스트 · ${s.hints}회 남음</button>` : ""}${showGrade ? `<span class="status ${answers[index] === q.answer ? "" : "wrong"}">${answers[index] === q.answer ? "○ 정답" : answers[index] === null ? "미응답" : "× 오답"}</span>` : ""}</div>${q.scenario ? `<p class="questionText">다음 지문을 읽고 물음에 답하세요.</p><blockquote class="scenario">${escape(q.scenario)}</blockquote>` : ""}<p class="questionText">${escape(q.prompt)}</p><p class="selectLabel">답안을 선택하세요 ↴</p><div class="options" role="radiogroup" aria-label="${index + 1}번 답안">${q.options.map((option, i) => `<button role="radio" aria-checked="${answers[index] === i}" data-answer="${i}" ${graded ? "disabled" : ""} class="option ${answers[index] === i ? "selected" : ""} ${showGrade && i === q.answer ? "correctAnswer" : ""}"><span class="circle">${i + 1}</span><span>${escape(option)}</span></button>`).join("")}</div>${showGrade ? `<div class="explanation"><strong>정답 ${q.answer + 1} · ${escape(q.topic)}</strong><p>${escape(q.explanation)}</p>${q.evidence?.length ? `<p><strong>판단 근거</strong></p><ul>${q.evidence.map((e) => `<li>${escape(e.document)} · ${escape(e.locator)}</li>`).join("")}</ul>` : ""}<p><strong>보기별 해설</strong></p><ol>${q.options.map((o, i) => `<li><strong>${escape(o)}</strong><p>${escape(q.optionReasons?.[i] || q.explanation)}</p></li>`).join("")}</ol><small>제공 자료의 조건과 계산식으로 정답을 확인할 수 있습니다.</small></div>` : ""}<hr class="divider"></section></div>${exam.documents.length ? assistantHtml() : ""}</div><div class="navigation"><span class="progress">객관식 ${count}문제 중 ${answers.filter((x) => x !== null).length}문제 제출</span><button data-step="-1" ${index === 0 ? "disabled" : ""}>‹ 이전 문제</button><button data-step="1" ${index === count - 1 ? "disabled" : ""}>다음 문제 ›</button></div><div class="bottom"><small id="saveState"></small>${exam.documents.length ? `<button class="assistLauncher" data-open-assistant aria-controls="assistantPanel">AI 어시스트 · ${s.hints}회</button>` : ""}<button id="practiceGuide">가이드</button><button id="answersReview">내 답안</button><button id="notes">메모</button><button id="reset">${graded ? "새 연습" : "초기화"}</button><button class="primary" id="finish">${graded ? (rehearsal ? "본 연습 시작" : "평가 메뉴") : rehearsal ? "사전 체험 종료" : "최종 제출 및 종료"}</button></div></main><aside class="rail"><button id="help" aria-label="연습 이용 가이드">▣</button><button id="guide" aria-label="공식 가이드 안내">ⓘ</button></aside></div>`;
  document
    .querySelectorAll("[data-question]")
    .forEach((b) => (b.onclick = () => move(Number(b.dataset.question))));
  document
    .querySelectorAll("[data-step]")
    .forEach((b) => (b.onclick = () => move(index + Number(b.dataset.step))));
  document.querySelectorAll("[data-answer]").forEach(
    (b) =>
      (b.onclick = () => {
        if (selectAnswer(s, index, Number(b.dataset.answer))) rerender();
      }),
  );
  document.querySelectorAll("[data-file]").forEach(
    (b) =>
      (b.onclick = () => {
        s.fileIndex = Number(b.dataset.file);
        rerender();
      }),
  );
  document
    .querySelectorAll("[data-attach]")
    .forEach((b) => (b.onclick = () => attach(Number(b.dataset.attach))));
  document.querySelectorAll("[data-download-all]").forEach(
    (b) =>
      (b.onclick = () =>
        downloadText(
          s.exam.title + "_전체자료.txt",
          assistantPacket(
            s.exam,
            s.exam.documents.map((_, i) => i),
          ),
        )),
  );
  document
    .querySelectorAll("[data-download-file]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          downloadText(
            s.exam.documents[s.fileIndex].name + ".txt",
            documentText(s.exam.documents[s.fileIndex]),
          )),
    );
  $("#flag").onclick = () => {
    if (!s.graded) {
      s.flags[index] = !s.flags[index];
      rerender();
    }
  };
  $("#toIntro").onclick = () =>
    $("#intro").scrollIntoView({ behavior: "smooth" });
  $("#backToMenu").onclick = () => $("#home").click();
  $("#practiceGuide").onclick = showGuide;
  $("#answersReview").onclick = () => review(false);
  $("#notes").onclick = notes;
  $("#help").onclick = showGuide;
  $("#guide").onclick = showGuide;
  $("#reset").onclick = () =>
    graded
      ? prepare(exam.mode)
      : confirmAction(
          "답안 초기화",
          "현재 자료와 제한 시간을 유지하고 선택 답안·깃발을 초기화합니다. 메모와 어시스트 사용 횟수는 유지됩니다.",
          () => {
            s.answers.fill(null);
            s.flags.fill(false);
            rerender();
          },
        );
  $("#finish").onclick = () =>
    graded ? (rehearsal ? prepare(exam.mode) : menu()) : review(true);
  if ($("#openAssistant")) $("#openAssistant").onclick = openAssistant;
  document
    .querySelectorAll("[data-open-assistant]")
    .forEach((b) => (b.onclick = openAssistant));
  if ($("#assistantForm")) bindAssistant();
  save();
  tick();
}
function rerender() {
  const scroll = $("#paper")?.scrollTop || 0;
  render();
  if ($("#paper")) $("#paper").scrollTop = scroll;
}
function move(next) {
  if (next < 0 || next >= s.exam.questions.length) return;
  s.index = next;
  render();
  $("#question").scrollIntoView();
}
function review(finishing) {
  const count = s.answers.filter((x) => x !== null).length;
  utilityContent(
    finishing ? "종료 전 내 답안 확인" : "내 답안",
    `<p>${s.exam.questions.length}문제 중 ${count}문제 제출 · ${s.exam.questions.length - count}문제 미응답</p><div class="answerReview">${s.exam.questions.map((q, i) => `<button data-review="${i}" class="outline">${i + 1}번 · ${s.answers[i] === null ? "미응답" : s.answers[i] + 1 + "번 선택"}${s.flags[i] ? " · ⚑" : ""}</button>`).join("")}</div>${finishing ? `<p>${s.rehearsal ? "사전 체험은 채점하지 않습니다." : "미응답은 0점으로 처리되며 종료 후 답안 수정이 불가능합니다."}</p><button class="primary" id="submitFinal">${s.rehearsal ? "사전 체험 종료" : "최종 제출 및 종료"}</button>` : ""}`,
  );
  document.querySelectorAll("[data-review]").forEach(
    (b) =>
      (b.onclick = () => {
        utility.close();
        move(Number(b.dataset.review));
      }),
  );
  if ($("#submitFinal"))
    $("#submitFinal").onclick = () => {
      utility.close();
      finishPractice(s);
      save();
      render();
    };
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
function attach(i) {
  if (s.graded) return;
  if (!s.attachments.includes(i)) s.attachments.push(i);
  s.assistantOpen = true;
  s.assistantMobileOpen = true;
  rerender();
}
function assistantHtml() {
  return `<aside id="assistantPanel" class="assistant ${s.assistantOpen ? "assistantOpen" : ""} ${s.assistantMobileOpen ? "assistantMobileOpen" : ""}"><div class="assistantHead">AI 어시스트 <small>${s.hints}회 남음</small><button id="closeAssistant" aria-label="어시스트 닫기">→</button></div><p>${escape(assistantStatus)}<br>자유롭게 질문하세요. 미선택 시 질문 내용·대화·현재 ${s.index + 1}번 문제를 참고합니다. 분석할 자료는 첨부하세요.</p><div class="assistantBody" aria-live="polite">${s.messages.map((m) => `<div class="message">${escape(m.input)}${m.files.length ? "<br>첨부: " + escape(m.files.join(", ")) : ""}</div><div class="message">${escape(m.reply)}</div>`).join("")}</div><label class="assistantSelect">문제 <select id="assistQuestion" aria-label="어시스트 문제 선택" ${s.graded ? "disabled" : ""}><option value="">자동 · 질문/대화/현재 문제 참고</option>${s.exam.questions.map((q, i) => `<option value="${i}" ${s.selectedQuestion === i ? "selected" : ""}>${i + 1}번 · ${escape(q.topic)}</option>`).join("")}</select></label><label class="assistantSelect">답변 형식 <select id="answerTemplate" ${s.graded ? "disabled" : ""}>${Object.entries(
    answerTemplates,
  )
    .map(
      ([key, [label]]) =>
        `<option value="${key}" ${(s.answerTemplate || "auto") === key ? "selected" : ""}>${escape(label)}</option>`,
    )
    .join(
      "",
    )}</select></label><details class="assistantRules"><summary>제약조건·질문 예시</summary><p>기본: 제공 자료만 근거로 사용 · 문서명/기록 위치 인용 · 계산식/단위 표시 · 추정과 미확인 구분</p><p>“이 자료 핵심만 정리해줘”<br>“3번의 두 대안을 총비용으로 비교해줘”<br>“왜 이 분모를 쓰는 거야?”<br>“교육 개선안을 예산·일정·성과지표로 작성해줘”</p><label>추가 제약조건<textarea id="assistantConstraints" maxlength="1000" rows="2" placeholder="예: 5줄 이내, 표로 비교, 정답 대신 힌트만" ${s.graded ? "disabled" : ""}>${escape(s.assistantConstraints || "")}</textarea></label></details><p id="assistantError" role="alert">${escape(assistantError)}</p><button class="outline" id="attachAll" ${s.graded ? "disabled" : ""}>전체 자료 첨부</button><button class="outline" id="exportAssistant">선택 자료·질문 내려받기</button><button class="outline" id="hintFiles" ${s.graded ? "disabled" : ""}>첨부 파일 선택</button><div class="attachments">${s.attachments.map((i) => `<button class="outline" data-remove="${i}" aria-label="${escape(s.exam.documents[i].name)} 첨부 해제">${escape(s.exam.documents[i].name)} ×</button>`).join("")}</div><form id="assistantForm"><textarea id="assistantInput" aria-label="어시스트 질문" placeholder="예: 이 자료 요약해줘 / 2번 계산 확인해줘" maxlength="1000" rows="2" ${s.hints === 0 || s.graded ? "disabled" : ""}>${escape(s.draft)}</textarea><button id="sendHint" aria-label="어시스트 질문 전송">↑</button></form><div class="assistantFoot"><span id="charCount">${s.draft.length}/1,000자</span><span id="cooldownText"></span></div></aside>`;
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
    const target = s;
    assistantError = "";
    const promise = submitHint(target, $("#assistantInput").value);
    tick();
    const result = await promise;
    if (s !== target) return;
    if (!result.ok) assistantError = result.error;
    save();
    if (view === "exam") {
      rerender();
      const body = $(".assistantBody");
      if (body) body.scrollTop = body.scrollHeight;
    }
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
    s.attachments = s.exam.documents.map((_, i) => i);
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
      `<p>응답 성공 후 첨부가 해제됩니다. 이전 첨부는 후속 대화의 맥락으로 전달됩니다.</p>${s.exam.documents.map((d, i) => `<label class="attachmentOption"><input type="checkbox" data-choose-file="${i}" ${s.attachments.includes(i) ? "checked" : ""}> ${escape(d.name)}.txt</label>`).join("")}<p class="menuNote">이번 세트의 모든 가상 자료를 첨부할 수 있습니다. 선택 자료와 질문은 텍스트로 내려받을 수 있으며 실제 LLM의 입력 한도는 사용 도구에서 확인하세요.</p>`,
    );
    document.querySelectorAll("[data-choose-file]").forEach(
      (b) =>
        (b.onchange = () => {
          const i = Number(b.dataset.chooseFile);
          s.attachments = b.checked
            ? [...new Set([...s.attachments, i])]
            : s.attachments.filter((v) => v !== i);
          save();
        }),
    );
    $("#closeUtility").onclick = () => {
      utility.close();
      rerender();
    };
  };
}
function tick() {
  if (!s) return;
  document
    .querySelectorAll(
      "#assistQuestion,#answerTemplate,#assistantConstraints,#assistantInput,#attachAll,#hintFiles,[data-remove]",
    )
    .forEach((el) => {
      el.disabled =
        hintPending(s) ||
        s.graded ||
        (el.id === "assistantInput" && s.hints === 0);
    });
  if (!s.graded && timeLeft(s) === 0) {
    $("#confirmDialog").close();
    utility.close();
    finishPractice(s, "timeout");
    save();
    render();
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
      hintPending(s) || s.graded || s.hints === 0 || cooldownLeft(s) > 0;
  if ($("#cooldownText"))
    $("#cooldownText").textContent = hintPending(s)
      ? "AI 답변 생성 중…"
      : cooldownLeft(s) > 0
        ? `${cooldownLeft(s)}초 후 재전송 가능`
        : s.hints === 0
          ? "사용 횟수 소진"
          : "";
}
setInterval(tick, 1000);
document.addEventListener("copy", (e) => {
  if (view === "exam" && !s?.rehearsal && e.target.closest?.(".examContent"))
    e.preventDefault();
});
if (s) render();
else menu();

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
