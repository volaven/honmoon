import {parseArgs} from 'node:util';
import {agentBrowserName,packageLayout} from '../dist/main/platform.js';
export function packageTarget(){
 const {values}=parseArgs({options:{platform:{type:'string'},arch:{type:'string'}}});
 const platform=values.platform||process.env.HONMOON_PACKAGE_PLATFORM||process.platform;
 const arch=values.arch||process.env.HONMOON_PACKAGE_ARCH||process.arch;
 const variant=process.env.HONMOON_PACKAGE_VARIANT||'';
 return {platform,arch,variant,nativeName:agentBrowserName(platform,arch),...packageLayout(platform,arch,variant)};
}
