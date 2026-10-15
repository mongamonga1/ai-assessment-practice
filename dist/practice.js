import {assistantRequest} from './assistant.js?v=20261015-llm3';
export function createPractice(exam,{rehearsal=false,minutes=20,now=Date.now()}={}){
 const data=rehearsal?{...exam,questions:exam.questions.slice(0,2)}:exam;
 return {version:1,exam:data,index:0,answers:data.questions.map(()=>null),flags:data.questions.map(()=>false),notes:data.questions.map(()=>''),graded:false,rehearsal,deadline:rehearsal||minutes===0?null:now+minutes*60000,hints:10,messages:[],fileIndex:0,attachments:[],selectedQuestion:null,draft:'',cooldown:0,assistantOpen:data.documents.length>0,assistantMobileOpen:false,assistantVisibilityVersion:2,completedReason:null};
}
export function timeLeft(s,now=Date.now()){return s.deadline===null?null:Math.max(0,Math.ceil((s.deadline-now)/1000));}
export function cooldownLeft(s,now=Date.now()){return Math.max(0,Math.ceil((s.cooldown-now)/1000));}
export function selectAnswer(s,index,value){if(s.graded||timeLeft(s)===0)return false;const q=s.exam.questions[index];if(!q||!Number.isInteger(value)||value<0||value>=q.options.length)return false;s.answers[index]=value;return true;}
export function finishPractice(s,reason='submitted'){if(s.graded)return false;s.graded=true;s.completedReason=reason;s.draft='';s.attachments=[];return true;}
export async function submitHint(s,input,now=Date.now(),request=async payload=>{
 const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 let data;try{data=await response.json();}catch{throw new Error('AI 서버를 사용할 수 없습니다. npm start로 실행한 로컬 페이지에서 이용하세요.');}
 if(!response.ok)throw new Error(data.error||'AI 요청에 실패했습니다.');
 return data;
}){
 if(pending.has(s)||s.graded||s.hints===0||cooldownLeft(s,now)>0||timeLeft(s,now)===0)return {ok:false,error:'현재 질문을 전송할 수 없습니다.'};
 const text=input.trim();if(!text||text.length>1000)return {ok:false,error:'질문은 1–1,000자로 입력하세요.'};
 const payload=assistantRequest(s,text),question=s.selectedQuestion,files=payload.documents.map(d=>d.name+'.txt');
 pending.add(s);
 try{
  const result=await request(payload);
  if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('AI가 빈 답변을 반환했습니다.');
  s.messages=[...s.messages,{input:text,reply:result.reply,question,currentQuestion:payload.currentQuestion,context:result.context,files,documents:payload.documents,source:'openai'}].slice(-10);
  s.hints--;s.cooldown=Math.max(Date.now(),now)+30000;
  if(!s.graded){s.attachments=[];s.draft='';}
  return {ok:true,reply:result.reply};
 }catch(error){return {ok:false,error:error.message||'AI 연결에 실패했습니다. 다시 시도하세요.'};}
 finally{pending.delete(s);}
}
const pending=new WeakSet();
export const hintPending=s=>pending.has(s);
export function restorePractice(raw){
 try{const s=JSON.parse(raw);if(!s||s.version!==1||!s.exam||!Array.isArray(s.exam.questions)||!s.exam.questions.length||s.exam.questions.length>30)return null;const n=s.exam.questions.length;if(![s.answers,s.flags,s.notes].every(a=>Array.isArray(a)&&a.length===n))return null;
 if(!Number.isInteger(s.index)||s.index<0||s.index>=n||!s.exam.questions.every(q=>Array.isArray(q.options)&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length))return null;
 if(!s.answers.every((v,i)=>v===null||Number.isInteger(v)&&v>=0&&v<s.exam.questions[i].options.length)||!s.notes.every(x=>typeof x==='string'&&x.length<=2000)||!s.flags.every(x=>typeof x==='boolean'))return null;
 if(typeof s.graded!=='boolean'||typeof s.rehearsal!=='boolean'||(s.deadline!==null&&!Number.isFinite(s.deadline))||!Number.isInteger(s.hints)||s.hints<0||s.hints>10||!Array.isArray(s.exam.documents)||!Array.isArray(s.messages)||!Array.isArray(s.attachments)||!Number.isFinite(s.cooldown)||typeof s.draft!=='string')return null;
 s.answerTemplate=typeof s.answerTemplate==='string'?s.answerTemplate:'auto';
 if(typeof s.assistantConstraints!=='string')s.assistantConstraints='';
 if(s.assistantVisibilityVersion!==2){s.assistantOpen=s.exam.documents.length>0;s.assistantMobileOpen=false;s.assistantVisibilityVersion=2;}
 if(typeof s.assistantOpen!=='boolean'||typeof s.assistantMobileOpen!=='boolean')return null;
 if(s.selectedQuestion!==null&&(!Number.isInteger(s.selectedQuestion)||s.selectedQuestion<0||s.selectedQuestion>=n))return null;
 if(!Number.isInteger(s.fileIndex)||s.fileIndex<0||s.fileIndex>=Math.max(1,s.exam.documents.length)||s.draft.length>1000||s.messages.length>10||!s.messages.every(m=>m&&typeof m.input==='string'&&m.input.length<=1000&&typeof m.reply==='string'&&Array.isArray(m.files)&&m.files.every(f=>typeof f==='string')))return null;
 if(s.attachments.some(i=>!Number.isInteger(i)||i<0||i>=s.exam.documents.length))return null;
 return s;
 }catch{return null;}
}
