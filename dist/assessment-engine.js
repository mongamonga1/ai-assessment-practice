import {buildAdvancedBank} from './advanced-bank.js?v=20261015-llm3';
import {question,shuffle,pick} from './questions.js?v=20261015-llm3';
import {caseLibrary} from './case-library.js?v=20261015-llm3';

const HISTORY_KEY='ai-practice-topic-history-v2';
let memory={};
function readHistory(){
 try {
  const data=JSON.parse(globalThis.localStorage?.getItem(HISTORY_KEY)||'null');
  if(data && typeof data==='object' && !Array.isArray(data))memory=data;
 }catch{/* 저장 차단 시 이번 실행의 이력 사용 */}
 return memory;
}
export function resetQuestionHistory(){memory={};try{globalThis.localStorage?.removeItem(HISTORY_KEY);}catch{}}
export function selectFresh(mode,pool,count){
 const history=readHistory();
 const stored=history[mode];
 const state=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
 const valid=x=>x&&Number.isSafeInteger(x.count)&&x.count>=0&&Number.isSafeInteger(x.last)&&x.last>=0;
 let sequence=Math.max(0,...Object.values(state).filter(valid).map(x=>x.last))+1;
 const unique=[...new Map(pool.map(q=>[q.id||q.topic,q])).values()];
 const ranked=shuffle(unique).sort((a,b)=>{
  const x=valid(state[a.id||a.topic])?state[a.id||a.topic]:{count:0,last:0};
  const y=valid(state[b.id||b.topic])?state[b.id||b.topic]:{count:0,last:0};
  return x.count-y.count||x.last-y.last;
 });
 const selected=ranked.slice(0,count);
 for(const q of selected){const id=q.id||q.topic;state[id]={count:(valid(state[id])?state[id].count:0)+1,last:sequence};}
 history[mode]=state;memory=history;
 let persistent=false;try{if(globalThis.localStorage){globalThis.localStorage.setItem(HISTORY_KEY,JSON.stringify(history));persistent=true;}}catch{}
 return {questions:shuffle(selected),selection:{poolSize:unique.length,unseenRemaining:unique.filter(q=>!valid(state[q.id||q.topic])).length,persistent}};
}

const metricSpecs={
 survey:[['추가 초대 응답률','초대 인원','응답 인원','명','추가 조사 응답률','응답 인원 ÷ 초대 인원 × 100'],['안전 대체품 배정','신청 수량','대체 필요 수량','개','일반 간식 배정 수량','신청 수량 − 대체 필요 수량'],['낱개 구매 잔액','별도 예산','개당 가격','원','별도 예산 구매 후 잔액','예산 − 내림(예산 ÷ 가격) × 가격'],['포장 단위 발주','필요 개수','상자당 개수','개','필요한 최소 상자 수','올림(필요 개수 ÷ 상자당 개수)'],['재고 폐기율','입고 수량','폐기 수량','개','입고 대비 폐기율','폐기 수량 ÷ 입고 수량 × 100']],
 usage:[['유료 좌석 사용률','배정 좌석','활성 좌석','개','활성 좌석 비율','활성 좌석 ÷ 배정 좌석 × 100'],['추가 정산 차액','청구액','환급액','USD','환급 후 청구액','청구액 − 환급액'],['묶음 크레딧 잔액','가용 크레딧','작업당 크레딧','크레딧','완료 가능한 작업 처리 후 잔여 크레딧','가용량 − 내림(가용량 ÷ 작업당 크레딧) × 작업당 크레딧'],['추가 용량 묶음','부족 크레딧','묶음 크레딧','크레딧','부족량 보충에 필요한 묶음 수','올림(부족 크레딧 ÷ 묶음 크레딧)'],['실패 호출 비율','전체 API 호출','실패 호출','건','실패 호출률','실패 호출 ÷ 전체 호출 × 100']],
 compliance:[['보완 완료율','보완 요청','완료 확인','건','보완 완료 비율','완료 확인 ÷ 보완 요청 × 100'],['검수 대기 물량','접수 물량','처리 물량','건','남은 검수 대기 건수','접수 물량 − 처리 물량'],['완전 표본 묶음 잔여','시료 수량','묶음당 시료','개','완전 묶음 구성 후 잔여 시료','시료 수량 − 내림(시료 수량 ÷ 묶음당 시료) × 묶음당 시료'],['검수 인력 산정','당일 검수 물량','1인 처리 가능량','건','당일 처리에 필요한 최소 인원','올림(검수 물량 ÷ 1인 처리량)'],['오탐 비율','위반 의심 판정','재검수 정상 확인','건','의심 판정 중 정상으로 확인된 비율','정상 확인 ÷ 위반 의심 판정 × 100']],
 voc:[['불만 재접수율','완료 티켓','재접수 티켓','건','완료 티켓 대비 재접수율','재접수 티켓 ÷ 완료 티켓 × 100'],['미해결 백로그','당일 처리 대상','당일 해결','건','남은 미해결 티켓','처리 대상 − 해결'],['상담 배정 잔여','처리 시간 예산','건당 상담 시간','분','최대 정수 건 처리 후 남은 시간','시간 예산 − 내림(시간 예산 ÷ 건당 시간) × 건당 시간'],['상담조 편성','처리할 티켓','조당 처리량','건','당일 필요한 최소 상담조 수','올림(티켓 ÷ 조당 처리량)'],['검수 오류율','원문 검수 표본','잘못 분류된 표본','건','검수 표본 오류율','잘못 분류된 표본 ÷ 전체 검수 표본 × 100']],
 campaign:[['리드 적격률','유입 리드','적격 리드','건','적격 리드 비율','적격 리드 ÷ 유입 리드 × 100'],['확정 계약 잔여','체결 계약','취소 계약','건','취소 제외 확정 계약','체결 계약 − 취소 계약'],['발송 예산 잔액','별도 발송 예산','리드당 발송비','원','최대 정수 건 발송 후 잔액','예산 − 내림(예산 ÷ 발송비) × 발송비'],['세미나 회차 산정','신청 인원','회당 정원','명','전체 수용에 필요한 최소 회차','올림(신청 인원 ÷ 정원)'],['반송률','발송 이메일','반송 이메일','건','이메일 반송률','반송 이메일 ÷ 발송 이메일 × 100']],
 procurement:[['입고 합격률','입고 물량','합격 물량','개','입고 검수 합격률','합격 물량 ÷ 입고 물량 × 100'],['추가 발주량','필요 물량','사용 가능 재고','개','추가 발주 수량','필요 물량 − 사용 가능 재고'],['절단 자재 잔여','자재 길이','부품당 길이','cm','완전 부품 생산 후 잔여 길이','전체 길이 − 내림(전체 길이 ÷ 부품 길이) × 부품 길이'],['운송 차량 산정','운송 상자','차량당 적재량','상자','필요한 최소 차량 수','올림(상자 수 ÷ 적재량)'],['하자율','납품 수량','하자 확인 수량','개','납품 하자율','하자 수량 ÷ 납품 수량 × 100']],
 education:[['과제 제출률','수강 등록자','과제 제출자','명','과제 제출률','제출자 ÷ 등록자 × 100'],['튜터링 미배정','지원 신청자','배정 완료자','명','튜터링 미배정 인원','신청자 − 배정 완료자'],['실습 시간 잔여','실습 가능 시간','세션당 시간','분','최대 정수 세션 운영 후 잔여 시간','가능 시간 − 내림(가능 시간 ÷ 세션 시간) × 세션 시간'],['튜터 인원 계획','튜터링 대상','튜터당 정원','명','필요한 최소 튜터 수','올림(대상 인원 ÷ 정원)'],['과제 통과율','과제 평가 인원','통과 인원','명','평가 인원 대비 통과율','통과 인원 ÷ 평가 인원 × 100']],
 ax:[['서비스 가용률','관측 시간','정상 제공 시간','분','서비스 가용률','정상 시간 ÷ 관측 시간 × 100'],['변경 요청 잔여','접수 변경 요청','승인 후 처리 완료','건','남은 변경 요청','접수 요청 − 처리 완료'],['파일럿 예산 잔액','별도 테스트 예산','회당 테스트 비용','원','최대 정수 회 테스트 후 잔액','예산 − 내림(예산 ÷ 회당 비용) × 회당 비용'],['배포 작업조 산정','대상 지점','작업조당 처리 지점','개','필요한 최소 작업조 수','올림(대상 지점 ÷ 작업조당 처리 지점)'],['근거 누락률','검토한 답변','인용 누락 답변','건','답변의 근거 인용 누락률','누락 답변 ÷ 전체 검토 답변 × 100']]
};
const memo=(name,paragraphs)=>({name,type:'memo',paragraphs});
const table=(name,headers,rows,note)=>({name,type:'table',headers,rows,note});
function numericQuestions(mode,documents){
 const specs=metricSpecs[mode],questions=[],rows=[];
 for(let i=0;i<specs.length;i++){
  const [topic,labelA,labelB,unit,target,formula]=specs[i];
  const a=pick([120,160,200,240])+((i===2||i===3)?7:0);
  const b=(i===0||i===4)?a*pick([0.2,0.4,0.6,0.8]):i===1?pick([20,30,40]):pick([12,18,25]);
  const value=(i===0||i===4)?b/a*100:i===1?a-b:i===2?a% b:Math.ceil(a/b);
  const answerUnit=(i===0||i===4)?'%':i===1?unit:i===2?unit:mode==='compliance'||mode==='education'?'명':mode==='campaign'?'회':mode==='procurement'?'대':mode==='voc'||mode==='ax'?'조':mode==='survey'?'상자':'묶음';
  const display=n=>`${Number(n.toFixed(1))}${answerUnit}`;
  const id=`M${i+1}`;
  rows.push([id,topic,labelA,a,labelB,b,unit]);
  const correct=display(value);
  const wrongNumbers=(i===0||i===4)?[a/b*100,b,a-b]:i===1?[a,a+b,b]:i===2?[Math.floor(a/b),b,0]:[Math.floor(a/b),Math.ceil(a/b)+1,a];
  const wrong=[...new Set(wrongNumbers.map(display))].filter(x=>x!==correct);
  for(let offset=1;wrong.length<3;offset++){const candidate=display(value+offset);if(!wrong.includes(candidate))wrong.push(candidate);}
  const calculation=(i===0||i===4)?`${b} ÷ ${a} × 100`:i===1?`${a} − ${b}`:i===2?`${a} − ${Math.floor(a/b)} × ${b}`:`올림(${a} ÷ ${b})`;
  const item=question(topic,'',`추가 운영대장 ${id}의 ${target}은?${(i===0||i===4)?' (소수 첫째 자리까지 반올림, 불필요한 0 생략)':''}`,correct,wrong.slice(0,3),`${formula}. ${calculation} = ${correct}.`,`${id}의 두 값을 찾고 지표 정의서의 단위와 분모·올림 조건을 적용하세요.`);
  item.evidence=[{document:'추가_운영대장',locator:id},{document:'추가_지표_정의서',locator:id}];
  item.optionReasons=item.options.map(option=>option===correct?`${calculation} = ${correct}로 자료의 정의와 일치합니다.`:`${option}은 ${calculation}의 결과 ${correct}와 다릅니다. ${i===2?'가능한 완전 단위 수를 먼저 내림한 뒤 사용량을 빼야 합니다.':i===3?'전량 처리해야 하므로 나머지가 있으면 한 단위를 추가해야 합니다.':i===0||i===4?'부분을 전체로 나눈 후 100을 곱해야 합니다.':'완료·차감 항목을 전체에서 빼야 합니다.'}`);
  if(mode==='ax')item.dimension=i<2?'기본 직무역량':'AX 문제해결';
  item.id=`${mode}:metric:${i}`;questions.push(item);
 }
 documents.push(table('추가_운영대장',['기록 ID','업무 항목','전체·기준 항목','값 A','부분·단위 항목','값 B','입력 단위'],rows,'별도 후속 업무의 가상 데이터입니다. 본문 집계와 모집단·기간이 다르므로 합산하지 마세요. 각 행은 독립된 작업이며 숨은 세금·손실·추가 비용은 없습니다.'));
 documents.push(memo('추가_지표_정의서',specs.map((s,i)=>`M${i+1} | ${s[0]}: ${s[5]}. ${i===2?'자원은 이월 가능하고 단위 작업은 분할하지 않습니다.':i===3?'전체 수요를 처리하며 부분 인력·부분 묶음은 허용하지 않습니다.':'분자와 분모는 같은 행의 동일 기간 관측값입니다.'}`)));
 return questions;
}
export function expandDocuments(exam){
 const cases=caseLibrary[exam.mode];if(!cases)return [];
 const extra=[];
 for(let i=0;i<cases.length;i++){
  const [topic,record,rule,prompt,correct,...wrong]=cases[i];
  const name=`추가_${String(i+1).padStart(2,'0')}_${topic}_검토기록`;
  exam.documents.push(memo(name,[`자료 ID E${i+1} / 상태: 검토용 / 본 업무상황의 별도 후속 검토. 기존 집계와 대상·기간이 다르면 합산하지 않습니다.`,`관측 기록: ${record}`,`적용 기준: ${rule}`,`담당자 요청: ${prompt} 관측값과 기준을 구분하고 확인할 수 없는 사실은 미확인으로 남겨 주세요.`,`검토 범위: 이 기록은 연습용 가상 자료입니다. 정책 기준은 이 자료의 적용 범위에 한하며, 회사 전체나 실제 국가 법령으로 일반화하지 않습니다.`]));
  const item=question(topic,'',`검토기록 E${i+1}에 따라 판단하세요. ${prompt}`,correct,wrong.map(x=>x[0]),`${record} 적용 기준은 “${rule}”입니다. 따라서 ${correct}`,`검토기록 E${i+1}의 관측 사실과 적용 기준을 대조하고, 없는 정보가 보기에서 추가되었는지 확인하세요.`);
  item.id=`${exam.mode}:case:${i}`;item.evidence=[{document:name,locator:'관측 기록 / 적용 기준'}];
  item.optionReasons=item.options.map(option=>option===correct?`관측 기록과 적용 기준을 모두 충족합니다. ${rule}`:wrong.find(x=>x[0]===option)[1]);
  if(exam.mode==='ax')item.dimension=i<4?'AX 문제해결':'기본 직무역량';
  extra.push(item);
 }
 extra.push(...numericQuestions(exam.mode,exam.documents));
 exam.documents.push(table('추가_검토_업무목록',['검토 ID','주제','확인할 관측 기록','적용 기준','담당 역할'],cases.map((c,i)=>[`E${i+1}`,c[0],c[1],c[2],i%2?'운영 담당자':'자료 검토자']),'행별 판단과 근거 위치, 미확인 항목, 확인 담당자, 후속 조치를 작성하세요. 규정·기준과 담당자의 의견은 구분합니다.'));
 exam.documents.push(memo('추가_AI_검토요청_및_회의록',[
  `업무 목적: ${exam.title}. 기존 기본 자료와 이번 후속 자료의 집계 범위를 구분해 검토 보고서를 준비합니다.`,
  '회의 발언 A: “한 장의 표에 모든 데이터를 더하면 간단할 것 같습니다.” 검토 요청: 대상과 기간이 다른 기록을 합산할 수 있는지 자료별 범위를 확인하세요.',
  '회의 발언 B: “승인이나 실행이 확인되지 않은 항목도 완료로 보고하고 싶습니다.” 검토 요청: 요청·승인·실행·결과 확인 상태를 구분해 미확인 사항을 남기세요.',
  'AI 검토 요청: 첨부 문서의 ID를 유지하고 사실 / 적용 기준 / 계산 또는 비교 / 결론 / 미확인 정보 / 후속 조치 순서로 표를 작성하세요. 외부 지식으로 제공되지 않은 수치를 보충하지 마세요.',
  '숫자 검토: 비율의 분모와 대상 기간을 기록하고 단위·통화·반올림·올림 조건을 확인하세요. 문서가 충돌하면 최신성뿐 아니라 적용 대상과 승인 상태를 대조하세요.',
  '출력 검수: 각 결론이 원문 어느 행 또는 항목에서 나온 것인지 표시하세요. 초안의 발언은 검증 전 의견이며 확정된 정책이 아닙니다. 자료에 없는 정보는 담당자 확인 질문으로 정리하세요.'
 ]));
 return extra;
}
const sources={
 survey:{'유효 응답':[0],'선호도 비율':[0],'수요 순위':[0],'표본 편향':[1],'예산 내 구매':[1],'AI 프롬프트':[0,1]},
 usage:{'회수 정책':[0,3],'현재 비용':[1],'크레딧 여유':[0,1,3],'최적화 검증':[0,1,3]},
 compliance:{'농도 위반':[1,2],'필수 표시':[0,2],'광고 검증':[0,3],'규정 충돌':[0,1,2],'경계값':[1],'증거 기반 보고':[1,2]},
 voc:{'VOC 우선순위':[0],'중복 제거':[0],'허위 후기 판단':[1],'이벤트 운영':[1],'원인과 현상':[0],'보안 프롬프트':[1]},
 campaign:{'전환율':[0,1],'획득비용':[0,1],'지표 비교':[0,1],'인과 추론':[1],'영업 의사결정':[1],'보고서 검증':[0,1]},
 procurement:{'필수 요건':[0,1],'납기 검토':[0,1],'총비용 비교':[0,1],'비용 계산':[0,1],'협상 전략':[0,1]},
 education:{'가중평균':[0],'효과성 판단':[0,1],'학과 수요':[1],'예산 배분':[2],'ROI':[2],'실행 계획':[2],'벤치마크':[3],'근거 및 보안':[3]},
 ax:{'고객 요구 분석':[0],'RFP 우선순위':[1],'기회 발굴':[4],'영업 이해관계자':[0],'수익성 기초':[2],'총소유비용':[2],'계약 범위 관리':[1],'AI Cloud Data 이해':[0,1],'제안 가치 전달':[0,1,2],'AX 문제 정의':[0,1],'AX 절감 계산':[0,2],'AX 편익 검증':[0,2],'PoC 확대 판단':[3],'AX 보안 통제':[0,1],'AX 근거 검증':[1],'AX 프롬프트 설계':[1,2],'AX 실행 우선순위':[5],'AX 결과 보고':[1,2,3]}
};
export function finalizeExam(exam,pool,count){
 const baseDocuments=[...exam.documents];
 expandDocuments(exam);
 const all=buildAdvancedBank(exam);
 exam.difficulty='상';
 exam.contentVersion='enterprise-reasoning-v1';
 for(const q of all){
  q.id ||= `${exam.mode}:base:${q.topic}`;
  q.evidence ||= (sources[exam.mode]?.[q.topic]||baseDocuments.map((_,i)=>i)).map(i=>({document:baseDocuments[i].name,locator:'표 및 기준 항목'}));
  q.optionReasons ||= q.options.map((option,i)=>i===q.answer?`자료·조건에 맞는 결론입니다. ${q.explanation}`:`이 보기의 결론 “${option}”은 다음 판단 기준과 일치하지 않습니다. ${q.explanation}`);
 }
 if(exam.mode==='ax'){
  const a=selectFresh('ax-foundation',all.filter(q=>q.dimension==='기본 직무역량'),5);
  const b=selectFresh('ax-applied',all.filter(q=>q.dimension==='AX 문제해결'),5);
  exam.questions=[...a.questions,...b.questions];exam.selection={poolSize:a.selection.poolSize+b.selection.poolSize,unseenRemaining:a.selection.unseenRemaining+b.selection.unseenRemaining,persistent:a.selection.persistent&&b.selection.persistent};
 }else Object.assign(exam,selectFresh(exam.mode,all,count));
 return exam;
}
