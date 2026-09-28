import {tools} from '../packages/codex-adapter/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
const capture=JSON.parse(readFileSync('evidence/token-capture.json','utf8'));
capture.originalToolDefinitions??=capture.toolDefinitions;
capture.toolDefinitions=tools;
capture.toolDefinitionsUpdatedAt=new Date().toISOString();
writeFileSync('evidence/token-capture.json',JSON.stringify(capture,null,2));
