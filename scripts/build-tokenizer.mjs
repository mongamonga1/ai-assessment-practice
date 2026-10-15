import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({stdin:{contents:`import {Tiktoken} from 'js-tiktoken/lite'; import ranks from 'js-tiktoken/ranks/o200k_base'; export {Tiktoken,ranks};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',minify:true,outfile:'dist/vendor/tokenizer.js'});
await writeFile('dist/vendor/NOTICE.txt','js-tiktoken 1.0.21 (MIT), https://github.com/dqbd/tiktoken\n'+await readFile('scripts/tokenizer-license.txt','utf8')+'\nbase64-js (MIT)\n'+await readFile('node_modules/base64-js/LICENSE','utf8'));
