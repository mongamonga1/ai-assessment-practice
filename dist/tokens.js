import {Tiktoken,ranks} from './vendor/tokenizer.js';
import {documentText} from './documents.js?v=20261015-guide3';
const tokenizer=new Tiktoken(ranks);
export const TOKEN_LIMIT=20000;
export const tokenCount=text=>tokenizer.encode(String(text),[],[]).length;
const cache=new WeakMap();
export function documentTokens(doc){if(!cache.has(doc))cache.set(doc,tokenCount(documentText(doc)));return cache.get(doc);}
export function attachmentTokens(exam,indices){return [...new Set(indices)].reduce((sum,i)=>sum+(exam.documents[i]?documentTokens(exam.documents[i]):0),0);}
export function setAttachments(state,indices){
 const next=[...new Set(indices)].filter(i=>Number.isInteger(i)&&state.exam.documents[i]);
 const tokens=attachmentTokens(state.exam,next);
 if(state.interactionMode==='guide'&&tokens>TOKEN_LIMIT)return {ok:false,error:`첨부 ${tokens.toLocaleString()}토큰: 최대 20,000토큰입니다. 자료를 나누어 질문하세요.`};
 state.attachments=next;return {ok:true,tokens};
}
