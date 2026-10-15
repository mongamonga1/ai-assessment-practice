import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdvancedBank} from '../dist/advanced-bank.js';
import {generators} from '../dist/scenarios.js';
import {advancedDecisions,knowledgeDecisions} from '../dist/advanced-decisions.js';
const modes=['survey','usage','compliance','voc','campaign','procurement','education','ax'];
const value=q=>Number(q.options[q.answer].replaceAll(',','').match(/^-?[\d.]+/)[0]);
const near=(actual,expected)=>assert.equal(actual,Number(expected.toFixed(2)));
function variant(mode,k){
 const original=Math.random;
 try{Math.random=()=>((k-1)/4+.01);const exam={mode,documents:[]};const questions=buildAdvancedBank(exam);return {...exam,questions};}
 finally{Math.random=original;}
}
test('상향 출제: 모든 169유형은 4지선다·독립 오답 해설, 기초형 혼입 없음',()=>{
 let count=0;
 for(const mode of [...modes,'knowledge']){
  const e=variant(mode,1);count+=e.questions.length;
  for(const q of e.questions){
   assert.equal(q.difficulty,'상');assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
   assert.equal(q.optionReasons.length,4);assert.ok(q.optionReasons.every(x=>x.length>8));
   assert.ok(!q.optionReasons.some(x=>x.includes('다음 판단 기준과 일치하지 않습니다')));
   if(mode!=='knowledge')assert.ok(q.evidence.length>=2);else assert.ok(q.scenario.length>70);
  }
  for(let i=0;i<8;i++){const exam=generators[mode]();assert.ok(exam.questions.every(q=>q.id.includes(':advanced:')&&q.difficulty==='상'));}
 }
 assert.equal(count,169);
});

test('수치 기준 사례 96문항을 수작업 검산한 고정 기대값으로 대조',()=>{
 const expected={
  survey:[54,6,216,20,218000,1,218000/104,24000,55.8095238095,1.8095238095,14.6666666667,7],
  usage:[335,5.7142857143,360,6.0606060606,-70,7,45,530,75,174,48,77.5],
  compliance:[300,25,200,25,75,174,48,77.5,40,2,13,12],
  voc:[69.0476190476,65,25,21.4285714286,75,174,48,77.5,40,2,13,12],
  campaign:[32,45.4545454545,160,50,102,78.4615384615,10,13,75,174,48,77.5],
  procurement:[1560000,21,260000,154,40,2,13,12,75,174,48,77.5],
  education:[12.6,.8,13.5,66.6666666667,144,2,91/144,96,75,174,48,77.5],
  ax:[79.2,150400,20,926,75,174,48,77.5,40,2,13,12]
 };
 for(const mode of modes){
  const e=variant(mode,1);
  for(let i=0;i<12;i++){assert.equal(value(e.questions[i]),Number(expected[mode][i].toFixed(2)),mode+' '+e.questions[i].topic);}
 }
});

test('4가지 수치 변형 전체에서 보기 유일성·원장 조건·최저비용을 검증',()=>{
 for(let k=1;k<=4;k++){
  for(const mode of modes){
   const e=variant(mode,k);
   for(const q of e.questions){assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);}
   const check=(topic,expected)=>near(value(e.questions.find(q=>q.topic===topic)),expected);
   const audit=e.documents.find(d=>d.headers?.includes('실제 양성'));
   if(audit){
    const [[,tp,fp],[,fn,tn]]=audit.rows;
    const qs=e.questions.filter(q=>q.topic.startsWith(audit.name.slice(3,-3)));
    assert.equal(qs.length,4);
    near(value(qs[0]),100*tp/(tp+fn));near(value(qs[1]),fp*2+fn*9);
    near(value(qs[2]),48*k);near(value(qs[3]),100*(tp+8*k)/(tp+fp+20*k));
    assert.equal(tp+fp+fn+tn,200*k);
   }
   const capacity=e.documents.find(d=>d.headers?.[0]==='자원');
   if(capacity){
    const target=85+3*k;
    const candidates=Array.from({length:7},(_,t)=>({t,cap:Math.floor((40+15*t)*.9),cost:t?12+7*t:0})).filter(x=>x.cap>=target).sort((a,b)=>a.cost-b.cost);
    const winner=candidates[0],qs=e.questions.filter(q=>q.topic.startsWith(capacity.name.slice(3,-3)));
    near(value(qs[0]),winner.cost);near(value(qs[1]),winner.cap-target);
    near(value(qs[2]),Math.floor((40+15*(winner.t+1))*.9)-winner.cap);
    near(value(qs[3]),target-Math.floor((40+15*(winner.t-1))*.9));
   }
   if(mode==='usage'){
    const feasible=Array.from({length:13+k+1},(_,a)=>({a,cost:a*45+(12+k-a)*20,credits:a*25000+(12+k-a)*10000})).filter(x=>x.a>=3&&x.a<=12+k&&x.credits>=(12+k)*10000+35000);
    check('혼합 라이선스 최저비용',Math.min(...feasible.map(x=>x.cost)));
    const saving=m=>100*m-250-(400+20*k),months=Array.from({length:20},(_,i)=>i+1);
    check('전환 손익분기 월',months.find(m=>saving(m)>=0));check('중복청구 반영 순절감',saving(6));
   }
   if(mode==='procurement'){
    const rows=e.documents.find(d=>d.headers?.[0]==='업체').rows;
    const feasible=rows.filter(r=>r[3]==='충족'&&r[4]<=10).map(r=>r[1]*100*(12+k)+r[2]);
    check('적격 TCO 최저안',Math.min(...feasible));
    check('수량 변화 역전점',Array.from({length:300},(_,i)=>i+1).find(v=>400000+1000*v*(12+k)<1200*v*(12+k)));
   }
   if(mode==='survey'){
    const candidates=[];for(let g=0;g<12;g++)for(let a=0;a<8;a++)if(g*12+6>=90&&a*5>=13+k)candidates.push(g*24000+a*15000+5000);
    check('제약 반영 총 발주액',Math.min(...candidates));
    check('목표 도달 추가 선택',Array.from({length:100},(_,i)=>i).find(x=>.6*96/140+.4*(22*k+x)/(60*k)>=.6));
   }
   if(mode==='education'){
    const eligible=Array.from({length:20},(_,i)=>i).filter(c=>25+10+8+6*c<=90+5*k);
    const classes=Math.max(...eligible);check('고정비 반영 교육정원',classes*18);check('초과신청 대응량',240-classes*18);
   }
   if(mode==='campaign')check('취소 허용 한도',Math.max(...Array.from({length:21},(_,x)=>x).filter(x=>(20-x)*15-(120+10*k)-2*x>=0)));
   if(mode==='ax'){
    const monthly=(1000+100*k)*(10-(.4*10+.6*2+.6*.1*8))/60*30000*.4-800000;
    check('현금전환 순편익',monthly);
    check('현금 기준 회수기간',Array.from({length:100},(_,i)=>i+1).find(m=>m*monthly>=3000000));
   }
  }
 }
});

test('판단형 보기 셔플 후에도 이유와 정답 연결을 보존',()=>{
 for(const mode of [...modes,'knowledge']){
  const rows=mode==='knowledge'?knowledgeDecisions:advancedDecisions[mode];const e=variant(mode,2);
  for(const row of rows){const q=e.questions.find(q=>q.topic===row[0]);assert.equal(q.options[q.answer],row[4][0][0]);for(let i=0;i<4;i++)assert.equal(q.optionReasons[i],row[4].find(a=>a[0]===q.options[i])[1]);}
 }
});
