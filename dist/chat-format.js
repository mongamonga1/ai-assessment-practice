import {escape} from './documents.js?v=20261015-guide3';
const inline=text=>escape(text).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
// Only generate known markup after escaping the model's entire source text.
export function chatHtml(text){
 const lines=String(text).split('\n'),out=[];
 for(let i=0;i<lines.length;i++){
  if(lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')){
   const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(v=>v.trim());
   const header=cells(lines[i]);i+=2;const rows=[];
   while(i<lines.length&&lines[i].includes('|'))rows.push(cells(lines[i++]));i--;
   out.push(`<div class="chatTable"><table><thead><tr>${header.map(v=>`<th>${inline(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${inline(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  }else out.push(inline(lines[i].replace(/^#{1,6}\s+/,'')));
 }
 return out.join('\n');
}
