import test from 'node:test';
import assert from 'node:assert/strict';
import {savePack,createSession,updateSession,progress,proposeMappings,confirmMappings,excludeQuestion} from '../server/store';
import {exportBackup,restoreBackup} from '../server/backup';
import {setup} from './database';
const actor={id:'owner',email:'owner@example.com'};
const q={question:'Question 1: Example?',options:{A:'One',B:'Two',C:'Three',D:'Four',E:'Five'},answer:'B' as const};
test('unmapped import, duplicate submissions, conflicts, mapping and audited exclusion',async()=>{
  const {env,db}=setup();const requestId=crypto.randomUUID();
  const pack=await savePack(env,actor,{requestId,title:'Own set',mode:'imported',questions:[q]},'imported');
  assert.equal((await savePack(env,actor,{requestId,title:'Own set',mode:'imported',questions:[q]},'imported')).id,pack.id);
  await assert.rejects(()=>savePack(env,actor,{requestId,title:'Changed',mode:'imported',questions:[q]},'imported'),/different/);
  const sessionId=crypto.randomUUID();await createSession(env,actor,{id:sessionId,packId:pack.id,order:[pack.questions[0].id]});
  const update={mutationId:crypto.randomUUID(),expectedRevision:0,events:[{id:crypto.randomUUID(),questionId:pack.questions[0].id,selection:'B',at:new Date().toISOString()}],currentIndex:0,complete:true};
  assert.equal((await updateSession(env,actor,sessionId,update)).score,1);
  assert.equal((await updateSession(env,actor,sessionId,update)).revision,1);
  assert.equal((await progress(env,actor))[0].status,'Untested');
  await assert.rejects(()=>updateSession(env,actor,sessionId,{...update,mutationId:crypto.randomUUID()}),/completed/);
  const proposal=await proposeMappings(env,actor,{requestId:crypto.randomUUID(),packId:pack.id,mappings:[{questionId:pack.questions[0].id,topicId:'C1',domain:'management'}]});
  assert.equal((await progress(env,actor))[0].status,'Untested');await confirmMappings(env,actor,proposal.id);assert.equal((await progress(env,actor))[0].status,'Amber');
  assert.equal(db.prepare('SELECT count(*) n FROM answer_events').get()!.n,1);
  await excludeQuestion(env,actor,{questionId:pack.questions[0].id,reason:'Ambiguous item'});assert.equal((await progress(env,actor))[0].status,'Untested');
  assert.equal(db.prepare('SELECT count(*) n FROM audit').get()!.n,2);db.close();
});
test('concurrent stale writes and invalid completion cannot alter the accepted answer',async()=>{
  const {env,db}=setup();const p=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Quiz',mode:'imported',questions:[q]},'imported'),id=crypto.randomUUID();await createSession(env,actor,{id,packId:p.id,order:[p.questions[0].id]});
  const base={mutationId:crypto.randomUUID(),expectedRevision:0,events:[],currentIndex:0,complete:true};await assert.rejects(()=>updateSession(env,actor,id,base),/Attempt every/);
  await updateSession(env,actor,id,{...base,complete:false,events:[{id:crypto.randomUUID(),questionId:p.questions[0].id,selection:'A',at:new Date().toISOString()}]});
  await assert.rejects(()=>updateSession(env,actor,id,{...base,mutationId:crypto.randomUUID(),complete:false}),/another device/);
  assert.equal(db.prepare('SELECT selection FROM answer_events').get()!.selection,'A');db.close();
});
test('account export and empty-account restore round trip retain evidence and scores',async()=>{
  const a=setup();const p=await savePack(a.env,actor,{requestId:crypto.randomUUID(),title:'Backup test',mode:'imported',questions:[q]},'imported');const id=crypto.randomUUID();await createSession(a.env,actor,{id,packId:p.id,order:[p.questions[0].id]});
  await updateSession(a.env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,events:[{id:crypto.randomUUID(),questionId:p.questions[0].id,selection:'B',at:new Date().toISOString()}],currentIndex:0,complete:true});
  const backup=await exportBackup(a.env,actor),b=setup();await restoreBackup(b.env,actor,backup);assert.deepEqual((await exportBackup(b.env,actor)).data,backup.data);await assert.rejects(()=>restoreBackup(b.env,actor,backup),/empty account/);a.db.close();b.db.close();
});
