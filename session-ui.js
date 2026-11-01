import {storage} from './shared/offline.js';
import {replay} from './shared/quiz.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isClosed=s=>['ended','discarded'].includes(s.status);
export const hasPending=s=>!!s.owner&&(s.pending?.length||s.inflight||s.needsCompletion||!s.serverCreated);
export function sessionSummaries(cloud,locals){
  const rows=new Map(cloud.map(s=>[s.id,s]));
  for(const s of locals){
    const remote=rows.get(s.id),pending=hasPending(s);
    if(remote&&!pending&&!s.conflict&&(remote.revision==null||remote.revision>=s.revision))continue;
    const result=replay(s.pack.questions,s.events);
    rows.set(s.id,{id:s.id,title:s.pack.title,status:s.status,revision:s.revision,score:result.score,question_count:s.order.length,answered:result.answered,started_at:s.updatedAt,completed_at:s.status==='completed'?s.updatedAt:null,local:!s.owner,pending:!!pending,conflict:!!s.conflict||!!(remote&&remote.status!=='active'&&pending)});
  }
  return [...rows.values()].sort((a,b)=>(b.completed_at??b.started_at).localeCompare(a.completed_at??a.started_at));
}
export function sessionListHtml(rows){
  const card=s=>`<article class="card padded session-entry"><strong>${esc(s.title)}</strong><p class="fine-print">${esc(s.status==='ended'?'Ended early — practice only':s.status==='discarded'?'Discarded from active sessions':s.status)} · ${s.answered??0}/${s.question_count??'?'} answered · ${esc(new Date(s.started_at).toLocaleString('en-GB'))}${s.pending?' · sync pending':''}</p><div class="row"><button class="btn secondary" data-resume="${s.id}">${s.status==='completed'?'View results':isClosed(s)?'View saved answers':'Continue'}</button>${['active','finishing'].includes(s.status)?`<button class="btn secondary" data-close-session="end" data-session-id="${s.id}">End session</button><button class="btn ghost" data-close-session="discard" data-session-id="${s.id}">Discard attempt</button>`:''}</div></article>`;
  const active=rows.filter(s=>['active','finishing'].includes(s.status)&&!s.conflict),completed=rows.filter(s=>s.status==='completed'&&!s.conflict),ended=rows.filter(s=>s.status==='ended'&&!s.conflict),discarded=rows.filter(s=>s.status==='discarded'&&!s.conflict);
  return `<section id="continuingSessions"><h2>Continue a session</h2>${active.map(card).join('')||'<p>No unfinished sessions.</p>'}</section><section id="completedSessions"><h2>Completed sessions</h2>${completed.map(card).join('')||'<p>No completed sessions yet.</p>'}</section>${ended.length?`<section id="endedSessions"><h2>Ended early</h2><p>Saved answers remain available as practice; incomplete attempts do not award competency credit.</p>${ended.map(card).join('')}</section>`:''}${discarded.length?`<details id="discardedSessions"><summary>Discarded attempts (${discarded.length})</summary><p>Removed from active study. Answer history is retained to protect your records and prevent repeats earning fresh credit.</p>${discarded.map(card).join('')}</details>`:''}`;
}
export async function closeFromList(app,sessionId,action){
  if(app.busy)throw new Error('A save is in progress. Try again once it has synced.');
  await app.queue;
  let local=await storage('get','session:'+sessionId);
  if(local?.conflict)throw new Error('Resolve this session’s device conflict before closing it. Both answer paths are preserved.');
  if(local?.owner&&local.owner!==app.actor?.id)throw new Error('Sign in to the account that owns this session.');
  const cloud=!local||!!local.owner;
  if(cloud){
    if(!navigator.onLine)throw new Error('Reconnect before ending or discarding an account session. Your answers remain saved.');
    if(local){await app.flush(local);local=await storage('get','session:'+sessionId);if(local.conflict||hasPending(local))throw new Error('Sync or resolve this session before closing it. Your answers are preserved.');}
  }
  const remote=cloud?await app.api('sessions/'+sessionId):null;
  if((remote?.status??local.status)!=='active'){await app.show('packs');app.notify('This session has already ended. Its saved result is unchanged.');return;}
  const pack=local?.pack??await app.api('packs/'+remote.pack_id),events=remote?.state.events??local.events,result=replay(pack.questions,events);
  const completed=action==='end'&&result.answered===pack.questions.length;
  const message=action==='discard'?'Discard this unfinished attempt from active study? Its saved answers remain in Discarded attempts. Completed results will not be changed.':completed?'Finish this session? All questions have an answer. First-answer scoring and the normal competency rules will apply.':`End this session with ${result.answered}/${pack.questions.length} questions answered? Keep its answers as incomplete practice, with no competency credit.`;
  if(!confirm(message))return;
  let saved;
  if(cloud){
    // Retain the exact mutation for a retry after an ambiguous network outcome.
    const requestKey='close-request:'+sessionId,prior=await storage('get',requestKey);
    const data=prior?.data.action===action&&prior.data.expectedRevision===remote.revision?prior.data:{mutationId:crypto.randomUUID(),expectedRevision:remote.revision,action};
    await storage('put',requestKey,{kind:'close-request',owner:app.actor.id,data});
    saved=await app.api('sessions/'+sessionId+'/close',data);await storage('delete',requestKey);
    const record={...local,kind:'session',id:sessionId,owner:saved.owner,packId:pack.id,pack,order:saved.state.order,events:saved.state.events,currentIndex:saved.state.currentIndex,revision:saved.revision,status:saved.status,pending:[],inflight:null,needsCompletion:false,positionDirty:false,serverCreated:true,updatedAt:saved.state.lifecycle?.at??saved.completed_at??saved.started_at};
    await app.serial(async()=>{
      const latest=await storage('get','session:'+sessionId),accepted=new Set(record.events.map(e=>e.id));
      if(latest?.events.some(e=>!accepted.has(e.id))){latest.conflict=true;await storage('put','session:'+sessionId,latest);if(app.active?.id===sessionId)app.active=latest;throw new Error('The cloud session closed, but newer device answers are preserved. Resolve the conflict in My question packs.');}
      await storage('put','session:'+sessionId,record);if(app.active?.id===sessionId){app.active=null;app.selectedPack=null;}
    });
  }else{
    await app.serial(async()=>{const latest=await storage('get','session:'+sessionId);if(JSON.stringify(latest.events)!==JSON.stringify(local.events)||latest.status!=='active')throw new Error('This session changed. Review its latest answers before closing it.');saved={...latest,status:action==='discard'?'discarded':completed?'completed':'ended',needsCompletion:false,positionDirty:false,updatedAt:new Date().toISOString()};await storage('put','session:'+sessionId,saved);if(app.active?.id===sessionId){app.active=null;app.selectedPack=null;}});
  }
  if(app.active?.id===sessionId){app.active=null;app.selectedPack=null;app.status();}
  app.status();await app.show('packs');app.notify(saved.status==='discarded'?'Attempt removed from active sessions. Its answer history is retained.':saved.status==='completed'?'Session completed.':'Session ended early. Saved answers are available under Ended early.');
}
