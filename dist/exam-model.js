export {questionType,typeLabel,answered,isCorrect} from './answers.js?v=20261015-guide3';
import {answered} from './answers.js?v=20261015-guide3';
export function configureExam(exam){
 return {...exam,intro:exam.intro+(exam.documents.length?'\n\n제공 자료:\n'+exam.documents.map(d=>d.name+'.txt').join('\n'):''),format:'choice'};
}
export function processSummary(s){
 const messages=s.auditLog?.length?s.auditLog:s.messages||[];
 return {successfulRequests:messages.length,withAttachments:messages.filter(m=>m.files?.length).length,selectedQuestion:messages.filter(m=>m.question!==null).length,finalSaved:s.answers.filter(answered).length};
}
