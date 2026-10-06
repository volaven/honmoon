import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {packageTarget} from './package-target.mjs';
const target=packageTarget();
if(process.platform!=='darwin'||target.platform!=='darwin')throw Error('Run on macOS');
const {version}=JSON.parse(readFileSync('package.json','utf8'));
const file=`HONMOON-${version}-macos-${target.arch}.zip`;
// ditto preserves macOS symlinks and executable permissions.
execFileSync('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',target.directory,join('release',file)]);
const sha256=createHash('sha256').update(readFileSync(join('release',file))).digest('hex');
writeFileSync(join('release',file+'.sha256'),`${sha256}  ${file}\n`);
writeFileSync(join('release',`honmoon-macos-${target.arch}.json`),JSON.stringify({version,platform:'darwin',arch:target.arch,file,sha256,signing:'ad-hoc',notarized:false},null,2));
copyFileSync('scripts/install-macos.sh','release/install-macos.sh');
console.log(file);
