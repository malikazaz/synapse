import {z} from 'zod';
import {type Env,type Actor,assert,now} from './types';
export const libraryPreferences=z.object({collection:z.string().trim().max(80),pinned:z.boolean(),archived:z.boolean()}).strict();
export async function listPacks(env:Env,actor:Actor,offset=0){
  const rows=(await env.DB.prepare(`SELECT p.id,p.title,p.mode,p.origin,p.created_at,
    COALESCE(l.collection,'') collection,COALESCE(l.pinned,0) pinned,COALESCE(l.archived,0) archived,COALESCE(l.revision,0) library_revision,
    (SELECT COUNT(*) FROM questions q WHERE q.pack_id=p.id) question_count,
    (SELECT COUNT(*) FROM sessions s WHERE s.pack_id=p.id AND s.owner=p.owner) attempt_count,
    (SELECT COUNT(*) FROM sessions s WHERE s.pack_id=p.id AND s.owner=p.owner AND s.status='completed') completed_count,
    (SELECT MAX(COALESCE(s.completed_at,s.started_at)) FROM sessions s WHERE s.pack_id=p.id AND s.owner=p.owner) last_studied,
    (SELECT s.id FROM sessions s WHERE s.pack_id=p.id AND s.owner=p.owner AND s.status='active' ORDER BY s.started_at DESC LIMIT 1) active_session_id
    FROM packs p LEFT JOIN pack_library l ON l.pack_id=p.id AND l.owner=p.owner
    WHERE p.owner=? ORDER BY p.created_at DESC,p.id LIMIT 500 OFFSET ?`).bind(actor.id,offset).all<any>()).results;
  if(!rows.length)return [];
  const ids=JSON.stringify(rows.map(p=>p.id));
  const teachingBlocks=new Set((await env.DB.prepare('SELECT topic_block FROM curriculum_blocks').all<any>()).results.map(b=>b.topic_block));
  const tags=(await env.DB.prepare(`SELECT DISTINCT q.pack_id,json_extract(q.payload,'$.learningStage') stage,t.id topic_id,t.label,t.blocks
    FROM questions q LEFT JOIN mappings m ON m.question_id=q.id LEFT JOIN topics t ON t.id=m.topic_id
    WHERE q.pack_id IN (SELECT value FROM json_each(?))`).bind(ids).all<any>()).results;
  const byPack=new Map<string,any[]>();for(const t of tags){const entries=byPack.get(t.pack_id)??[];entries.push(t);byPack.set(t.pack_id,entries);}
  return rows.map(p=>{const entries=byPack.get(p.id)??[];return {...p,pinned:!!p.pinned,archived:!!p.archived,
    topics:[...new Map(entries.filter(t=>t.topic_id).map(t=>[t.topic_id,{id:t.topic_id,label:t.label}])).values()],
    blocks:[...new Set(entries.flatMap(t=>t.blocks?JSON.parse(t.blocks):[]).filter(b=>teachingBlocks.has(b)))],stages:[...new Set(entries.map(t=>t.stage).filter(Boolean))]};});
}
export async function saveLibraryPreferences(env:Env,actor:Actor,packId:string,input:unknown){
  const d=z.object({expectedRevision:z.number().int().nonnegative(),preferences:libraryPreferences}).strict().parse(input);
  const pack=await env.DB.prepare('SELECT id FROM packs WHERE id=? AND owner=?').bind(packId,actor.id).first();assert(pack,'Pack not found.',404);
  const r=await env.DB.prepare(`INSERT INTO pack_library(pack_id,owner,collection,pinned,archived,revision,updated_at)
    SELECT ?,?,?,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM pack_library WHERE pack_id=? AND owner=? AND revision=?)
    ON CONFLICT(pack_id) DO UPDATE SET collection=excluded.collection,pinned=excluded.pinned,archived=excluded.archived,revision=revision+1,updated_at=excluded.updated_at
    WHERE pack_library.owner=excluded.owner AND pack_library.revision=?`).bind(packId,actor.id,d.preferences.collection,Number(d.preferences.pinned),Number(d.preferences.archived),now(),d.expectedRevision,packId,actor.id,d.expectedRevision,d.expectedRevision).run();
  assert(r.meta.changes===1,'Pack organisation changed on another device. Refresh the library before trying again.',409);
  const saved=await env.DB.prepare('SELECT * FROM pack_library WHERE pack_id=? AND owner=?').bind(packId,actor.id).first<any>();
  return {collection:saved.collection,pinned:!!saved.pinned,archived:!!saved.archived,library_revision:saved.revision};
}
