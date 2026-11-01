import {z} from 'zod';
import {type Env,type Actor,assert,now} from './types';
import {uuid} from './schema';
const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Use a valid calendar date.');
export const studyPreferences=z.object({
  exams:z.array(z.object({id:uuid,name:z.string().trim().min(1).max(120),date:calendarDate,blocks:z.array(z.string().min(1).max(120)).max(30).default([])}).strict()).max(12),
  activeBlocks:z.array(z.string().min(1).max(120)).max(30),
  recallFirst:z.boolean(),foundationPackSize:z.number().int().min(5).max(40)
}).strict().refine(p=>new Set(p.exams.map(e=>e.id)).size===p.exams.length,'Exam IDs must be unique.');
export const defaultStudyPreferences=()=>({exams:[],activeBlocks:[],recallFirst:true,foundationPackSize:10});
export async function getStudySettings(env:Env,actor:Actor){const row=await env.DB.prepare('SELECT * FROM study_settings WHERE owner=?').bind(actor.id).first<any>();return row?{revision:row.revision,updatedAt:row.updated_at,...studyPreferences.parse(JSON.parse(row.payload))}:{revision:0,updatedAt:null,...defaultStudyPreferences()};}
export async function saveStudySettings(env:Env,actor:Actor,input:unknown){
  const d=z.object({expectedRevision:z.number().int().nonnegative(),preferences:studyPreferences}).strict().parse(input);
  const blocks=[...d.preferences.activeBlocks,...d.preferences.exams.flatMap(e=>e.blocks)];
  if(blocks.length){const rows=(await env.DB.prepare('SELECT blocks FROM topics WHERE active=1').all<any>()).results;const known=new Set(rows.flatMap(r=>JSON.parse(r.blocks)));assert(blocks.every(b=>known.has(b)),'Unknown study block.');}
  const r=await env.DB.prepare('INSERT INTO study_settings(owner,revision,payload,updated_at) SELECT ?,1,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM study_settings WHERE owner=? AND revision=?) ON CONFLICT(owner) DO UPDATE SET revision=revision+1,payload=excluded.payload,updated_at=excluded.updated_at WHERE study_settings.revision=?').bind(actor.id,JSON.stringify(d.preferences),now(),d.expectedRevision,actor.id,d.expectedRevision,d.expectedRevision).run();
  assert(r.meta.changes===1,'Study settings changed on another device. Reload before saving; your form has been kept.',409);
  return getStudySettings(env,actor);
}
