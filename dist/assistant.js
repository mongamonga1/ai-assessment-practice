import {documentText} from './documents.js?v=20261015-llm3';

export const answerTemplates = {
 auto: ['질문에 맞게 자동', '질문 의도에 맞춰 필요한 항목만 답한다. 단순 후속 질문에는 핵심 답부터 짧게 설명한다.'],
 summary: ['자료 요약', '핵심 요약 → 문서별 근거 → 쟁점·불일치 → 추가 확인 사항'],
 calculation: ['계산 검증', '계산 목표·적용 조건 → 근거 수치와 단위 → 계산식·중간값 → 결과·검산'],
 comparison: ['보기·대안 비교', '판단 기준 → 대안별 충족 여부·근거 비교 → 결론 → 미확인 항목'],
 report: ['보고서·개선안', '결론 → 현황과 근거 → 원인 가설 → 개선안·우선순위 → 예산·일정·성과지표 → 한계'],
 hint: ['풀이 힌트', '정답 번호를 먼저 공개하지 않고 확인할 문서·조건 → 접근 순서 → 계산 또는 판단의 주의점']
};
export function assistantRequest(s,input){
 return {
  input:input.trim(), mode:s.exam.mode, title:s.exam.title, intro:s.exam.intro,
  currentQuestion:s.index, selectedQuestion:s.selectedQuestion,
  questions:s.exam.questions.map(q=>({topic:q.topic,prompt:q.prompt,scenario:q.scenario||'',options:q.options,references:(q.evidence||[]).map(e=>({document:e.document,locator:e.locator}))})),
  availableDocuments:s.exam.documents.map(d=>d.name),
  documents:s.attachments.map(i=>s.exam.documents[i]).filter(Boolean).map(d=>({name:d.name,text:documentText(d)})),
  history:s.messages.filter(m=>m.source==='openai').map(m=>({input:m.input,reply:m.reply,selectedQuestion:m.question,currentQuestion:m.currentQuestion??null,resolvedQuestionNumbers:m.context?.questionNumbers||[],documents:m.documents||[]})),
  template:s.answerTemplate||'auto', constraints:s.assistantConstraints||''
 };
}
