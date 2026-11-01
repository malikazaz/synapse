// Runs only against the disposable copy, with an isolated local database.
// Credentials are read in-process and never logged or copied into the repository.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {setup} from '../tests/database';
import {savePack,createSession,updateSession} from '../server/store';
import {syncSheets,sheets} from '../server/sheets';
const credentialPath=process.argv[2];if(!credentialPath)throw new Error('Supply the downloaded service-account JSON file path.');
const {env,db}=setup();
const testSheet=process.env.SYNAPSE_TEST_SPREADSHEET_ID,owner=process.env.SYNAPSE_OWNER_EMAIL;
if(!testSheet||!owner||process.env.SYNAPSE_DISPOSABLE_TEST!=='yes')throw new Error('Set SYNAPSE_TEST_SPREADSHEET_ID, SYNAPSE_OWNER_EMAIL and SYNAPSE_DISPOSABLE_TEST=yes for a disposable workbook only.');
Object.assign(env,{OWNER_EMAIL:owner,SHEETS_ENABLED:'true',SPREADSHEET_ID:testSheet,GOOGLE_SERVICE_ACCOUNT:await readFile(credentialPath,'utf8')});
const actor={id:'disposable-proof',email:env.OWNER_EMAIL};
db.exec('DELETE FROM topics');db.exec(await readFile('data/catalog.sql','utf8'));
const topic=db.prepare("SELECT id FROM topics WHERE blocks LIKE '%MSK%' LIMIT 1").get()!.id as string;
const sentinelPath="?ranges=MSK!A4:I100&includeGridData=true&fields=sheets(data(startRow,startColumn,rowData(values(userEnteredValue,userEnteredFormat,dataValidation,note))))";
try{
 const before=await sheets(env,sentinelPath);
 const p=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Disposable connection proof — not study evidence',mode:'diagnostic',questions:[1,2].map(i=>({question:`Connection proof ${i}: choose the first named option.`,options:{A:'First',B:'Second',C:'Third',D:'Fourth',E:'Fifth'},answer:'A',explanation:'Non-clinical connection test only.',sources:[{title:'Connection fixture',reference:'Local test fixture',retrievedAt:new Date().toISOString()}],topicId:topic,domain:'recognition'}))},'chatgpt');
 const id=crypto.randomUUID();await createSession(env,actor,{id,packId:p.id,order:p.questions.map((q:any)=>q.id)});
 await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:1,complete:true,events:p.questions.map((q:any,i:number)=>({id:crypto.randomUUID(),questionId:q.id,selection:i===0?('ABCDE'.split('').find(k=>k!==q.answer)):q.answer,at:new Date().toISOString()}))});
 const outcome=await syncSheets(env,true);assert.equal(outcome.status,'synced',outcome.error);
 const projection=await sheets(env,"/values/"+encodeURIComponent("'CCS Progress'!A1:M656")+'?valueRenderOption=UNFORMATTED_VALUE');assert.equal(projection.values.length,656);
 const row=projection.values.find((r:any[])=>r[0]===topic);assert.equal(row[5],'Amber');assert.equal(row[6],50);
 const sessions=await sheets(env,"/values/"+encodeURIComponent("'CCS Sessions'!A1:G10"));assert.equal(sessions.values.length,2);assert.equal(sessions.values[1][0],id);
 assert.deepEqual(await sheets(env,sentinelPath),before);
 // Retry the same projection after an ambiguous caller outcome.
 db.exec("UPDATE sync_jobs SET status='pending'");assert.equal((await syncSheets(env,true)).status,'synced');
 const again=await sheets(env,"/values/"+encodeURIComponent("'CCS Sessions'!A1:G10"));assert.deepEqual(again,sessions);
 console.log(JSON.stringify({status:'passed',topics:655,assessedStatus:'Amber',accuracy:50,sessionRows:1,manualCellsAndValidation:'unchanged',retry:'no duplicate rows',spreadsheetId:env.SPREADSHEET_ID}));
}finally{db.close();}
