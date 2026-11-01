import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './database';
import {savePack,createSession,updateSession,closeSession,progress,proposeMappings,confirmMappings} from '../server/store';
import {exportBackup,restoreBackup} from '../server/backup';
import {performanceProfile} from '../server/performance';
const actor={id:'owner',email:'owner@example.com'};
const question={question:'Lifecycle one?',options:{A:'One',B:'Two',C:'Three',D:'Four',E:'Five'},answer:'B'};
test('ending and discarding preserve exposure history, cannot award partial mastery, and round-trip in backups',async()=>{
 const {env,db}=setup(),pack=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Lifecycle',mode:'imported',questions:[question,{...question,question:'Lifecycle two?'}]},'imported');
 const proposal=await proposeMappings(env,actor,{requestId:crypto.randomUUID(),packId:pack.id,mappings:pack.questions.map((q:any)=>({questionId:q.id,topicId:'C1',domain:'management'}))});await confirmMappings(env,actor,proposal.id);
 for(const action of ['end','discard'] as const){
  const id=crypto.randomUUID();await createSession(env,actor,{id,packId:pack.id,order:pack.questions.map((q:any)=>q.id)});
  await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:0,complete:false,events:[{id:crypto.randomUUID(),questionId:pack.questions[0].id,selection:'B',at:new Date().toISOString()}]});
  const input={mutationId:crypto.randomUUID(),expectedRevision:1,action},closed=await closeSession(env,actor,id,input);assert.equal(closed.status,action==='end'?'ended':'discarded');assert.equal(closed.completed_at,null);assert.equal(closed.state.events.length,1);assert.equal(closed.score,1);assert.equal((await closeSession(env,actor,id,input)).revision,2);
  await assert.rejects(()=>updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:2,currentIndex:0,complete:false,events:[]}),/closed/);
 }
 assert.equal((await progress(env,actor))[0].evidenceCount,0);assert.equal((await performanceProfile(env,actor)).summary.activeSessions,0);
 const fresh=crypto.randomUUID();await createSession(env,actor,{id:fresh,packId:pack.id,order:pack.questions.map((q:any)=>q.id)});
 await updateSession(env,actor,fresh,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:1,complete:false,events:pack.questions.map((q:any)=>({id:crypto.randomUUID(),questionId:q.id,selection:'B',at:new Date().toISOString()}))});
 const completed=await closeSession(env,actor,fresh,{mutationId:crypto.randomUUID(),expectedRevision:1,action:'end'});assert.equal(completed.status,'completed');assert.equal(completed.score,2);assert.equal((await progress(env,actor))[0].evidenceCount,1);
 await assert.rejects(()=>closeSession(env,actor,fresh,{mutationId:crypto.randomUUID(),expectedRevision:2,action:'discard'}),/Completed results/);
 const backup=await exportBackup(env,actor),other=setup();await restoreBackup(other.env,actor,backup);assert.deepEqual((await exportBackup(other.env,actor)).data,backup.data);db.close();other.db.close();
});
test('stale or unauthorised closing cannot overwrite answers or completed results',async()=>{
 const {env,db}=setup(),pack=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Race',mode:'imported',questions:[question]},'imported'),id=crypto.randomUUID();await createSession(env,actor,{id,packId:pack.id,order:[pack.questions[0].id]});
 const close={mutationId:crypto.randomUUID(),expectedRevision:0,action:'discard'};
 await assert.rejects(()=>closeSession(env,{id:'other',email:'other@example.com'},id,close),/not found/);
 await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:0,complete:false,events:[{id:crypto.randomUUID(),questionId:pack.questions[0].id,selection:'B',at:new Date().toISOString()}]});
 await assert.rejects(()=>closeSession(env,actor,id,close),/another device/);
 await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:1,currentIndex:0,complete:true,events:[]});
 await assert.rejects(()=>closeSession(env,actor,id,close),/Completed results/);assert.equal(db.prepare('SELECT score FROM sessions').get()!.score,1);assert.equal(db.prepare("SELECT count(*) n FROM audit WHERE action='close_session'").get()!.n,0);db.close();
});
