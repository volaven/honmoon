import {mediaSchema} from './media-contract.js';
import {z} from 'zod';
export const targetSchema=z.union([z.string().regex(/^b\d+$/),z.object({name:z.string().min(1).max(180),action:z.enum(['click','fill','select','check','upload'])}).strict()]);
export const observeSchema=z.object({query:z.string().max(180).optional(),limit:z.number().int().min(1).max(40).default(20)}).strict();
export const stepSchema=z.object({target:targetSchema,action:z.enum(['click','fill','select','check','upload']),value:z.string().max(6000).optional(),fileId:z.string().max(80).optional()}).strict();
export const conditionSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('text'),value:z.string().min(1).max(300)}).strict(),
 z.object({kind:z.literal('value'),target:targetSchema,value:z.string().max(300)}).strict(),
 z.object({kind:z.literal('exists'),target:targetSchema}).strict(),
 z.object({kind:z.literal('download')}).strict()
]);
export const executeSchema=z.object({state:z.string().min(1).max(80),requestId:z.string().min(1).max(100),steps:z.array(stepSchema).min(1).max(10),expect:z.array(conditionSchema).max(10).default([])}).strict();
export type ExecutionPlan=z.infer<typeof executeSchema>;
export const recoverSchema=z.object({level:z.enum(['accessibility','dom','screenshot'])}).strict();
const targetJson={description:'Observed control ID such as b2 (NOT a label string), or exact {name,action} for a future control.',anyOf:[{type:'string',pattern:'^b[0-9]+$'},{type:'object',properties:{name:{type:'string'},action:{type:'string',enum:['click','fill','select','check','upload']}},required:['name','action'],additionalProperties:false}]};
const conditionJson={anyOf:[
 {type:'object',properties:{kind:{const:'text',type:'string'},value:{type:'string',description:'Text to find. Example: 저장 완료'}},required:['kind','value'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'value',type:'string'},target:targetJson,value:{type:'string'}},required:['kind','target','value'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'exists',type:'string'},target:targetJson},required:['kind','target'],additionalProperties:false},
 {type:'object',properties:{kind:{const:'download',type:'string'}},required:['kind'],additionalProperties:false}
]};
export const compactTools=[
 {name:'honmoon_browser_observe',description:'Discover controls with schemas/options. Cache controls and apply changed/removed. Query by visible label to limit results. IDs/state are task scoped.',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:40}},additionalProperties:false}},
 {name:'honmoon_browser_execute',description:'Run up to 10 ordered actions locally with UI approvals, then verify expect conditions. Send the whole known workflow in one call. For a control that will appear later use exact {name,action}. Text evidence returns the matching snippet; download waits for completion. Do not re-observe after verified success or retry unknown effects.',inputSchema:{type:'object',properties:{state:{type:'string'},requestId:{type:'string'},steps:{type:'array',minItems:1,maxItems:10,items:{type:'object',properties:{target:targetJson,action:{type:'string',enum:['click','fill','select','check','upload']},value:{type:'string'},fileId:{type:'string'}},required:['target','action'],additionalProperties:false}},expect:{type:'array',maxItems:10,items:conditionJson}},required:['state','requestId','steps','expect'],additionalProperties:false}},
 {name:'honmoon_browser_recover',description:'After failure only: obtain related accessibility, then consented DOM, then screenshot. Does not repeat actions.',inputSchema:{type:'object',properties:{level:{type:'string',enum:['accessibility','dom','screenshot']}},required:['level'],additionalProperties:false}}
].map(t=>({...t,type:'function'}));

// Flat MCP shape; the executor validates one complete alternative before work.
export const executeToolSchema=z.object({...executeSchema.shape,steps:executeSchema.shape.steps.optional(),expect:executeSchema.shape.expect.optional(),workflow:z.literal('media.generate').optional(),kind:mediaSchema.shape.kind.optional(),sourceResultId:mediaSchema.shape.sourceResultId.optional(),prompt:mediaSchema.shape.prompt.optional(),fileIds:mediaSchema.shape.fileIds.optional(),options:mediaSchema.shape.options.optional(),download:mediaSchema.shape.download.optional()}).strict();
const executionTool=compactTools.find(t=>t.name==='honmoon_browser_execute')!;
const oldInput=executionTool.inputSchema;
executionTool.description+=' For Grok/Flow use workflow media.generate, state, requestId, kind image/video/image_to_video, prompt, optional fileIds (one user-selected image) and options. For image then video use image_to_video (2 submissions). To animate an existing Grok image use video with the observed sourceResultId. Never substitute text-to-video for image conversion. Grok video defaults to 480p. A returned job is pending, never success. The host completes it locally; do not poll or resubmit.';
(executionTool as any).inputSchema={type:'object',properties:{...oldInput.properties,workflow:{type:'string',const:'media.generate'},kind:{type:'string',enum:['image','video','image_to_video']},sourceResultId:{type:'string',format:'uuid'},prompt:{type:'string',maxLength:6000},fileIds:{type:'array',maxItems:1,items:{type:'string'}},options:{type:'object',properties:{model:{type:'string'},aspectRatio:{type:'string',enum:['1:1','16:9','9:16','4:3','3:4','2:3','3:2']},resolution:{type:'string'},duration:{type:'string'},audio:{type:'boolean'},count:{type:'integer',const:1}},additionalProperties:false},download:{type:'boolean',const:true}},required:['state','requestId'],additionalProperties:false,anyOf:[{required:['steps']},{required:['workflow','kind','prompt']}]};
