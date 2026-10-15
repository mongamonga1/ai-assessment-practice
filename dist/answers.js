export const questionType=q=>q.type||'choice';
export const typeLabel=()=>'객관식';
export const answered=v=>Number.isInteger(v)&&v>=0;
export const isCorrect=(q,value)=>value===q.answer;
