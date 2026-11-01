import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportPKCS8} from 'jose';
import {setup} from './database';
import {savePack,createSession,updateSession} from '../server/store';
import {syncSheets,mskProjection,MSK_HEADERS} from '../server/sheets';

test('MSK projection follows Record IDs after row movement and refuses occupied columns',()=>{
  const a=mskProjection([['Record ID'],['C2'],[],['C1']]);
  assert.equal(a[1].range,"'MSK'!J5:N5");assert.match(a[2].values[0][0],/\$I7/);
  assert.throws(()=>mskProjection([['Record ID'],['C1','Manual value']]),/refusing/);
  assert.throws(()=>mskProjection([['Moved header']]),/Record ID/);
  assert.equal(mskProjection([['Record ID',...MSK_HEADERS],['C2','old formula']]).length,2);
});

test('sheet outage, revoked access and ambiguous writes preserve results and retry without duplicate rows',async()=>{
  const {env,db}=setup(),actor={id:'owner',email:'owner@example.com'};
  const pack=await savePack(env,actor,{requestId:crypto.randomUUID(),title:'Sync proof',mode:'imported',questions:[{question:'Proof?',options:{A:'a',B:'b',C:'c',D:'d',E:'e'},answer:'A'}]},'imported');
  const id=crypto.randomUUID();await createSession(env,actor,{id,packId:pack.id,order:[pack.questions[0].id]});
  await updateSession(env,actor,id,{mutationId:crypto.randomUUID(),expectedRevision:0,currentIndex:0,complete:true,events:[{id:crypto.randomUUID(),questionId:pack.questions[0].id,selection:'A',at:new Date().toISOString()}]});
  const {privateKey}=await generateKeyPair('RS256',{extractable:true});
  Object.assign(env,{OWNER_EMAIL:actor.email,SHEETS_ENABLED:'true',SPREADSHEET_ID:'disposable-test',GOOGLE_SERVICE_ACCOUNT:JSON.stringify({client_email:'test@invalid',private_key:await exportPKCS8(privateKey)})});
  let failure='revoked';const writes:any[]=[],ranges=new Map<string,any[]>(),original=globalThis.fetch;
  const properties=['CCS Progress','CCS Sessions','MSK'].map((title,sheetId)=>({properties:{title,sheetId,gridProperties:{rowCount:2000}}}));
  globalThis.fetch=async(input:any,init:any)=>{
    const url=String(input);if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'mock',expires_in:3600});
    assert.match(url,/^https:\/\/sheets.googleapis.com\/v4\/spreadsheets\/disposable-test/);
    if(failure==='revoked')return new Response('',{status:403});
    if(url.includes('?fields='))return Response.json({sheets:properties});
    if(url.endsWith('/values:batchUpdate')){
      const body=JSON.parse(init.body);writes.push(body);
      for(const entry of body.data)ranges.set(entry.range,entry.values);
      if(failure==='timeout'){failure='';throw new Error('Response lost after Google accepted write');}
      return Response.json({});
    }
    const range=decodeURIComponent(new URL(url).pathname.split('/values/')[1]??'');
    if(range==="'MSK'!I4:N1000")return Response.json({values:[['Record ID'],['C1']]});
    if(range.startsWith("'CCS Sessions'!A1:A"))return Response.json({values:(ranges.get("'CCS Sessions'!A1")??[]).map(r=>[r[0]])});
    if(range.startsWith("'CCS Progress'!A1:"))return Response.json({values:ranges.get("'CCS Progress'!A1")?.slice(0,1)??[]});
    if(range.startsWith("'CCS Sessions'!A1:"))return Response.json({values:ranges.get("'CCS Sessions'!A1")?.slice(0,1)??[]});
    throw new Error('Unexpected Google request '+range);
  };
  try{
    assert.match((await syncSheets(env,true)).error!,/revoked/);assert.equal(db.prepare('SELECT score FROM sessions').get()!.score,1);
    failure='timeout';assert.equal((await syncSheets(env,true)).status,'pending');
    assert.equal((await syncSheets(env,true)).status,'synced');
    assert.equal(ranges.get("'CCS Sessions'!A1")!.length,2);assert.equal(ranges.get("'CCS Sessions'!A1")![1][0],id);
    assert.equal(db.prepare('SELECT count(*) n FROM sync_jobs WHERE status=\'synced\'').get()!.n,1);
    assert.ok(writes.every(w=>w.data.every((d:any)=>/^'CCS (Progress|Sessions)'!A1$|^'MSK'!J\d+:N\d+$/.test(d.range))));
    assert.ok(writes.filter(w=>w.valueInputOption==='RAW').length===2);
  }finally{globalThis.fetch=original;db.close();}
});
