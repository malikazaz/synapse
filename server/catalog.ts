import {z} from 'zod';
import {type Env,type Actor,assert,now} from './types';
import {topics} from './store';
import {digest} from '../shared/quiz.js';
const topic=z.object({id:z.string().regex(/^[CP][A-Za-z0-9_-]+$/),label:z.string().min(1).max(1000),type:z.enum(['Condition','Presentation']),systems:z.array(z.string().max(200)).max(30),blocks:z.array(z.string().max(200)).max(30),aliases:z.array(z.string().max(1000)).max(30)}).strict();
const input=z.object({topics:z.array(topic).min(1).max(2000)}).strict();
export async function previewCatalog(env:Env,actor:Actor,value:unknown){
  const data=input.parse(value);assert(new Set(data.topics.map(t=>t.id)).size===data.topics.length,'Duplicate topic IDs.');
  const old=await topics(env),prior=new Map(old.map(t=>[t.id,t]));const newNames=new Set();
  for(const t of data.topics){const key=t.type+':'+t.label.trim().toLowerCase();assert(!newNames.has(key),'Duplicate labels within one topic type.');newNames.add(key);const p=prior.get(t.id);if(p){assert(p.type===t.type,'Existing topic type cannot change.');assert(t.label===p.label||t.aliases.includes(p.label),'A rename must retain the previous label as an explicit alias.');}}
  const currentHash=await digest(old),previewId=crypto.randomUUID();
  const changes=data.topics.filter(t=>{const p=prior.get(t.id);return !p||['label','systems','blocks','aliases'].some(k=>JSON.stringify((t as any)[k])!==JSON.stringify(p[k]));});
  await env.DB.prepare('INSERT INTO settings VALUES(?,?)').bind('catalog-preview:'+previewId,JSON.stringify({owner:actor.id,data,currentHash,expiresAt:Date.now()+3600000})).run();
  return {previewId,changes,preservedAbsent:old.filter(t=>!data.topics.some(n=>n.id===t.id)).map(t=>t.id),message:'Omitted topics and their history are preserved. Confirm to apply these exact changes.'};
}
export async function confirmCatalog(env:Env,actor:Actor,id:string){
  const row=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('catalog-preview:'+id).first<any>();assert(row,'Preview not found.',404);const preview=JSON.parse(row.value);assert(preview.owner===actor.id&&preview.expiresAt>Date.now(),'Preview expired.',403);
  assert(preview.currentHash===await digest(await topics(env)),'Catalogue changed; generate a fresh preview.',409);
  const data=input.parse(preview.data),time=now();const stmts=[env.DB.prepare("INSERT INTO topics(id,label,type,systems,blocks,aliases) SELECT json_extract(value,'$.id'),json_extract(value,'$.label'),json_extract(value,'$.type'),json_extract(value,'$.systems'),json_extract(value,'$.blocks'),json_extract(value,'$.aliases') FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET label=excluded.label,systems=excluded.systems,blocks=excluded.blocks,aliases=excluded.aliases").bind(JSON.stringify(data.topics))];
  stmts.push(env.DB.prepare('DELETE FROM settings WHERE key=?').bind('catalog-preview:'+id));stmts.push(env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'catalog_import',JSON.stringify(data),time));stmts.push(env.DB.prepare('INSERT INTO sync_jobs(id,owner,next_at,updated_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor.id,time,time));await env.DB.batch(stmts);return {updated:true};
}
