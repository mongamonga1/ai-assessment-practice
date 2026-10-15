import {assistantRequest} from './assistant.js?v=20261015-review1';
import {questionType} from './answers.js?v=20261015-review1';
import {attachmentTokens,TOKEN_LIMIT,setAttachments} from './tokens.js?v=20261015-review1';
import {modelPrompt} from './model-prompts.js?v=20261015-review1';
export function createPractice(exam,{rehearsal=false,minutes=20,now=Date.now(),interactionMode='free',hintLimit=10}={}){
 const data=rehearsal&&interactionMode==='free'?{...exam,questions:exam.questions.slice(0,2)}:exam;
 return {version:1,exam:data,index:0,answers:data.questions.map(()=>null),flags:data.questions.map(()=>false),notes:data.questions.map(()=>''),graded:false,rehearsal,interactionMode,hintLimit,hints:hintLimit,deadline:rehearsal||minutes===0?null:now+minutes*60000,messages:[],auditLog:[],reviewMessages:[],reviewRequests:0,fileIndex:0,attachments:[],selectedQuestion:null,draft:'',cooldown:0,assistantOpen:data.documents.length>0,assistantMobileOpen:false,assistantVisibilityVersion:2,completedReason:null,zoom:100};
}
export function timeLeft(s,now=Date.now()){return s.deadline===null?null:Math.max(0,Math.ceil((s.deadline-now)/1000));}
export function cooldownLeft(s,now=Date.now()){return Math.max(0,Math.ceil((s.cooldown-now)/1000));}
export function selectAnswer(s,index,value){if(s.graded||timeLeft(s)===0)return false;const q=s.exam.questions[index];if(!q||!Number.isInteger(value)||value<0||value>=q.options.length)return false;s.answers[index]=value;return true;}
export function finishPractice(s,reason='submitted'){if(s.graded)return false;s.graded=true;s.completedReason=reason;s.draft='';s.attachments=[];return true;}
export const isReview=s=>s.graded&&!s.rehearsal;
export const assistantHistory=s=>isReview(s)?s.reviewMessages||[]:s.messages;
export async function submitHint(s,input,now=Date.now(),request=async payload=>{
 const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 let data;try{data=await response.json();}catch{throw new Error('AI 서버를 사용할 수 없습니다. npm start로 실행한 로컬 페이지에서 이용하세요.');}
 if(!response.ok)throw new Error(data.error||'AI 요청에 실패했습니다.');
 return data;
}){
 const review=isReview(s);
 if(pending.has(s)||(s.graded&&!review)||(!review&&(s.hints===0||cooldownLeft(s,now)>0||timeLeft(s,now)===0)))return {ok:false,error:'현재 질문을 전송할 수 없습니다.'};
 const text=input.trim();if(!text||text.length>1000)return {ok:false,error:'질문은 1–1,000자로 입력하세요.'};
 if(s.interactionMode==='guide'&&attachmentTokens(s.exam,s.attachments)>TOKEN_LIMIT)return {ok:false,error:'첨부 파일은 최대 20,000토큰입니다.'};
 const payload=assistantRequest({...s,messages:assistantHistory(s)},text),question=s.selectedQuestion,files=payload.documents.map(d=>d.name+'.txt');
 const previousCooldown=s.cooldown;
 if(!review&&s.interactionMode==='guide')s.cooldown=now+30000;
 pending.add(s);
 try{
  const result=await request(payload);
  if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('AI가 빈 답변을 반환했습니다.');
  const message={input:text,reply:result.reply,question,currentQuestion:payload.currentQuestion,context:result.context,files,documents:payload.documents,source:'openai'};
  if(review){s.reviewMessages=[...assistantHistory(s),message].slice(-10);s.reviewRequests=(s.reviewRequests||0)+1;}
  else{
   s.messages=[...s.messages,message].slice(-10);
   s.auditLog??=[];s.auditLog.push({at:new Date().toISOString(),input:text,reply:result.reply,question,files,source:'openai'});
   s.hints--;if(s.interactionMode!=='guide')s.cooldown=Math.max(Date.now(),now)+30000;
  }
  if(review||!s.graded){s.attachments=[];s.draft='';}
  return {ok:true,reply:result.reply};
 }catch(error){s.cooldown=previousCooldown;return {ok:false,error:error.message||'AI 연결에 실패했습니다. 다시 시도하세요.'};}
 finally{pending.delete(s);}
}
const pending=new WeakSet();
export const hintPending=s=>pending.has(s);
export function preparePromptReview(s,index){
 if(!isReview(s)||!Number.isInteger(index)||!s.exam.questions[index])return {ok:false,error:'채점된 문제를 선택하세요.'};
 if(pending.has(s))return {ok:false,error:'현재 AI 답변이 끝난 뒤 다시 실행하세요.'};
 const q=s.exam.questions[index],names=new Set((q.evidence||[]).map(e=>e.document));
 const indices=s.exam.documents.map((d,i)=>names.has(d.name)?i:-1).filter(i=>i>=0);
 if(indices.length<names.size)return {ok:false,error:'모범 프롬프트에 필요한 원본 자료를 찾지 못했습니다. 첨부 자료를 확인하세요.'};
 const result=setAttachments(s,names.size?indices:s.exam.documents.map((_,i)=>i));
 if(!result.ok)return result;
 s.index=index;s.selectedQuestion=index;s.draft=modelPrompt(s.exam,index);
 s.answerTemplate='auto';s.assistantConstraints='';s.assistantOpen=true;s.assistantMobileOpen=true;
 return {ok:true};
}
export function restorePractice(raw){
 try{const s=JSON.parse(raw);if(!s||s.version!==1||!s.exam||!Array.isArray(s.exam.questions)||!s.exam.questions.length||s.exam.questions.length>30)return null;const n=s.exam.questions.length;if(![s.answers,s.flags,s.notes].every(a=>Array.isArray(a)&&a.length===n))return null;
 if(!Number.isInteger(s.index)||s.index<0||s.index>=n||!s.exam.questions.every(q=>questionType(q)==='choice'&&Array.isArray(q.options)&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length))return null;
 if(!s.answers.every((v,i)=>v===null||Number.isInteger(v)&&v>=0&&v<s.exam.questions[i].options.length)||!s.notes.every(x=>typeof x==='string'&&x.length<=2000)||!s.flags.every(x=>typeof x==='boolean'))return null;
 if(typeof s.graded!=='boolean'||typeof s.rehearsal!=='boolean'||(s.deadline!==null&&!Number.isFinite(s.deadline))||!Number.isInteger(s.hints)||s.hints<0||s.hints>100||!Array.isArray(s.exam.documents)||!Array.isArray(s.messages)||!Array.isArray(s.attachments)||!Number.isFinite(s.cooldown)||typeof s.draft!=='string')return null;
 if(s.auditLog!==undefined&&(!Array.isArray(s.auditLog)||s.auditLog.length>100||!s.auditLog.every(m=>m&&typeof m.input==='string'&&m.input.length<=1000&&typeof m.reply==='string'&&m.reply.length<=20000&&Array.isArray(m.files)&&m.files.every(f=>typeof f==='string'))))return null;
 if(s.reviewMessages===undefined)s.reviewMessages=[];
 if(s.reviewRequests===undefined)s.reviewRequests=0;
 if(!Number.isSafeInteger(s.reviewRequests)||s.reviewRequests<0||!Array.isArray(s.reviewMessages)||s.reviewMessages.length>10||!s.reviewMessages.every(m=>m&&typeof m.input==='string'&&m.input.length<=1000&&typeof m.reply==='string'&&m.reply.length<=20000&&Array.isArray(m.files)&&m.files.every(f=>typeof f==='string')))return null;
 s.interactionMode=s.interactionMode==='guide'?'guide':'free';
 s.hintLimit=Number.isInteger(s.hintLimit)&&s.hintLimit>=1&&s.hintLimit<=100?s.hintLimit:10;
 if(s.hints>s.hintLimit)return null;
 s.zoom=Number.isFinite(s.zoom)?Math.min(150,Math.max(50,s.zoom)):100;
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
