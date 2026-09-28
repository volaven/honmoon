import {build} from 'esbuild';
await build({entryPoints:['packages/mcp/index.ts'],outfile:'dist/mcp/bridge.cjs',bundle:true,platform:'node',format:'cjs',target:'node24',legalComments:'eof'});
