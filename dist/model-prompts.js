const criteria={
 survey:'응답자·모집단·중복·결측을 구분하고 집단별 가중치, 재고·알레르기·포장 단위·배송비를 적용해.',
 usage:'재직자 좌석·필수 기능·합산 크레딧을 동시에 충족시켜. 최저비용은 가능한 구성을 비교하고, 변경 시 중복청구·매몰비용·비교기간을 구분해.',
 compliance:'지역·로트·검수일·발효일·농도 단위·동일 로트 증빙을 대조하고, 농도 충족과 최종 출고 승인을 구분해.',
 voc:'고객·주문 중복, 다중 태그 교집합, 집계 분모를 구분하고 빈도·심각도·오탐/미탐 비용을 각각 검토해.',
 campaign:'리드·적격·계약의 분모, 중복 귀속·전환 지연·비용 범위를 맞추고 단순 성과와 증분·인과효과를 구분해.',
 procurement:'규격·납기·수량·용량의 필수조건으로 부적격안을 제외한 뒤 고정비·변동비·재작업을 포함한 총비용을 비교해.',
 education:'집단 크기·사전/사후·비교집단·가중치를 확인하고 인과효과와 관측변화를 구분해. 개선안은 수요·예산·일정·성과지표로 검토해.',
 ax:'고객 요구·필수 보안·권한·PoC 검수 조건을 먼저 적용하고 도입·운영·검수·재처리 비용과 현금화 가능한 편익을 비교해.',
 knowledge:'지문에서 사실·가정·절대적 단정을 구분하고 관련 AI 개념의 정의·적용 조건·예외로 각 보기를 검증해.'
};

function method(q){
 const topic=q.topic||'';
 if(/라이선스|최적 구성|사용량 성장|증설 없는/.test(topic))return 'A·S 좌석을 정수 변수로 두고 합계=재직자, A≥기능 필수 인원, 합산 용량≥사용량을 제약으로 비용 최소 구성을 열거해. 증가율은 현재 사용량을 분모로 구해.';
 if(/재현율|정밀도|정확도|오탐|미탐|임계값/.test(topic))return 'TP·FP·FN·TN을 재구성해 정밀도=TP/(TP+FP), 재현율=TP/(TP+FN)을 구분해. 임계값 비교는 FP×오탐비용+FN×미탐비용을 계산해.';
 if(/차이의 차이|이중차분/.test(topic))return '교육군의 사후−사전에서 비교군의 사후−사전을 빼고, 기간·척도·집단 구성의 비교 가능성과 인과 해석 한계를 확인해.';
 if(/가중|보정|추정|기여/.test(topic))return '집단별 분자÷분모에 해당 모집단 비중을 곱해 합산해. 추가 관측은 집단 안에서 먼저 병합하고, 비율·%p 변화·집단 기여를 구분해.';
 if(/발주|상자|재고|한계비용/.test(topic))return '대상별 필요량에서 사용할 수 있는 재고만 빼고 포장단위로 올림해. 고정 배송비는 주문 횟수에 맞춰 적용하고 추가 수요 전후 현금지출의 차이를 비교해.';
 if(/손익|절감|편익|매몰|TCO/.test(topic))return '유지·변경 대안별 기간 전체 현금흐름을 작성해. 고정비·반복비·첫 달 중복비를 포함하고 공통 매몰비용은 차이에서 제외해. 손익분기 기간은 정수 개월로 올림해.';
 if(/태그|교집합|중복/.test(topic))return '먼저 고유 접수·계약 ID로 중복을 제거해. 합집합=A+B−교집합을 적용하고 다중 태그 건수를 고객·티켓 수와 혼동하지 마.';
 if(/최소|최저|인력|용량/.test(topic))return '필수조건을 충족하는 정수 단위 대안을 열거하고 총비용·처리량을 재계산해. 한 단위 적은 대안이 실패하는 이유까지 확인해.';
 if(q.skill==='조건부 의사결정')return '조건별로 각 보기의 충족/위반/미확인을 표로 대조하고, 보기에서 원문에 없는 가정·권한·완료 상태를 추가했는지 검증해.';
 return '질문이 요구하는 최종 지표·단위·변경 가정을 먼저 명시하고, 각 보기의 주장과 원문 조건을 일대일로 대조해.';
}

// Deliberately read only the public question, choices, scenario and source locations.
// Works for restored sessions too, without adding answer-derived hints to API requests.
export function modelPrompt(exam,index){
 const q=exam.questions[index];
 if(!q)return '';
 const refs=q.evidence||[];
 const files=[...new Set(refs.map(ref=>ref.document))];
 const scope=refs.filter(ref=>/S\d+/.test(ref.locator)).map(ref=>ref.locator.split(' / ')[0]);
 const mode=exam.mode.replace(/-expert$/,'');
 const task=criteria[mode]||'목표·필수조건·예외를 확인하고 모든 보기를 같은 기준으로 비교해.';
 const intro=exam.documents.length
  ?`첨부한 ${files.length?files.join(', '):'업무 자료'}만 근거로 ${index+1}번 객관식의 정답을 한 번에 도출해줘.`
  :`${index+1}번 객관식을 AI 개념의 정의와 지문 조건으로 검증해 정답을 도출해줘.`;
 const workflow=exam.materialProfile
  ?`원천·승인대장을 레코드 ID로 대사해 '본 검토 AND 승인 유효'만 남겨. 최신 개정·승인 대기·전월 값을 섞지 마. 자료사전의 합산 열만 B1~B3을 더하고 단가·한도는 한 번 사용해.${scope.length?' 대상: '+[...new Set(scope)].join('; ')+'.':''}`
  :exam.documents.length?'문서의 적용 범위·버전·단위·기간과 근거 위치를 먼저 확인하고 서로 다른 모집단은 합산하지 마.':'';
 const steps=[workflow,task,method(q),'문제의 가정 변경까지 적용해 직접 계산·판정한 뒤 네 보기를 검증해. 보기에 맞춰 값을 끼워 맞추지 마. 정보가 없으면 추정하지 말고 부족한 항목을 명시해.'].filter(Boolean).join('\n');
 const output='답변: 정답 번호·보기 문장 → 문서명·레코드 ID 근거 → 계산식·중간값·단위 또는 판단 조건 → 나머지 보기별 탈락 이유. 반올림은 마지막에 하고 결과·필수조건을 검산해.';
 const question=[q.scenario,q.prompt,...q.options.map((option,i)=>`${i+1}) ${option}`)].filter(Boolean).join('\n');
 const full=[intro,'[문제와 보기]\n'+question,'[분석]\n'+steps,output].join('\n\n');
 if(full.length<=1000)return full;
 // The selected question and its full choices are already supplied by the app.
 // Do not truncate a condition or a choice just to fit the input limit.
 return [intro,`선택한 ${index+1}번 문제의 지문·보기 전체를 그대로 사용해. 검토 목표: ${q.prompt}`,'[분석]\n'+steps,output].join('\n\n');
}
