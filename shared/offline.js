import {replay,LETTERS} from './quiz.js';
// A committed IndexedDB transaction, not just a successful request, is the save boundary.
export function openDatabase(){
  return new Promise((resolve,reject)=>{const req=indexedDB.open('synapse-ccs',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});
}
export async function storage(action,key,value){
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('records',action==='get'||action==='all'?'readonly':'readwrite'),store=tx.objectStore('records');
    const req=action==='get'?store.get(key):action==='all'?store.getAll():action==='delete'?store.delete(key):store.put(value,key);
    let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error??new Error('Local save aborted.'));};
  });
}
export function prepareMutation(session){
  if(['ended','discarded'].includes(session.status))return null;
  if(session.inflight)return session.inflight;
  if(session.status==='completed'&&!session.pending.length&&!session.needsCompletion)return null;
  if(!session.pending.length&&!session.needsCompletion&&!session.positionDirty)return null;
  return {mutationId:crypto.randomUUID(),expectedRevision:session.revision,events:[...session.pending],currentIndex:session.currentIndex,complete:session.needsCompletion||false};
}
export function acknowledge(session,server,mutation){
  const ids=new Set(mutation.events.map(e=>e.id));
  const pending=session.pending.filter(e=>!ids.has(e.id));
  const needsCompletion=session.needsCompletion&&!mutation.complete;
  return {...session,revision:server.revision,events:[...server.state.events,...pending],pending,inflight:null,positionDirty:session.currentIndex!==mutation.currentIndex,needsCompletion,status:needsCompletion?'finishing':server.status,conflict:!!session.conflict||(['ended','discarded'].includes(server.status)&&pending.length>0),serverCreated:true};
}

export function validateDeviceBackup(backup,owner){
  if(backup?.format!=='synapse-device-v1'||!Array.isArray(backup.records)||backup.records.length>5000)throw new Error('Invalid device backup.');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,entries=[];
  for(const record of backup.records){
    if(!['session','pack'].includes(record.kind))continue;
    if(record.owner&&record.owner!==owner)throw new Error('Sign in to the account that owns this backup.');
    const pack=record.pack;
    if(!pack||!Array.isArray(pack.questions)||!pack.questions.length||pack.questions.length>200)throw new Error('Invalid backup pack.');
    const questionIds=pack.questions.map(q=>q.id);
    if(new Set(questionIds).size!==questionIds.length||pack.questions.some(q=>!uuid.test(q.id)||typeof q.question!=='string'||!LETTERS.includes(q.answer)||LETTERS.some(k=>typeof q.options?.[k]!=='string')))throw new Error('Invalid backup questions.');
    if(pack.questions.some(q=>!Number.isInteger(q.original_q_number)||q.original_q_number<1||q.original_q_number>200||(q.explanation!==undefined&&typeof q.explanation!=='string')||(q.sources!==undefined&&!Array.isArray(q.sources))))throw new Error('Invalid backup question metadata.');
    if(record.kind==='pack'){if(!uuid.test(pack.id))throw new Error('Invalid pack ID.');entries.push(['pack:'+pack.id,record]);continue;}
    if(!uuid.test(record.id)||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt))||!['active','finishing','completed','ended','discarded'].includes(record.status)||!Array.isArray(record.events)||!Array.isArray(record.pending)||record.events.length>10000||!Array.isArray(record.order)||record.order.length!==questionIds.length||new Set(record.order).size!==questionIds.length||record.order.some(q=>!questionIds.includes(q))||!Number.isInteger(record.currentIndex)||record.currentIndex<0||record.currentIndex>=questionIds.length||!Number.isInteger(record.revision)||record.revision<0)throw new Error('Invalid backup session.');
    if(record.events.some(e=>!uuid.test(e.id)||!Number.isFinite(Date.parse(e.at)))||new Set(record.events.map(e=>e.id)).size!==record.events.length||record.pending.some(e=>!record.events.some(saved=>JSON.stringify(saved)===JSON.stringify(e))))throw new Error('Invalid backup answer history.');
    replay(pack.questions,record.events);
    entries.push(['session:'+record.id,record]);
  }
  if(!entries.length)throw new Error('This backup contains no packs or sessions.');
  return entries;
}

export async function restoreDevice(backup,owner){
  const entries=validateDeviceBackup(backup,owner),db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');let inserted=0,reason;
    for(const [key,value] of entries){const request=store.get(key);request.onsuccess=()=>{if(request.result!==undefined){if(JSON.stringify(request.result)!==JSON.stringify(value)){reason=new Error('A different continuation already exists on this device. Export it first and restore this backup on an empty device.');tx.abort();}}else{store.put(value,key);inserted++;}};}
    tx.oncomplete=()=>{db.close();resolve(inserted);};tx.onabort=()=>{db.close();reject(reason??tx.error);};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
