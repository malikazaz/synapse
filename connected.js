import {storage,prepareMutation,acknowledge,restoreDevice} from './shared/offline.js';
import {replay,DOMAIN_LABELS,DOMAINS} from './shared/quiz.js';
import {renderHome,renderSources} from './workspace.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
const date=s=>s?new Date(s).toLocaleDateString('en-GB'):'—';
function download(name,value){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

class Connected {
  actor=null;selectedPack=null;active=null;busy=false;tab='quiz';connected=false;catalog=[];initialised=false;
  queue=Promise.resolve();
  serial(fn){const next=this.queue.then(fn);this.queue=next.catch(()=>{});return next;}
  async api(path,data){
    const r=await fetch('./api/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
    const text=await r.text();let value;try{value=JSON.parse(text);}catch{throw new Error('Connected services are unavailable. Local quizzes still work.');}
    if(!r.ok){const error=new Error(value.error||'Request failed');error.status=r.status;throw error;}return value;
  }
  notify(message,error=false){const e=document.getElementById('connectionNotice');e.textContent=message;e.classList.toggle('error',error);}
  async persist(session=this.active){if(session)await storage('put','session:'+session.id,session);}
  navigate(view){if(view==='quiz')document.dispatchEvent(new Event('synapse:import'));return this.show(view);}
  async init(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>this.navigate(b.dataset.view)));
    document.getElementById('accountBtn').addEventListener('click',()=>this.actor?this.signOut():location.assign('./auth/login'));
    document.getElementById('savePackBtn').addEventListener('click',()=>this.saveImported());
    document.getElementById('resumeBtn').addEventListener('click',()=>this.resumeLatest().catch(e=>this.notify(e.message,true)));
    try{const status=await this.api('status');this.actor=status.actor;this.connected=status.connected;await storage('put','account',{kind:'account',actor:this.actor,connected:this.connected});}
    catch{const saved=await storage('get','account').catch(()=>null);this.actor=saved?.actor??null;this.connected=saved?.connected??false;}
    const btn=document.getElementById('accountBtn');btn.textContent=this.actor?'Sign out':'Sign in';btn.disabled=!this.connected;
    this.initialised=true;
    this.notify(this.actor?'Your saved quizzes and progress are connected.':this.connected?'Paste or upload a quiz, or sign in to sync.':'Local quizzes ready. Connected services await account setup.');
    const params=new URLSearchParams(location.search);
    try{if(params.has('mapping')){await this.show('packs');await this.renderMappings(document.getElementById('workspace'),params.get('mapping'));}else if(params.has('pack'))await this.openPack(params.get('pack'));else if(params.has('session'))await this.resume(params.get('session'));else if(!this.renderToken)await this.show(['home','sources','packs','progress','settings','quiz'].includes(params.get('view'))?params.get('view'):'home');}catch(e){this.notify(e.message,true);}
    window.addEventListener('online',()=>this.tick());window.addEventListener('focus',()=>this.tick());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.tick();});
    setInterval(()=>{if(!document.hidden)this.tick();},15000);
  }
  async begin(questions){return this.serial(async()=>{
    this.active={kind:'session',id:id(),owner:this.selectedPack?this.actor?.id??this.selectedPack.owner:null,packId:this.selectedPack?.id??null,pack:this.selectedPack??{id:null,title:'Local quiz',questions},order:questions.map(q=>q.id),events:[],pending:[],currentIndex:0,revision:0,status:'active',serverCreated:false,needsCompletion:false,positionDirty:false,inflight:null,updatedAt:new Date().toISOString()};
    await this.persist();this.status();void this.flush();
  });}
  async answer(questionId,selection,index){return this.serial(async()=>{
    if(!this.active)return;const before=structuredClone(this.active);
    const event={id:id(),questionId,selection,at:new Date().toISOString()};
    replay(this.active.pack.questions,[...this.active.events,event]);
    this.active.events.push(event);if(this.active.owner)this.active.pending.push(event);
    this.active.currentIndex=index;this.active.updatedAt=new Date().toISOString();
    try{await this.persist();}catch(e){this.active=before;throw e;}this.status();void this.flush();
  });}
  async position(index){return this.serial(async()=>{if(!this.active)return;this.active.currentIndex=index;this.active.positionDirty=true;await this.persist();});}
  async finish(){return this.serial(async()=>{if(!this.active)return;this.active.needsCompletion=!!this.active.owner;this.active.status=this.active.owner?'finishing':'completed';this.active.updatedAt=new Date().toISOString();await this.persist();this.status();void this.flush();});}
  status(){const el=document.getElementById('saveStatus');if(!el)return;const s=this.active;el.textContent=!s?'':s.conflict?'Conflict: choose a continuation':!s.owner?'Saved on device':s.pending.length||s.inflight||!s.serverCreated||s.needsCompletion?'Saved on device · sync pending':'Synced';}
  async flush(target=this.active){
    if(this.busy||!navigator.onLine)return;const s=target;if(!s?.owner||s.owner!==this.actor?.id||s.conflict||s.archived)return;
    this.busy=true;
    try{
      if(!s.serverCreated){const created=await this.api('sessions',{id:s.id,packId:s.packId,order:s.order});s.serverCreated=true;s.revision=created.revision;await this.persist(s);}
      const mutation=prepareMutation(s);if(!mutation)return;
      s.inflight=mutation;await this.persist(s);
      const remote=await this.api('sessions/'+s.id,mutation);
      // Do not overwrite a new quiz opened while the request was in flight.
      await this.serial(async()=>{const latest=this.active?.id===s.id?this.active:await storage('get','session:'+s.id);
      const next=acknowledge(latest,remote,mutation);await storage('put','session:'+s.id,next);if(this.active?.id===s.id)this.active=next;});
      this.status();
    }catch(e){
      if(e.status===409){s.conflict=true;await storage('put','session:'+s.id,s);this.notify('This session changed on another device. Open My question packs to resolve it.',true);}
      else this.notify(e.status===401?'Sign in again to sync. Answers remain saved on this device.':e.message,true);
    }finally{this.busy=false;this.status();}
  }
  async tick(){
    if(this.busy)return;
    await this.flush();
    if(this.actor){const queued=(await storage('all')).filter(s=>s.kind==='session'&&s.owner===this.actor.id&&s.id!==this.active?.id&&!s.archived&&(s.pending.length||s.inflight||s.needsCompletion||!s.serverCreated));for(const s of queued)await this.flush(s);}
    const active=this.active;
    if(active?.owner&&active.owner===this.actor?.id&&active.serverCreated&&!active.pending.length&&!active.inflight&&!active.needsCompletion&&!active.conflict&&navigator.onLine){
      try{const revision=active.revision,remote=await this.api('sessions/'+active.id);await this.serial(async()=>{const current=this.active;if(current?.id===active.id&&current.revision===revision&&!current.pending.length&&!current.inflight&&!current.needsCompletion&&!current.positionDirty&&!current.conflict&&remote.revision>revision)await this.installRemote(remote,current.pack,false);});}catch{}
    }
    if(this.actor&&navigator.onLine){try{const sync=await this.api('sync');const pending=sync.jobs.some(j=>j.status!=='synced');document.getElementById('sheetStatus').textContent=!sync.enabled?'Sheet connection not configured':pending?'Sheet update pending':'Sheet up to date';}catch{}}
    if(this.tab==='home'&&Date.now()-(this.homeUpdated??0)>15000&&!document.getElementById('workspace').contains(document.activeElement))await this.show('home',true);
  }
  emit(navigate=true){document.dispatchEvent(new CustomEvent('synapse:session',{detail:{pack:this.active.pack,session:this.active}}));if(navigate)this.show('quiz');this.status();}
  async installRemote(remote,pack,navigate=true){this.selectedPack=pack;this.active={kind:'session',id:remote.id,owner:remote.owner,packId:pack.id,pack,order:remote.state.order,events:remote.state.events,pending:[],currentIndex:remote.state.currentIndex,revision:remote.revision,status:remote.status,serverCreated:true,needsCompletion:false,positionDirty:false,inflight:null,updatedAt:remote.completed_at??remote.started_at};await this.persist();this.emit(navigate);}
  async resume(sessionId){
    const local=await storage('get','session:'+sessionId);
    if(local){if(local.owner&&local.owner!==this.actor?.id)throw new Error('Sign in to the account that owns this session.');this.active=local;this.selectedPack=local.packId?local.pack:null;this.emit();await this.tick();return;}
    const remote=await this.api('sessions/'+sessionId),pack=await this.api('packs/'+remote.pack_id);await this.installRemote(remote,pack);
  }
  async resumeLatest(){
    const locals=(await storage('all')).filter(r=>r.kind==='session'&&!r.archived&&(!r.owner||r.owner===this.actor?.id));
    let cloud=[];if(this.actor){try{cloud=await this.api('sessions');}catch{cloud=(await storage('get','dashboard:'+this.actor.id))?.sessions??[];}}
    const sessions=[...new Map([...cloud.map(s=>({...s,updatedAt:s.completed_at??s.started_at})),...locals].map(s=>[s.id,s])).values()].sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed')||b.updatedAt.localeCompare(a.updatedAt));
    if(!sessions.length){this.notify('No saved sessions yet. Paste or upload a quiz to begin.');return;}
    if(sessions[0].conflict){await this.show('packs');this.notify('Choose a continuation for the conflicting session.');return;}
    await this.resume(sessions[0].id);
  }
  async openPack(packId){
    let pack;try{pack=await this.api('packs/'+packId);await storage('put','pack:'+packId,{kind:'pack',owner:this.actor.id,pack});}
    catch(e){const cached=await storage('get','pack:'+packId);if(!cached||cached.owner!==this.actor?.id)throw e;pack=cached.pack;}
    this.selectedPack=pack;
    this.show('quiz');document.dispatchEvent(new CustomEvent('synapse:pack',{detail:pack}));
  }
  async saveImported(){
    try{
      if(!this.actor)throw new Error('Sign in before saving a pack to your account.');
      const questions=await window.synapseQuestions();if(!questions?.length)throw new Error('Paste, upload or start a quiz first.');
      const title=prompt('Name this question pack','Imported quiz');if(!title)return;
      const data={requestId:id(),title,mode:'imported',questions:questions.map(q=>({question:q.question,options:q.options,answer:q.answer}))};
      // Persist the request ID so a network timeout can be retried without duplicate packs.
      await storage('put','save-request',{kind:'save-request',owner:this.actor.id,data});
      const p=await this.api('packs',data);await storage('delete','save-request');await storage('put','pack:'+p.id,{kind:'pack',owner:this.actor.id,pack:p});
      this.notify('Pack saved. Your current local attempt is unchanged; open the saved pack for tracked attempts.');await this.show('packs');
    }catch(e){this.notify(e.message,true);}
  }
  async show(view,quiet=false){
    const token=this.renderToken=(this.renderToken??0)+1;
    this.tab=view;document.getElementById('app').hidden=view!=='quiz';const panel=document.getElementById('workspace');panel.hidden=view==='quiz';
    document.getElementById('savePackBtn').hidden=view!=='quiz';
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    if(view==='quiz')return;
    if(!quiet)panel.innerHTML='<p role="status">Loading your study space…</p>';
    const content=document.createElement('div');
    try{
      if(view==='home')await renderHome(content,this);
      if(view==='sources')renderSources(content,this);
      if(view==='packs')await this.renderPacks(content);
      if(view==='progress')await this.renderProgress(content);
      if(view==='settings')await this.renderSettings(content);
      if(this.renderToken===token){panel.replaceChildren(content);if(view==='home')this.homeUpdated=Date.now();}
    }catch(e){if(this.renderToken===token){panel.textContent=e.message;const retry=document.createElement('button');retry.className='btn secondary';retry.textContent='Try again';retry.onclick=()=>this.show(view);panel.append(retry);}}
  }
  async renderPacks(panel){
    let packs=(await storage('all')).filter(r=>r.kind==='pack'&&r.owner===this.actor?.id).map(r=>r.pack),sessions=[];
    if(this.actor&&navigator.onLine){packs=await this.api('packs');sessions=await this.api('sessions');}
    const locals=(await storage('all')).filter(r=>r.kind==='session'&&!r.archived&&(!r.owner||r.owner===this.actor?.id));
    const conflicts=locals.filter(s=>s.conflict);
    panel.innerHTML=`<h1>My question packs</h1><p>Open a saved pack to start a new attempt. Downloaded packs work offline.</p>${conflicts.map(s=>`<article class="card padded"><h2>Conflicting session</h2><p>${esc(s.pack.title)}. Both continuations are preserved. Keeping local work creates a separate practice attempt.</p><button class="btn" data-conflict="remote" data-id="${s.id}">Use cloud continuation</button> <button class="btn secondary" data-conflict="local" data-id="${s.id}">Keep local as separate attempt</button><button class="btn ghost" data-export="${s.id}">Export both</button></article>`).join('')}<div class="pack-grid">${packs.map(p=>`<article class="card padded"><h2>${esc(p.title)}</h2><p>${esc(p.mode)}</p><button class="btn" data-pack="${p.id}">Start quiz</button> <button class="btn secondary" data-map="${p.id}">Topic mappings</button></article>`).join('')||'<p>No saved packs yet. Paste or upload a quiz, then save it to your account.</p>'}</div><h2>Continue a session</h2>${[...new Map([...sessions,...locals.map(s=>({id:s.id,title:s.pack.title,status:s.status}))].map(s=>[s.id,s])).values()].map(s=>`<p><button class="btn secondary" data-resume="${s.id}">${esc(s.title)} · ${esc(s.status)}</button></p>`).join('')}`;
    panel.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>this.openPack(b.dataset.pack).catch(e=>this.notify(e.message,true)));
    panel.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>this.resume(b.dataset.resume).catch(e=>this.notify(e.message,true)));
    panel.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>this.renderMappings(panel,b.dataset.map).catch(e=>this.notify(e.message,true)));
    panel.querySelectorAll('[data-conflict]').forEach(b=>b.onclick=()=>this.resolveConflict(b.dataset.id,b.dataset.conflict).catch(e=>this.notify(e.message,true)));
    panel.querySelectorAll('[data-export]').forEach(b=>b.onclick=async()=>download('synapse-conflict.json',{local:await storage('get','session:'+b.dataset.export),remote:await this.api('sessions/'+b.dataset.export)}));
  }
  async resolveConflict(sessionId,choice){
    const local=await storage('get','session:'+sessionId),remote=await this.api('sessions/'+sessionId);
    await storage('put','conflict-archive:'+sessionId,{kind:'conflict-archive',owner:local.owner,local,remote});
    if(choice==='remote'){await this.installRemote(remote,local.pack);this.notify('Cloud continuation restored. Both answer paths are preserved in your device export.');return;}
    const replacement={...local,id:id(),revision:0,serverCreated:false,pending:local.events.map(e=>({...e,id:id()})),inflight:null,conflict:false,needsCompletion:local.needsCompletion||local.status==='completed'};
    replacement.events=[...replacement.pending];await storage('put','session:'+sessionId,{...local,conflict:false,archived:true});this.active=replacement;await this.persist();this.emit();await this.flush();this.notify('Local continuation saved as a separate practice attempt.');
  }
  async renderMappings(panel,packId){
    const pack=await this.api('packs/'+packId);this.catalog=await this.api('topics');const proposals=await this.api('mappings?packId='+packId);
    panel.innerHTML=`<h1>Topic mappings</h1><p>Only the primary topic and domain receive competency evidence. Unmapped questions remain ordinary quiz questions.</p><datalist id="topicList">${this.catalog.map(t=>`<option value="${esc(t.id)}">${esc(t.label)} · ${esc(t.type)}</option>`).join('')}</datalist><form id="mappingForm">${pack.questions.map((q,i)=>`<fieldset class="card padded" data-question="${q.id}"><legend>Question ${i+1}</legend><p>${esc(q.question)}</p><label>Primary topic ID <input name="topic" list="topicList" value="${esc(q.topicId??'')}" placeholder="Search or select a topic ID"></label><label>Domain <select name="domain">${DOMAINS.map((d,n)=>`<option value="${d}" ${q.domain===d?'selected':''}>${esc(DOMAIN_LABELS.Condition[n])}</option>`).join('')}</select></label><button type="button" class="btn ghost" data-exclude="${q.id}">Dispute / exclude question</button></fieldset>`).join('')}<button class="btn">Review mappings</button></form>${proposals.map(p=>`<article class="card padded"><h2>Proposed mappings</h2><ul>${p.payload.mappings.map(m=>`<li>Q${pack.questions.findIndex(q=>q.id===m.questionId)+1}: ${esc(this.catalog.find(t=>t.id===m.topicId)?.label)} · ${esc(m.domain)}</li>`).join('')}</ul><button class="btn" data-confirm="${p.id}">Confirm these mappings</button></article>`).join('')}`;
    panel.querySelector('#mappingForm').onsubmit=async e=>{e.preventDefault();try{const mappings=[...panel.querySelectorAll('[data-question]')].flatMap(f=>{const topicId=f.querySelector('[name=topic]').value.trim();return topicId?[{questionId:f.dataset.question,topicId,domain:f.querySelector('[name=domain]').value}]:[];});await this.api('mappings',{requestId:id(),packId,mappings});await this.renderMappings(panel,packId);}catch(e){this.notify(e.message,true);}};
    panel.querySelectorAll('[data-question]').forEach(field=>{const topic=field.querySelector('[name=topic]'),select=field.querySelector('[name=domain]');const labels=()=>{const type=this.catalog.find(t=>t.id===topic.value.trim())?.type??'Condition';[...select.options].forEach((o,i)=>o.textContent=DOMAIN_LABELS[type][i]);};topic.oninput=labels;labels();});
    panel.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=async()=>{await this.api('mappings/'+b.dataset.confirm+'/confirm',{});await this.renderMappings(panel,packId);});
    panel.querySelectorAll('[data-exclude]').forEach(b=>b.onclick=async()=>{const reason=prompt('Why should this question be excluded from competency evidence?');if(reason){await this.api('exclusions',{questionId:b.dataset.exclude,reason});this.notify('Question excluded; competency recalculated.');}});
  }
  async renderProgress(panel){
    if(!this.actor)throw new Error('Sign in to view your UKMLA progress.');
    let items,stale=false;try{items=await this.api('progress');await storage('put','progress:'+this.actor.id,{kind:'progress',owner:this.actor.id,items});}catch(e){items=(await storage('get','progress:'+this.actor.id))?.items;if(!items)throw e;stale=true;}
    const options=values=>[...new Set(values)].sort().map(s=>`<option>${esc(s)}</option>`).join('');
    panel.innerHTML=`<p class="eyebrow">COVERAGE & RETENTION</p><h1>UKMLA progress</h1><p>First-attempt SBA evidence · rule ccs-1. Manual confidence remains in your Google Sheet.</p>${stale?'<p class="notice">Showing saved progress. Cloud updates are unavailable.</p>':''}<div class="row"><input id="topicSearch" placeholder="Search topics, aliases or IDs" aria-label="Search topics"><select id="ratingFilter" aria-label="Filter competency"><option value="">All ratings</option>${['Untested','Red','Amber','Green','Overdue'].map(s=>`<option>${s}</option>`).join('')}</select><select id="blockFilter" aria-label="Filter block"><option value="">All blocks</option>${options(items.flatMap(t=>t.blocks))}</select><select id="systemFilter" aria-label="Filter body system"><option value="">All body systems</option>${options(items.flatMap(t=>t.systems))}</select><select id="typeFilter" aria-label="Filter topic type"><option value="">Conditions & presentations</option><option>Condition</option><option>Presentation</option></select></div><p id="topicCount" role="status"></p><div class="table-scroll" tabindex="0" role="region" aria-label="Topic evidence; scroll horizontally on small screens"><table><thead><tr><th>Topic</th><th>Competency</th><th>Accuracy</th><th>Coverage</th><th>Next review</th></tr></thead><tbody id="progressRows"></tbody></table></div>`;
    const draw=()=>{const query=panel.querySelector('#topicSearch').value.toLowerCase(),status=panel.querySelector('#ratingFilter').value,block=panel.querySelector('#blockFilter').value,system=panel.querySelector('#systemFilter').value,type=panel.querySelector('#typeFilter').value;const filtered=items.filter(t=>`${t.label} ${t.id} ${(t.aliases??[]).join(' ')}`.toLowerCase().includes(query)&&(!block||t.blocks.includes(block))&&(!system||t.systems.includes(system))&&(!type||t.type===type)&&(!status||(status==='Overdue'?t.overdue:t.status===status)));panel.querySelector('#topicCount').textContent=`${filtered.length} ${filtered.length===1?'topic':'topics'}`;panel.querySelector('#progressRows').innerHTML=filtered.map(t=>`<tr><td><strong>${esc(t.label)}</strong><small>${esc(t.type)} · ${esc(t.id)}</small><details><summary>Evidence</summary><p>${esc(t.reason)}</p>${t.domains.map((d,i)=>`<p>${esc(DOMAIN_LABELS[t.type][i])}: ${d.count} questions${d.accuracy===null?'':`, ${d.accuracy.toFixed(0)}%`}</p>`).join('')}</details></td><td><span class="rag ${t.status.toLowerCase()}">${t.status}</span>${t.overdue?'<small>Review overdue</small>':''}</td><td>${t.accuracy===null?'—':t.accuracy.toFixed(0)+'%'}</td><td>${t.coverage}/5<small>${t.evidenceCount} eligible questions</small></td><td>${date(t.nextReview)}</td></tr>`).join('')||'<tr><td colspan="5">No topics match these filters.</td></tr>';};
    panel.querySelectorAll('input,select').forEach(el=>el.oninput=draw);draw();
  }
  async renderSettings(panel){
    const pendingSave=await storage('get','save-request');
    panel.innerHTML=`<h1>Connections and backups</h1><p>${this.actor?esc(this.actor.email):'Not signed in'}</p><p>ChatGPT generates and reviews in your subscription. Synapse does not call an AI model.</p><div class="row"><button id="retrySync" class="btn">Retry sheet sync</button><button id="exportBackup" class="btn secondary">Export account backup</button><button id="exportLocal" class="btn secondary">Export device data</button></div><p>Restore an account backup into an empty account: <input id="restoreBackup" type="file" accept="application/json,.json"></p>${pendingSave?.owner===this.actor?.id?'<button id="retryPack" class="btn">Retry interrupted pack save</button>':''}<p id="syncDetails"></p>`;
    const action=fn=>async()=>{try{await fn();}catch(e){this.notify(e.message,true);}};
    for(const name of ['retrySync','exportBackup','restoreBackup'])panel.querySelector('#'+name).disabled=!this.actor;
    panel.querySelector('#retrySync').onclick=action(async()=>{const result=await this.api('sync',{});panel.querySelector('#syncDetails').textContent=result.status==='synced'?'Your Google Sheet is up to date.':result.status==='not_configured'?'The Google Sheet connection has not been configured.':result.status==='busy'?'A sheet update is already running. Check again shortly.':'Your progress is saved. The sheet update is pending. '+(result.error??'It will retry automatically.');});
    panel.querySelector('#exportBackup').onclick=action(async()=>download('synapse-account-backup.json',await this.api('backup')));
    panel.querySelector('#exportLocal').onclick=action(async()=>download('synapse-device-backup.json',{format:'synapse-device-v1',records:await storage('all')}));
    panel.querySelector('#restoreBackup').onchange=action(async()=>{const file=panel.querySelector('#restoreBackup').files[0];if(file){await this.api('restore',JSON.parse(await file.text()));this.notify('Account restored.');}});
    const recovery=document.createElement('section');recovery.innerHTML='<p>Restore saved packs and sessions on this device: <input id="restoreDevice" type="file" accept="application/json,.json"></p><details><summary>Update the topic catalogue</summary><p>Upload catalogue JSON to preview changes. Existing IDs and history are preserved.</p><input id="catalogImport" type="file" accept="application/json,.json"><div id="catalogPreview"></div></details>';panel.append(recovery);
    recovery.querySelector('#restoreDevice').onchange=action(async()=>{if(this.busy)throw new Error('Wait for the current save to finish.');const file=recovery.querySelector('#restoreDevice').files[0];if(file){const n=await this.serial(()=>file.text().then(text=>restoreDevice(JSON.parse(text),this.actor?.id)));this.notify(`${n} device records restored. Use Resume saved quiz to continue.`);}});
    recovery.querySelector('#catalogImport').onchange=action(async()=>{const file=recovery.querySelector('#catalogImport').files[0];if(!file)return;const data=JSON.parse(await file.text()),preview=await this.api('catalog/preview',{topics:data.topics});const output=recovery.querySelector('#catalogPreview');output.innerHTML=`<p>${preview.changes.length} changed or new topics. ${preview.preservedAbsent.length} omitted topics will be preserved.</p><ul>${preview.changes.map(t=>`<li>${esc(t.id)} · ${esc(t.label)} · ${esc(t.type)}<br>Systems: ${esc(t.systems.join(', '))}; blocks: ${esc(t.blocks.join(', '))}; aliases: ${esc(t.aliases.join(', '))}</li>`).join('')}</ul><button id="confirmCatalog" class="btn">Confirm catalogue changes</button>`;output.querySelector('button').onclick=action(async()=>{await this.api('catalog/confirm',{previewId:preview.previewId});output.textContent='Catalogue updated. Assessment history preserved.';});});
    const retry=panel.querySelector('#retryPack');if(retry)retry.onclick=action(async()=>{await this.api('packs',pendingSave.data);await storage('delete','save-request');await this.show('packs');});
  }
  async signOut(){
    if(this.busy){this.notify('Wait for the current save to finish before signing out.');return;}
    const all=await storage('all'),unsynced=all.filter(r=>r.kind==='session'&&r.owner===this.actor.id&&(r.pending.length||r.inflight||r.needsCompletion||!r.serverCreated));
    if(unsynced.length){if(!confirm('There is unsynced work. Export a copy before signing out and clearing this account’s device data?'))return;download('synapse-unsynced.json',{format:'synapse-device-v1',records:unsynced});}
    try{const response=await fetch('./auth/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw new Error('Sign-out failed.');
      const db=await import('./shared/offline.js');const handle=await db.openDatabase();await new Promise((resolve,reject)=>{const tx=handle.transaction('records','readwrite'),s=tx.objectStore('records'),cursor=s.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(c.value.owner===this.actor.id||c.key==='account')c.delete();c.continue();}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});handle.close();location.assign('./');
    }catch(e){this.notify(e.message,true);}
  }
}
export const connected=new Connected();
