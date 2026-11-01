import { z } from 'zod';
import { packInput, updateInput, proposalInput, reviewInput, uuid } from './schema';
import { assert, HttpError, now, type Env, type Actor } from './types';
import { fingerprint, digest, replay, balancedKey, LETTERS, DOMAINS } from '../shared/quiz.js';
import { calculateCompetency, eligibleEvidence } from '../shared/competency.js';
import {learningProgress} from '../shared/learning.js';

export async function topics(env: Env) {
  const { results } = await env.DB.prepare('SELECT * FROM topics WHERE active=1 ORDER BY type,label').all<any>();
  return results.map(r => ({ ...r, systems: JSON.parse(r.systems), blocks: JSON.parse(r.blocks), aliases: JSON.parse(r.aliases) }));
}
export async function getPack(env: Env, actor: Actor, id: string) {
  const p = await env.DB.prepare('SELECT * FROM packs WHERE id=? AND owner=?').bind(id, actor.id).first<any>();
  assert(p, 'Pack not found.', 404);
  const { results } = await env.DB.prepare('SELECT q.*,m.topic_id,m.domain FROM questions q LEFT JOIN mappings m ON m.question_id=q.id WHERE pack_id=? ORDER BY position').bind(id).all<any>();
  return { ...p, questions: results.map(q => ({ ...JSON.parse(q.payload), id:q.id, fingerprint:q.fingerprint, original_q_number:q.position+1, topicId:q.topic_id || null, domain:q.domain || null })) };
}
export async function savePack(env: Env, actor: Actor, input: unknown, origin: 'imported' | 'chatgpt') {
  const data = packInput.parse(input);
  const hash = await digest(data);
  const old = await env.DB.prepare('SELECT request_hash FROM packs WHERE id=? AND owner=?').bind(data.requestId, actor.id).first<any>();
  if (old) { assert(old.request_hash === hash, 'Request ID already used for different content.', 409); return getPack(env,actor,data.requestId); }
  const known = new Set((await topics(env)).map(t=>t.id));
  const key = data.answerKey ?? (origin === 'chatgpt' ? balancedKey(data.questions.length) : data.questions.map(q=>q.answer).join(''));
  assert(key.length === data.questions.length, 'Answer key length must match the pack.');
  const qs = await Promise.all(data.questions.map(async(q,i) => {
    assert((!!q.topicId === !!q.domain), 'Supply both topic and domain, or neither.');
    if (q.topicId) assert(known.has(q.topicId), 'Unknown topic ID.');
    if (origin === 'chatgpt') assert(q.sources.length && q.explanation.trim() && q.topicId && q.domain, 'Generated questions require sources, explanation and a primary mapping.');
    if(origin==='chatgpt'){
      assert(q.learningStage&&q.difficulty&&q.learningObjective&&q.optionRationales,'Generated questions require learningStage, difficulty, learningObjective and optionRationales for all five choices. Read get_akt_generation_skill.');
      assert(new Set(Object.values(q.options).map(s=>s.trim().toLowerCase())).size===5,'Options must be distinct.');
      assert(!Object.values(q.options).some(s=>/^(all|none) of the above[.!]?$/i.test(s.trim())),'Use specific, plausible options instead of all/none of the above.');
      assert(q.sources.every(s=>Date.parse(s.retrievedAt)<=Date.now()+300000),'Source retrieval dates cannot be in the future.');
    }
    const options = { ...q.options };
    const optionRationales=q.optionRationales?{...q.optionRationales}:undefined;
    const answer = key[i] as keyof typeof options;
    if (answer !== q.answer) { [options[answer], options[q.answer]] = [options[q.answer], options[answer]];if(optionRationales)[optionRationales[answer],optionRationales[q.answer]]=[optionRationales[q.answer],optionRationales[answer]]; }
    const clean = { ...q, options, answer,...(optionRationales?{optionRationales}:{}) };
    return { id:crypto.randomUUID(), payload:clean, fingerprint:await fingerprint(clean), position:i };
  }));
  const time = now();
  const statements = [env.DB.prepare('INSERT INTO packs(id,owner,title,mode,origin,created_at,request_hash) VALUES(?,?,?,?,?,?,?)').bind(data.requestId,actor.id,data.title,data.mode,origin,time,hash)];
  statements.push(env.DB.prepare("INSERT INTO questions(id,pack_id,position,payload,fingerprint) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.position'),json_extract(value,'$.payload'),json_extract(value,'$.fingerprint') FROM json_each(?)").bind(data.requestId,JSON.stringify(qs)));
  if(origin==='chatgpt')statements.push(env.DB.prepare("INSERT INTO mappings SELECT json_extract(value,'$.id'),json_extract(value,'$.payload.topicId'),json_extract(value,'$.payload.domain'),? FROM json_each(?)").bind(time,JSON.stringify(qs)));
  await env.DB.batch(statements);
  return getPack(env,actor,data.requestId);
}
export async function createSession(env: Env, actor: Actor, input: unknown) {
  const d = z.object({id:uuid,packId:uuid,order:z.array(uuid).min(1).max(200)}).strict().parse(input);
  const p = await getPack(env,actor,d.packId);
  assert(d.order.length === p.questions.length && new Set(d.order).size === d.order.length && d.order.every(id=>p.questions.some((q:any)=>q.id===id)), 'Question order must include each question exactly once.');
  await env.DB.prepare('INSERT OR IGNORE INTO sessions(id,owner,pack_id,started_at,state) VALUES(?,?,?,?,?)').bind(d.id,actor.id,d.packId,now(),JSON.stringify({events:[],order:d.order,currentIndex:0})).run();
  const s = await getSession(env,actor,d.id);
  assert(s.pack_id===d.packId && JSON.stringify(s.state.order)===JSON.stringify(d.order),'Session ID already used.',409);
  return s;
}
export async function getSession(env: Env, actor: Actor, id: string) {
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE id=? AND owner=?').bind(id,actor.id).first<any>();
  assert(s,'Session not found.',404);
  return {...s,state:JSON.parse(s.state)};
}
export function applyUpdate(s: any, pack: any, data: z.infer<typeof updateInput>) {
  assert(s.status==='active','Session already completed.',409);
  assert(s.revision===data.expectedRevision,'Session changed on another device.',409);
  const all = [...s.state.events,...data.events];
  assert(new Set(all.map(e=>e.id)).size===all.length,'Duplicate answer event.');
  assert(data.currentIndex < pack.questions.length,'Invalid question index.');
  const result = replay(pack.questions,all);
  if (data.complete) assert(result.answered===pack.questions.length,'Attempt every question before finishing.');
  return { state:{...s.state,events:all,currentIndex:data.currentIndex},score:result.score };
}
export async function updateSession(env: Env, actor: Actor, id: string, input: unknown) {
  const d = updateInput.parse(input), hash = await digest(d);
  const existing = await env.DB.prepare('SELECT * FROM mutations WHERE id=? AND session_id=?').bind(d.mutationId,id).first<any>();
  if(existing) { assert(existing.payload_hash===hash,'Mutation ID reused.',409); return getSession(env,actor,id); }
  const s = await getSession(env,actor,id), pack=await getPack(env,actor,s.pack_id);
  const next=applyUpdate(s,pack,d), time=now();
  for (const e of d.events) assert(Date.parse(e.at)<=Date.now()+300000,'Answer timestamp is in the future.');
  const guard='EXISTS(SELECT 1 FROM sessions WHERE id=? AND last_mutation=?)';
  const stmts=[env.DB.prepare('UPDATE sessions SET state=?,score=?,revision=revision+1,status=?,completed_at=?,last_mutation=? WHERE id=? AND owner=? AND revision=? AND status=\'active\'').bind(JSON.stringify(next.state),next.score,d.complete?'completed':'active',d.complete?time:null,d.mutationId,id,actor.id,d.expectedRevision)];
  if(d.events.length)stmts.push(env.DB.prepare(`INSERT INTO answer_events SELECT json_extract(value,'$.id'),?,json_extract(value,'$.questionId'),json_extract(value,'$.selection'),?+CAST(key AS INTEGER),json_extract(value,'$.at'),? FROM json_each(?) WHERE ${guard}`).bind(id,s.state.events.length,time,JSON.stringify(d.events),id,d.mutationId));
  stmts.push(env.DB.prepare(`INSERT INTO mutations SELECT ?,?,?,? WHERE ${guard}`).bind(d.mutationId,id,hash,s.revision+1,id,d.mutationId));
  if(d.complete) stmts.push(env.DB.prepare(`INSERT INTO sync_jobs(id,owner,next_at,updated_at) SELECT ?,?,?,? WHERE ${guard}`).bind(d.mutationId,actor.id,time,time,id,d.mutationId));
  const result=await env.DB.batch(stmts);
  assert(result[0].meta.changes===1,'Session changed on another device.',409);
  return getSession(env,actor,id);
}
export async function evidence(env: Env, actor: Actor) {
  const {results}=await env.DB.prepare(`WITH first_answers AS (
    SELECT e.*,e.rowid AS exposure_order,row_number() OVER(PARTITION BY e.session_id,e.question_id ORDER BY e.sequence) AS n FROM answer_events e JOIN sessions s ON s.id=e.session_id WHERE s.owner=?
  ) SELECT e.id AS eventId,e.exposure_order AS exposureOrder,q.fingerprint,e.session_id AS sessionId,e.received_at AS exposedAt,s.completed_at AS completedAt,m.topic_id AS topicId,m.domain,e.selection,q.payload,x.fingerprint AS excluded
  FROM first_answers e JOIN questions q ON q.id=e.question_id JOIN sessions s ON s.id=e.session_id
  LEFT JOIN mappings m ON m.question_id=q.id LEFT JOIN exclusions x ON x.fingerprint=q.fingerprint WHERE e.n=1`).bind(actor.id).all<any>();
  return results.map(r=>({...r,correct:r.selection===JSON.parse(r.payload).answer,learningStage:JSON.parse(r.payload).learningStage??null}));
}
export async function progress(env: Env, actor: Actor) {
  const [ts,ev]=await Promise.all([topics(env),evidence(env,actor)]);
  const eligible=eligibleEvidence(ev);
  return ts.map(t=>{const rows=eligible.filter(e=>e.topicId===t.id);return {...t,...calculateCompetency(rows),learning:learningProgress(rows)};});
}
export async function proposeMappings(env: Env, actor: Actor, input: unknown) {
  const d=proposalInput.parse(input),p=await getPack(env,actor,d.packId),known=new Set((await topics(env)).map(t=>t.id));
  assert(new Set(d.mappings.map(m=>m.questionId)).size===d.mappings.length,'Duplicate question mapping.');
  for(const m of d.mappings) assert(known.has(m.topicId)&&p.questions.some((q:any)=>q.id===m.questionId),'Unknown question or topic.');
  const old=await env.DB.prepare('SELECT payload FROM mapping_proposals WHERE id=?').bind(d.requestId).first<any>();
  if(old) assert(old.payload===JSON.stringify(d),'Proposal ID reused.',409);
  else await env.DB.prepare('INSERT INTO mapping_proposals(id,pack_id,owner,payload,created_at) VALUES(?,?,?,?,?)').bind(d.requestId,d.packId,actor.id,JSON.stringify(d),now()).run();
  return {id:d.requestId,status:'pending',confirmUrl:`${env.APP_ORIGIN}/?mapping=${d.packId}`};
}
export async function confirmMappings(env:Env,actor:Actor,id:string){
  const row=await env.DB.prepare('SELECT * FROM mapping_proposals WHERE id=? AND owner=?').bind(id,actor.id).first<any>();
  assert(row,'Proposal not found.',404);
  if(row.status==='confirmed')return {confirmed:true};
  const d=proposalInput.parse(JSON.parse(row.payload)),time=now();
  const stmts=[env.DB.prepare("INSERT INTO mappings SELECT json_extract(value,'$.questionId'),json_extract(value,'$.topicId'),json_extract(value,'$.domain'),? FROM json_each(?) WHERE true ON CONFLICT(question_id) DO UPDATE SET topic_id=excluded.topic_id,domain=excluded.domain,confirmed_at=excluded.confirmed_at").bind(time,JSON.stringify(d.mappings))];
  stmts.push(env.DB.prepare("UPDATE mapping_proposals SET status='confirmed' WHERE id=?").bind(id));
  stmts.push(env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'confirm_mappings',row.payload,time));
  stmts.push(env.DB.prepare('INSERT INTO sync_jobs(id,owner,next_at,updated_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor.id,time,time));
  await env.DB.batch(stmts);return {confirmed:true};
}
export async function saveReview(env:Env,actor:Actor,input:unknown){
  const d=reviewInput.parse(input),s=await getSession(env,actor,d.sessionId);
  assert(s.status==='completed','Finish the session before review.');
  const old=await env.DB.prepare('SELECT payload FROM reviews WHERE id=? AND owner=?').bind(d.requestId,actor.id).first<any>();
  if(old)assert(old.payload===JSON.stringify(d),'Review ID reused.',409);
  else await env.DB.prepare('INSERT INTO reviews VALUES(?,?,?,?,?)').bind(d.requestId,d.sessionId,actor.id,JSON.stringify(d),now()).run();
  return {saved:true};
}
export async function results(env:Env,actor:Actor,id?:string){
  if(!id){ const latest=await env.DB.prepare("SELECT id FROM sessions WHERE owner=? AND status='completed' ORDER BY completed_at DESC LIMIT 1").bind(actor.id).first<any>();assert(latest,'No completed session.',404);id=latest.id; }
  const s=await getSession(env,actor,id!),p=await getPack(env,actor,s.pack_id);
  const review=await env.DB.prepare('SELECT payload FROM reviews WHERE session_id=? AND owner=? ORDER BY created_at').bind(id,actor.id).all<any>();
  const affected=new Set(p.questions.map((q:any)=>q.topicId).filter(Boolean));
  return {session:s,pack:p,...replay(p.questions,s.state.events),competencies:(await progress(env,actor)).filter(t=>affected.has(t.id)),reviews:review.results.map(r=>JSON.parse(r.payload))};
}
export async function excludeQuestion(env:Env,actor:Actor,input:unknown){
  const d=z.object({questionId:uuid,reason:z.string().min(1).max(2000)}).strict().parse(input);
  const q=await env.DB.prepare('SELECT q.fingerprint FROM questions q JOIN packs p ON p.id=q.pack_id WHERE q.id=? AND p.owner=?').bind(d.questionId,actor.id).first<any>();assert(q,'Question not found.',404);
  const t=now();await env.DB.batch([
    env.DB.prepare('INSERT INTO exclusions VALUES(?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET reason=excluded.reason').bind(q.fingerprint,d.reason,t),
    env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'exclude_question',JSON.stringify(d),t),
    env.DB.prepare('INSERT INTO sync_jobs(id,owner,next_at,updated_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor.id,t,t)
  ]);return {excluded:true};
}
