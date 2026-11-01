import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './database';
import {defaultStudyPreferences,getStudySettings,saveStudySettings} from '../server/study';
import {savePack,createSession,updateSession,progress} from '../server/store';
import {performanceProfile} from '../server/performance';
import {exportBackup,restoreBackup} from '../server/backup';
import {calculateCompetency} from '../shared/competency.js';
import {learningProgress,upcomingExams} from '../shared/learning.js';
import {DOMAINS} from '../shared/quiz.js';
const actor={id:'owner',email:'owner@example.com'};
const exam={id:crypto.randomUUID(),name:'My AKT',date:'2027-02-04',blocks:[]};
const q={question:'One integration fact?',options:{A:'One',B:'Two',C:'Three',D:'Four',E:'Five'},answer:'A',explanation:'One is correct.',topicId:'C1',domain:'foundations',learningStage:'foundation',difficulty:'introductory',learningObjective:'Recall one fact',optionRationales:{A:'One is correct',B:'Two is not',C:'Three is not',D:'Four is not',E:'Five is not'},sources:[{title:'Fixture',reference:'Local nonclinical fixture',retrievedAt:'2026-10-01T12:00:00Z'}]};
test('study settings validate dates and blocks, reject stale concurrent edits, and isolate owners',async()=>{
 const {env,db}=setup();const preferences={...defaultStudyPreferences(),exams:[exam]};
 assert.equal((await getStudySettings(env,actor)).recallFirst,true);
 const saved=await saveStudySettings(env,actor,{expectedRevision:0,preferences});assert.equal(saved.revision,1);
 await assert.rejects(()=>saveStudySettings(env,actor,{expectedRevision:0,preferences}),/another device/);
 await assert.rejects(()=>saveStudySettings(env,actor,{expectedRevision:1,preferences:{...preferences,exams:[{...exam,date:'2027-02-30'}]}}));
 await assert.rejects(()=>saveStudySettings(env,actor,{expectedRevision:1,preferences:{...preferences,activeBlocks:['invented']}}),/Unknown study block/);
 assert.equal((await getStudySettings(env,{...actor,id:'other'})).exams.length,0);
 assert.equal((await saveStudySettings(env,actor,{expectedRevision:1,preferences:{...preferences,recallFirst:false}})).revision,2);db.close();
});
test('exam dates use UK calendar days through summer time',()=>{
 assert.equal(upcomingExams({exams:[{...exam,date:'2027-06-03'}]},new Date('2027-06-02T23:30:00Z'))[0].daysUntil,0);
});
test('stage progression and application evidence cannot be replaced with basic recall or unknown legacy labels',()=>{
 const rows=Array.from({length:20},(_,i)=>({eventId:String(i),completedAt:i<10?'2026-10-01T12:00:00Z':'2026-10-08T12:00:00Z',exposedAt:String(i),sessionId:i<10?'first':'second',domain:DOMAINS[i%5],correct:true,learningStage:'foundation'}));
 assert.equal(calculateCompetency(rows).status,'Amber');assert.equal(calculateCompetency(rows.map(r=>({...r,learningStage:null}))).status,'Amber');
 assert.equal(calculateCompetency(rows.map((r,i)=>({...r,learningStage:i<5?'clinical':'foundation'}))).status,'Green');
 assert.equal(learningProgress(rows).recommendedStage,'focused');assert.equal(learningProgress(rows.slice(0,4)).recommendedStage,'foundation');
 assert.equal(learningProgress([...rows,...rows.slice(0,5).map(r=>({...r,learningStage:'focused'}))]).recommendedStage,'clinical');
});
test('generated pack validation and answer balancing preserve matching rationales; imported sets stay compatible',async()=>{
 const {env,db}=setup();const data={requestId:crypto.randomUUID(),title:'Foundation',mode:'diagnostic',questions:[q],answerKey:'E'};
 const pack=await savePack(env,actor,data,'chatgpt');assert.equal(pack.questions[0].answer,'E');assert.equal(pack.questions[0].options.E,'One');assert.equal(pack.questions[0].optionRationales.E,'One is correct');
 await assert.rejects(()=>savePack(env,actor,{...data,requestId:crypto.randomUUID(),questions:[{...q,learningStage:undefined}]},'chatgpt'),/learningStage/);
 await assert.rejects(()=>savePack(env,actor,{...data,requestId:crypto.randomUUID(),questions:[{...q,options:{...q.options,B:'One'}}]},'chatgpt'),/distinct/);
 db.close();
});
test('performance separates fresh evidence from retries, retakes, incomplete attempts and missing telemetry; backups retain measurements and settings',async()=>{
 const {env,db}=setup();await saveStudySettings(env,actor,{expectedRevision:0,preferences:{...defaultStudyPreferences(),exams:[exam]}});
 const pack=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Metrics',mode:'diagnostic',questions:[q],answerKey:'A'},'chatgpt');
 const session=async(complete:boolean,measured:boolean)=>{const id=crypto.randomUUID();await createSession(env,actor,{id,packId:pack.id,order:[pack.questions[0].id]});const measurement={activeMs:12000,recallMs:6000,visits:1,optionsRevealedAt:new Date().toISOString(),confidence:'confident'};const events=['B','A'].map((selection,i)=>({id:crypto.randomUUID(),questionId:pack.questions[0].id,selection,at:new Date().toISOString(),...(measured?{measurement:{...measurement,activeMs:12000+i*1000}}:{})}));await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:0,complete,events});return id;};
 const id=await session(true,true);await session(true,false);await session(false,false);
 const profile=await performanceProfile(env,actor);assert.equal(profile.summary.evidenceCount,1);assert.equal(profile.summary.retries,3);assert.equal(profile.summary.questionAttempts,3);assert.equal(profile.summary.recoveredAfterError,3);assert.equal(profile.summary.activeSessions,1);assert.equal(profile.confidence[2].wrong,1);assert.equal(profile.timing.medianActiveMs,12000);assert.equal(profile.timing.unmeasuredFirstAnswers,2);assert.equal(profile.priorities[0].status,'Red');assert.equal(profile.recentErrors[0].sessionId,id);
 assert.equal((await performanceProfile(env,{...actor,id:'someone-else'})).summary.answerSelections,0);
 const backup=await exportBackup(env,actor),restored=setup();await restoreBackup(restored.env,actor,backup);assert.deepEqual((await exportBackup(restored.env,actor)).data,backup.data);assert.deepEqual((await performanceProfile(restored.env,actor)).confidence,profile.confidence);
 const legacy=structuredClone(backup);legacy.format='synapse-backup-v1';delete legacy.data.study_settings;delete legacy.data.curriculum_blocks;delete legacy.data.curriculum_items;const old=setup();await restoreBackup(old.env,actor,legacy);assert.equal((await getStudySettings(old.env,actor)).revision,0);
 db.close();restored.db.close();old.db.close();
});
