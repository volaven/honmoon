import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));const packages=[];
for(const [path,p] of Object.entries(lock.packages)){if(!path||p.dev||p.link||!path.startsWith('node_modules/'))continue;let pkg=p;try{pkg=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));}catch{}packages.push({name:pkg.name||path.split('node_modules/').pop(),version:p.version,license:pkg.license||p.license||'See package license',path});}
mkdirSync('licenses',{recursive:true});writeFileSync('licenses/npm-production.json',JSON.stringify(packages,null,2));
console.log('Production license entries:',packages.length);
