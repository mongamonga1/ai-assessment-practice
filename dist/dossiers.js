import {shuffle} from './questions.js?v=20261015-guide3';

const memo=(name,paragraphs)=>({type:'memo',name,paragraphs});
const table=(name,headers,rows,note='')=>({type:'table',name,headers,rows,note});
const dossier=(name,description,sections)=>({type:'dossier',name,description,sections});
const addable=header=>/^(모집단|유효 응답|품목 P 선택|초기 P 선택|초기 응답|추가 P 선택|추가 응답|건수|표본 수|인원)$/.test(header);
const revise=value=>typeof value==='number'?Number((value+Math.max(1,Math.abs(value)*.1)).toFixed(2)):value;

// Preserve the source facts, but require an audit join and, for counts, batch aggregation.
// Neither the answer key nor a precomputed clean summary is copied into a dossier.
export function buildDossiers(exam){
 if(exam.mode==='knowledge')return exam;
 const originals=exam.documents;
 const required=new Set(exam.questions.flatMap(q=>(q.evidence||[]).map(e=>e.document)));
 const active=originals.filter(d=>d.type==='table'&&required.has(d.name));
 const background=originals.filter(d=>d.type==='table'&&d.name.startsWith('심화_')&&!required.has(d.name)).sort((a,b)=>b.rows.length-a.rows.length);
 const sources=[...active,...background.slice(0,Math.max(0,7-active.length))];
 const names=['01_업무편람_자료사전_적용정책','02_통합원천기록_접수및수정본','03_승인대장_버전및범위대사','04_현장검토_기존계약_참고자료'];
 const schema=[],rawSections=[],approvalRows=[],handoffs=[],sourceMap=new Map();
 let serial=0;
 for(const [sourceIndex,source] of sources.entries()){
  const sourceId=`S${String(sourceIndex+1).padStart(2,'0')}`;
  const sumColumns=source.headers.map((h,i)=>addable(h)?i:-1).filter(i=>i>0);
  const rows=[];
  sourceMap.set(source.name,{sourceId,document:names[1]});
  schema.push([sourceId,source.name,source.headers.join(' / '),sumColumns.length?sumColumns.map(i=>source.headers[i]).join('·')+'는 유효 분할분 합계; 나머지 항목은 분할별 동일값 1회 사용':'모든 항목은 유효 버전의 관측값, 분할 간 중복 합산 금지']);
  source.rows.forEach((row,rowIndex)=>{
   const entity=`${sourceId}-R${String(rowIndex+1).padStart(2,'0')}`;
   const batches=sumColumns.length?3:1;
   for(let batch=0;batch<batches;batch++){
    const values=row.map((v,i)=>sumColumns.includes(i)&&typeof v==='number'?Math.floor(v/batches)+(batch<v%batches?1:0):v);
    const version=2+(serial++%3),batchId=`B${batch+1}`;
    const versions=[
     {v:1,values:values.map((v,i)=>i?revise(v):v),scope:'본 검토',status:'대체됨',reason:'정정 승인으로 이전 버전 효력 종료'},
     {v:version,values,scope:'본 검토',status:'승인 유효',reason:'원본 대조·담당자 승인 완료'},
     {v:version+1,values:values.map((v,i)=>i?revise(v):v),scope:'본 검토',status:'승인 대기',reason:'추가 수정 제안 접수, 검증 미완료'},
     {v:version+2,values:values.map((v,i)=>i?revise(v):v),scope:'전월 비교',status:'승인 유효',reason:'다른 모집단·기간의 대조 기록'}
    ];
    for(const entry of versions){
     const id=`${entity}-${batchId}-V${entry.v}`;
     rows.push([id,entity,batchId,entry.v,...entry.values]);
     approvalRows.push([id,sourceId,entry.scope,entry.status,entry.reason]);
    }
   }
   const measure=row.findIndex((v,i)=>i>0&&typeof v==='number');
   handoffs.push(measure>0
    ?`${entity} / ${source.name}: ${row[0]}의 ${source.headers[measure]} 변경 제안(${revise(row[measure])})이 접수됐다. 제안값은 승인본을 대체하지 않는다. ${sumColumns.length?'분할별 제안은 합산 전 레코드별로 대사한다.':'단일 관측의 개정본을 추가 물량으로 합산하지 않는다.'}`
    :`${entity} / ${source.name}: ${row[0]}의 관측 원문을 인계했다. 판정 요청과 관측·증빙은 구분한다. 관련 승인 이력을 찾을 수 없으면 사실을 확정하지 않고 증빙 보완 상태로 남긴다.`);
  });
  rawSections.push(table(`${sourceId} | ${source.name}`,['레코드 ID','업무 ID','분할 ID','개정 번호',...source.headers],shuffle(rows),source.note+' 승인 상태와 적용 범위는 03 승인대장에서 레코드 ID로 대조합니다. 행 순서는 접수 순서와 무관합니다.'));
 }
 const selectedRules=originals.filter(d=>d.type==='memo'&&(required.has(d.name)||sources.some(s=>s.name.replace('_원장','_판정조건')===d.name)));
 const policies=selectedRules.map(d=>({...d,paragraphs:[`원본 구분: ${d.name}. 이 절의 규칙은 같은 원본 구분의 업무에만 적용한다. 다른 절과 수치·모집단·기간을 합산하지 않는다.`,...d.paragraphs]}));
 const reviews=originals.filter(d=>d.name.startsWith('추가_'));
 const base=originals.filter(d=>!d.name.startsWith('심화_')&&!d.name.startsWith('추가_'));
 const manual=memo('검토 의뢰 및 데이터 처리 약정',[
  `${exam.title}. 실무 담당자는 접수 원문, 승인 기록, 정책, 업무 인계를 함께 검토해 요약·비교표를 작성해야 한다. 원천에는 확정값 외에도 정정 전 값, 미승인 제안, 다른 기간의 값이 섞여 있으며 단순한 전체 합계는 유효하지 않다.`,
  '재구성 순서: 02 원천기록의 레코드 ID와 03 승인대장을 일치시킨다. 적용 범위가 본 검토이면서 상태가 승인 유효인 기록만 남긴다. 업무 ID·분할 ID별 유효 버전은 하나다. 최신 개정 번호만 선택하거나 승인 유효만 필터링하면 미승인 제안 또는 전월 자료가 섞일 수 있다.',
  '집계 순서: 자료사전의 합산 열은 B1~B3을 합계한다. 합산 열이 아닌 요금·한도·단가·관측 원문 등은 유효 분할 기록의 동일값을 한 번만 사용한다. 분할 기록은 서로 다른 접수 단위이며, 세 분할의 모든 값이 같아 보이더라도 합산 열은 중복으로 삭제하지 않는다.',
  '해석 순서: 재구성한 사실에 원본 구분별 정책을 적용한다. 비용과 용량, 집단 구성과 효과, 날짜와 발효일, 농도와 증빙, 빈도와 심각도처럼 독립된 조건을 따로 검토한다. 질문에서 추가 조건을 가정하면 가정 변경 전후를 구분한다.',
  '출처 형식: 통합 파일명 / S코드 / 업무 ID / 유효 레코드 ID / 정책 절을 기재한다. 제외한 기록은 제외 사유를 남긴다. 검토의견은 사실 또는 정책 승인과 다르며 자료에 없는 원인·금액·예외를 확정하지 않는다.',
  '04의 기존 계약·기초 조사는 업무 배경과 이전 운영을 이해하기 위한 자료다. 심화 검토와 별도 모집단·기간이며, 현재 견적이나 승인 원장 값을 덮어쓰지 않는다. 인계 및 추가 검토도 명시된 범위를 확인해 적용한다.'
 ]);
 exam.documents=[
  dossier(names[0],'검토 범위·열별 집계 방식·원본별 정책을 연결하는 업무 편람입니다.',[manual,table('자료사전 및 집계 규칙',['자료 코드','원본 구분','원본 열 순서','재구성 방식'],schema),...policies]),
  dossier(names[1],'수정 전·승인본·미승인 제안·전월 기록이 함께 포함된 원천 자료입니다.',rawSections),
  dossier(names[2],'레코드 ID별 승인 상태와 적용 범위입니다. 원천기록과 대사한 후 집계하세요.',[table('승인·범위 통합대장',['레코드 ID','자료 코드','적용 범위','승인 상태','처리 근거'],shuffle(approvalRows),'승인 유효이면서 본 검토인 레코드만 사용합니다. 전월 비교와 승인 대기는 제외합니다.'),memo('부서 간 데이터 인계',handoffs)]),
  dossier(names[3],'예외·증빙·후속 확인과 이전 계약·조사를 함께 보존한 기록집입니다. 현재 원장과 적용 범위를 구분하세요.',[...reviews,...base])
 ];
 for(const q of exam.questions){
  const mapped=(q.evidence||[]).map(ref=>{
   const source=sourceMap.get(ref.document);
   return source?{document:names[1],locator:`${source.sourceId} | ${ref.document} / ${ref.locator}`}:{document:names[0],locator:`${ref.document} / ${ref.locator}`};
  });
  if(mapped.some(ref=>ref.document===names[1]))mapped.push({document:names[2],locator:'승인·범위 통합대장 / 해당 S코드의 레코드 ID 대사'});
  q.evidence=mapped;
 }
 exam.contentVersion='enterprise-dossier-v2';
 exam.materialProfile={files:4,sources:sources.length,sourceRows:rawSections.reduce((n,d)=>n+d.rows.length,0),requiresApprovalJoin:true};
 return exam;
}
