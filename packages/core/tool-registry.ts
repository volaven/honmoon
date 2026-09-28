import {z} from 'zod';
import {observeSchema,executeToolSchema,recoverSchema} from './browser-contract.js';
export const registry={
 'sessions.list':{schema:z.object({}).strict(),owner:false,compact:true},
 'tabs.list':{schema:z.object({}).strict(),owner:false,compact:true},
 'tasks.start':{schema:z.object({tabId:z.string(),prompt:z.string(),model:z.string().optional(),reasoningEffort:z.enum(['low','medium','high']).optional()}).strict(),owner:false,compact:true},
 'tasks.status':{schema:z.object({}).strict(),owner:true,compact:true},
 'tasks.cancel':{schema:z.object({}).strict(),owner:true,compact:true},
 'tasks.finish':{schema:z.object({success:z.boolean(),summary:z.string()}).strict(),owner:true,compact:true},
 'artifacts.list':{schema:z.object({}).strict(),owner:true,compact:true},
 'browser.observe':{schema:observeSchema,owner:true,compact:true},
 'browser.execute':{schema:executeToolSchema,owner:true,compact:true},
 'browser.recover':{schema:recoverSchema,owner:true,compact:true},
 'capabilities.list':{schema:z.object({}).strict(),owner:true,compact:false},
 'capabilities.find':{schema:z.object({query:z.string(),action:z.enum(['click','fill','select','check','upload']).optional(),limit:z.number().int().min(1).max(12).optional()}).strict(),owner:true,compact:false},
 'capabilities.inspect':{schema:z.object({id:z.string()}).strict(),owner:true,compact:false},
 'capabilities.invoke':{schema:z.object({id:z.string(),input:z.object({value:z.string().optional(),fileId:z.string().optional()}).strict(),requestId:z.string()}).strict(),owner:true,compact:false},
 'page.read':{schema:z.object({}).strict(),owner:true,compact:false},
 'page.inspect':{schema:recoverSchema,owner:true,compact:false}
} as const;
export function toolDefinition(name:string){return registry[name as keyof typeof registry];}
