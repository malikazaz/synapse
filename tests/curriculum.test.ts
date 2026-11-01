import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './database';
import {previewCurriculum,confirmCurriculum,curriculumContext} from '../server/curriculum';
import {exportBackup,restoreBackup} from '../server/backup';
const actor={id:'owner',email:'owner@example.com'};
test('year/block import is additive, keeps official IDs/types and exposes uncertain guide labels separately',async()=>{
 const {env,db}=setup();const block={id:'y3-example',year:3,label:'Example block',topicBlock:'Example block',status:'studied',sourceName:'Guide.pdf',sourceHash:'a'.repeat(64)};
 const mapped={id:crypto.randomUUID(),blockId:block.id,sourceLabel:'Example variant',sourceType:'Presentation',topicId:'C1',section:'Guide section',priority:'core',sourceLocator:'page 3',matchMethod:'classification-note',notes:'Guide classification differs; preserve catalogue Condition.'};
 const unmatched={...mapped,id:crypto.randomUUID(),topicId:null,sourceLabel:'Unclear label',matchMethod:'unmatched'};
 const preview=await previewCurriculum(env,actor,{blocks:[block],items:[mapped,unmatched]});assert.equal(preview.unmatched.length,1);assert.equal((await curriculumContext(env)).blocks.length,0);
 await confirmCurriculum(env,actor,preview.previewId);const context=await curriculumContext(env);assert.equal(context.blocks[0].status,'studied');assert.equal(context.blocks[0].matchedTopics,1);assert.equal(context.blocks[0].unmatchedItems,1);assert.equal(context.items.find(i=>i.topic_id)!.topic_type,'Condition');
 const topic=db.prepare("SELECT * FROM topics WHERE id='C1'").get()!;assert.equal(topic.label,'Example');assert.equal(topic.blocks,'["Example block"]');
 const backup=await exportBackup(env,actor),other=setup();await restoreBackup(other.env,actor,backup);assert.deepEqual((await curriculumContext(other.env)).items,context.items);
 const year4={...block,id:'y4-example',year:4,topicBlock:'Year 4 block'};const next=await previewCurriculum(env,actor,{blocks:[year4],items:[{...mapped,id:crypto.randomUUID(),blockId:year4.id}]});await confirmCurriculum(env,actor,next.previewId);assert.equal((await curriculumContext(env)).blocks.length,2);assert.deepEqual(JSON.parse(String(db.prepare("SELECT blocks FROM topics WHERE id='C1'").get()!.blocks)),['Example block','Year 4 block']);
 db.close();other.db.close();
});
