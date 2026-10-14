export function createPractice(exam,{rehearsal=false,minutes=20,now=Date.now()}={}){
 const data=rehearsal?{...exam,questions:exam.questions.slice(0,2)}:exam;
 return {version:1,exam:data,index:0,answers:data.questions.map(()=>null),flags:data.questions.map(()=>false),notes:data.questions.map(()=>''),graded:false,rehearsal,deadline:rehearsal||minutes===0?null:now+minutes*60000,hints:10,messages:[],fileIndex:0,attachments:[],selectedQuestion:null,draft:'',cooldown:0,assistantOpen:data.documents.length>0,assistantMobileOpen:false,assistantVisibilityVersion:2,completedReason:null};
}
export function timeLeft(s,now=Date.now()){return s.deadline===null?null:Math.max(0,Math.ceil((s.deadline-now)/1000));}
export function cooldownLeft(s,now=Date.now()){return Math.max(0,Math.ceil((s.cooldown-now)/1000));}
export function selectAnswer(s,index,value){if(s.graded||timeLeft(s)===0)return false;const q=s.exam.questions[index];if(!q||!Number.isInteger(value)||value<0||value>=q.options.length)return false;s.answers[index]=value;return true;}
export function finishPractice(s,reason='submitted'){if(s.graded)return false;s.graded=true;s.completedReason=reason;s.draft='';s.attachments=[];return true;}
export function submitHint(s,input,now=Date.now()){
 if(s.graded||s.hints===0||cooldownLeft(s,now)>0||timeLeft(s,now)===0)return {ok:false,error:'현재 질문을 전송할 수 없습니다.'};
 const text=input.trim();if(!text||text.length>1000)return {ok:false,error:'질문은 1–1,000자로 입력하세요.'};
 const docs=s.attachments.map(i=>s.exam.documents[i]).filter(Boolean);
 const question=s.selectedQuestion===null?null:s.exam.questions[s.selectedQuestion];
 const files=docs.map(d=>d.name+'.pdf');
 const reply=question?`${s.selectedQuestion+1}번 문제: ${question.hint}\n${files.length?'이번 질문에 첨부된 자료: '+files.join(', ')+'\n자료의 값·조건을 문제와 교차 확인하세요.':'자료를 근거로 검토하려면 필요한 파일을 이번 질문에 첨부하세요.'}`:`공통 지문: ${s.exam.intro}\n${files.length?'이번 첨부 자료: '+files.join(', '):'첨부 자료가 없습니다.'}\n특정 문항의 힌트를 받으려면 문제 번호를 선택하세요.`;
 s.messages=[...s.messages,{input:text,reply,question:s.selectedQuestion,files}].slice(-10);s.hints--;s.cooldown=now+30000;s.attachments=[];s.draft='';return {ok:true,reply};
}
export function restorePractice(raw){
 try{const s=JSON.parse(raw);if(!s||s.version!==1||!s.exam||!Array.isArray(s.exam.questions)||!s.exam.questions.length||s.exam.questions.length>30)return null;const n=s.exam.questions.length;if(![s.answers,s.flags,s.notes].every(a=>Array.isArray(a)&&a.length===n))return null;
 if(!Number.isInteger(s.index)||s.index<0||s.index>=n||!s.exam.questions.every(q=>Array.isArray(q.options)&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length))return null;
 if(!s.answers.every((v,i)=>v===null||Number.isInteger(v)&&v>=0&&v<s.exam.questions[i].options.length)||!s.notes.every(x=>typeof x==='string'&&x.length<=2000)||!s.flags.every(x=>typeof x==='boolean'))return null;
 if(typeof s.graded!=='boolean'||typeof s.rehearsal!=='boolean'||(s.deadline!==null&&!Number.isFinite(s.deadline))||!Number.isInteger(s.hints)||s.hints<0||s.hints>10||!Array.isArray(s.exam.documents)||!Array.isArray(s.messages)||!Array.isArray(s.attachments)||!Number.isFinite(s.cooldown)||typeof s.draft!=='string')return null;
 if(s.assistantVisibilityVersion!==2){s.assistantOpen=s.exam.documents.length>0;s.assistantMobileOpen=false;s.assistantVisibilityVersion=2;}
 if(typeof s.assistantOpen!=='boolean'||typeof s.assistantMobileOpen!=='boolean')return null;
 if(s.selectedQuestion!==null&&(!Number.isInteger(s.selectedQuestion)||s.selectedQuestion<0||s.selectedQuestion>=n))return null;
 if(!Number.isInteger(s.fileIndex)||s.fileIndex<0||s.fileIndex>=Math.max(1,s.exam.documents.length)||s.draft.length>1000||s.messages.length>10||!s.messages.every(m=>m&&typeof m.input==='string'&&m.input.length<=1000&&typeof m.reply==='string'&&Array.isArray(m.files)&&m.files.every(f=>typeof f==='string')))return null;
 if(s.attachments.some(i=>!Number.isInteger(i)||i<0||i>=s.exam.documents.length))return null;
 return s;
 }catch{return null;}
}
