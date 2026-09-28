import {readFileSync,writeFileSync} from 'node:fs';
const [source,visual]=process.argv.slice(2);
const data=JSON.parse(readFileSync(source,'utf8'));
const file=readFileSync(visual,'utf8');
if(!file.includes('/*BENCHMARK_DATA*/null'))throw new Error('Expected empty visualization data slot');
writeFileSync(visual,file.replace('/*BENCHMARK_DATA*/null',JSON.stringify(data).replaceAll('<','\\u003c')));
