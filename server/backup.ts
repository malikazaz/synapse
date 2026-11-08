import { z } from 'zod';
import { type Env,type Actor,assert } from './types';
import { question,uuid,eventInput,domain } from './schema';
import { fingerprint,replay } from '../shared/quiz.js';
import {studyPreferences} from './study';
import {libraryPreferences} from './library';
const tables=['topics','curriculum_blocks','curriculum_items','packs','pack_library','questions','mappings','mapping_proposals','sessions','mutations','answer_events','exclusions','reviews','audit','study_settings'] as const;
const columns:Record<string,string[]>={
  pack_library:['pack_id','owner','collection','pinned','archived','revision','updated_at'],
  curriculum_blocks:['id','year','label','topic_block','status','source_name','source_hash','imported_at'],
  curriculum_items:['id','block_id','source_label','source_type','topic_id','section','priority','source_locator','match_method','notes'],
  study_settings:['owner','revision','payload','updated_at'],
  topics:['id','label','type','systems','blocks','aliases','active'],
  packs:['id','owner','title','mode','origin','created_at','request_hash'],questions:['id','pack_id','position','payload','fingerprint'],mappings:['question_id','topic_id','domain','confirmed_at'],
  mapping_proposals:['id','pack_id','owner','payload','status','created_at'],sessions:['id','owner','pack_id','revision','status','started_at','completed_at','state','score','last_mutation'],
  mutations:['id','session_id','payload_hash','revision'],answer_events:['id','session_id','question_id','selection','sequence','answered_at','received_at'],exclusions:['fingerprint','reason','created_at'],reviews:['id','session_id','owner','payload','created_at'],audit:['id','owner','action','payload','created_at']
};
export async function exportBackup(env:Env,actor:Actor){
  // The deployment is single-owner. Assert ownership before exporting related tables.
  const foreign=await env.DB.prepare('SELECT count(*) n FROM packs WHERE owner<>?').bind(actor.id).first<any>();assert(!foreign.n,'Backup requires a single-owner database.',409);
  const data:Record<string,any[]>={};for(const t of tables)data[t]=t==='study_settings'?(await env.DB.prepare('SELECT * FROM study_settings WHERE owner=?').bind(actor.id).all<any>()).results:(await env.DB.prepare(`SELECT * FROM ${t}`).all<any>()).results;
  return {format:'synapse-backup-v3',exportedAt:new Date().toISOString(),data};
}
export async function restoreBackup(env:Env,actor:Actor,input:unknown){
  const b=z.object({format:z.enum(['synapse-backup-v1','synapse-backup-v2','synapse-backup-v3']),exportedAt:z.string().datetime(),data:z.record(z.string(),z.array(z.record(z.string(),z.unknown())).max(30000))}).strict().parse(input);
  if(b.format==='synapse-backup-v1'){assert(!Object.hasOwn(b.data,'study_settings'),'Invalid legacy backup.');b.data.study_settings=[];b.data.curriculum_blocks=[];b.data.curriculum_items=[];}
  if(b.format!=='synapse-backup-v3'){assert(!Object.hasOwn(b.data,'pack_library'),'Invalid legacy library.');b.data.pack_library=[];}
  assert(Object.keys(b.data).sort().join() === [...tables].sort().join(),'Backup table set is invalid.');
  for(const row of b.data.pack_library){uuid.parse(row.pack_id);assert(b.data.packs.some(p=>p.id===row.pack_id),'Unknown library pack.');assert([0,1].includes(Number(row.pinned))&&[0,1].includes(Number(row.archived)),'Invalid library state.');libraryPreferences.parse({collection:row.collection,pinned:!!row.pinned,archived:!!row.archived});z.number().int().positive().parse(row.revision);z.iso.datetime().parse(row.updated_at);}
  assert(b.data.study_settings.length<=1,'Backup contains multiple study plans.');
  for(const row of b.data.study_settings){studyPreferences.parse(JSON.parse(String(row.payload)));z.number().int().positive().parse(row.revision);z.iso.datetime().parse(row.updated_at);}
  if(b.data.study_settings.length){const saved=await env.DB.prepare('SELECT owner FROM study_settings WHERE owner=?').bind(actor.id).first();assert(!saved,'Restore requires an account without saved study settings; export your current plan first.',409);}
  const occupied=await env.DB.prepare('SELECT count(*) n FROM packs').first<any>();assert(!occupied.n,'Restore requires an empty account; export your existing data first.',409);
  const qs=new Map<string,any>();
  const known=(await env.DB.prepare('SELECT id,type FROM topics').all<any>()).results;
  for(const row of b.data.topics){assert(typeof row.id==='string'&&/^[CP][A-Za-z0-9_-]+$/.test(row.id)&&typeof row.label==='string'&&['Condition','Presentation'].includes(String(row.type)),'Invalid backup topic.');assert(!known.some(t=>t.id===row.id&&t.type!==row.type),'Topic type changed.');for(const field of ['systems','blocks','aliases'])z.array(z.string()).parse(JSON.parse(String(row[field])));assert(row.active===0||row.active===1,'Invalid topic state.');}
  for(const row of b.data.questions){const q=question.parse(JSON.parse(String(row.payload)));assert(await fingerprint(q)===row.fingerprint,'Question fingerprint mismatch.');qs.set(uuid.parse(row.id),{...q,id:row.id,packId:row.pack_id});}
  for(const row of b.data.sessions){
    const state=JSON.parse(String(row.state)),events=z.array(eventInput).parse(state.events);const packQs=[...qs.values()].filter(q=>q.packId===row.pack_id);
    assert(packQs.length>0&&Array.isArray(state.order)&&state.order.length===packQs.length&&new Set(state.order).size===packQs.length&&state.order.every((id:string)=>packQs.some(q=>q.id===id)),'Invalid backup question order.');
    const result=replay(packQs,events);assert(result.score===row.score,'Backup score mismatch.');assert(['active','completed','ended','discarded'].includes(String(row.status)),'Invalid session status.');
    if(row.status!=='completed')assert(!row.completed_at,'Only completed sessions may award assessment evidence.');
    if(row.status==='completed')assert(result.answered===packQs.length&&!!row.completed_at,'Incomplete session marked complete.');
    const stored=b.data.answer_events.filter(e=>e.session_id===row.id).sort((a,b)=>Number(a.sequence)-Number(b.sequence));
    assert(stored.length===events.length&&stored.every((e,i)=>e.id===events[i].id&&e.question_id===events[i].questionId&&e.selection===events[i].selection&&e.sequence===i&&e.answered_at===events[i].at),'Backup answer history is inconsistent.');
  }
  for(const m of b.data.mappings)domain.parse(m.domain);
  const stmts=[];
  let rowCount=0;
  for(const table of tables){const normalized=[];for(const row of b.data[table]){
    const cols=columns[table];assert(Object.keys(row).every(k=>cols.includes(k))&&cols.every(k=>Object.hasOwn(row,k)),'Invalid backup columns.');
    const values=cols.map(k=>k==='owner'?actor.id:row[k]);assert(values.every(v=>v===null||typeof v==='string'||typeof v==='number'),'Invalid backup value.');
    normalized.push(Object.fromEntries(cols.map((k,i)=>[k,values[i]])));rowCount++;
  }if(normalized.length){const cols=columns[table];const conflict=table==='topics'?" WHERE true ON CONFLICT(id) DO UPDATE SET label=excluded.label,systems=excluded.systems,blocks=excluded.blocks,aliases=excluded.aliases,active=excluded.active":'';stmts.push(env.DB.prepare(`INSERT INTO ${table}(${cols.join(',')}) SELECT ${cols.map(k=>`json_extract(value,'$.${k}')`).join(',')} FROM json_each(?)${conflict}`).bind(JSON.stringify(normalized)));}}
  assert(rowCount<=5000,'Restore exceeds the initial 5,000-row transaction limit; use the documented D1 backup procedure.');
  stmts.push(env.DB.prepare('INSERT INTO sync_jobs(id,owner,next_at,updated_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor.id,new Date().toISOString(),new Date().toISOString()));
  await env.DB.batch(stmts);return {restored:true};
}
