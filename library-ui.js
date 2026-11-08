import {storage} from './shared/offline.js';
import {STAGE_LABELS} from './shared/learning.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique=items=>[...new Set(items)].filter(Boolean).sort((a,b)=>a.localeCompare(b));
const date=value=>value?new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not studied yet';
export async function loadPackLibrary(app){
  const records=await storage('all'),cached=records.find(r=>r.kind==='pack-library'&&r.owner===app.actor?.id);
  let packs=cached?.packs??records.filter(r=>r.kind==='pack'&&r.owner===app.actor?.id).map(r=>({...r.pack,question_count:r.pack.questions.length})),stale=false;
  if(app.actor){
    try{
      const latest=[];let offset=0;
      while(true){const page=await app.api('packs'+(offset?'?offset='+offset:''));latest.push(...page);if(page.length<500)break;offset+=page.length;}
      packs=latest;await storage('put','pack-library:'+app.actor.id,{kind:'pack-library',owner:app.actor.id,packs});
    }catch{stale=true;}
  }
  return {packs,stale};
}
export function renderLibrary(panel,app,packs,sessions,{stale=false}={}){
  const filters=app.libraryFilters??={query:'',shelf:'library',collection:'',block:'',stage:'',status:'',sort:'newest',limit:12};
  const downloaded=new Set();
  const options=values=>values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const collections=()=>unique(packs.map(p=>p.collection));
  if(filters.collection&&!['__none',...collections()].includes(filters.collection))filters.collection='';
  panel.innerHTML=`<section class="pack-library" aria-label="Question pack library">
    ${stale?'<p class="notice" role="status">Showing the saved library. Reconnect to refresh or organise packs. Only downloaded packs can open offline.</p>':''}
    <div class="library-shelves" aria-label="Pack shelves"><button class="btn secondary" data-shelf="library">My library <span></span></button><button class="btn secondary" data-shelf="pinned">Pinned <span></span></button><button class="btn secondary" data-shelf="archive">Archive <span></span></button></div>
    <label class="library-search">Find a pack<input id="packSearch" type="search" placeholder="Search titles, topics or collections" value="${esc(filters.query)}"></label>
    <div class="library-filters"><label>Collection<select id="packCollection"><option value="">All collections</option><option value="__none">Unfiled</option>${options(collections())}</select></label><label>Sort by<select id="packSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option><option value="studied">Recently studied</option></select></label></div>
    <details class="filter-details"><summary>More filters <span id="packFilterCount"></span></summary><div class="library-filters"><label>Teaching block<select id="packBlock"><option value="">All teaching blocks</option>${options(unique(packs.flatMap(p=>p.blocks??[])))}</select></label><label>Learning stage<select id="packStage"><option value="">All stages</option>${Object.entries(STAGE_LABELS).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}<option value="unclassified">No stage assigned</option></select></label><label>Study status<select id="packStudyStatus"><option value="">Any status</option><option value="new">Not started</option><option value="active">In progress</option><option value="completed">Completed at least once</option></select></label></div><p class="fine-print">Topics and teaching blocks come from confirmed question mappings. Collections are your own folders.</p></details>
    <div class="section-heading"><p id="packCount" role="status"></p><button id="clearPackFilters" class="btn ghost small">Clear filters</button></div>
    <p id="libraryMessage" role="status" aria-live="polite"></p><div id="libraryCards" class="pack-grid"></div><button id="morePacks" class="btn secondary">Show more packs</button>
    <datalist id="collectionNames">${options(collections())}</datalist>
    </section>`;
  const controls={collection:'packCollection',block:'packBlock',stage:'packStage',status:'packStudyStatus',sort:'packSort'};
  for(const [key,id] of Object.entries(controls))panel.querySelector('#'+id).value=filters[key];
  const stats=p=>{const related=sessions.filter(s=>s.pack_id===p.id);const active=related.find(s=>['active','finishing'].includes(s.status)&&!s.conflict);return {attempts:Math.max(p.attempt_count??0,related.length),completed:Math.max(p.completed_count??0,related.filter(s=>s.status==='completed').length),active:related.some(s=>s.id===(active?.id??p.active_session_id)&&s.conflict)?null:active?.id??p.active_session_id};};
  let saving=false;
  const message=text=>{panel.querySelector('#libraryMessage').textContent=text;};
  async function save(p,changes){
    if(saving)return;
    if(!app.actor){message('Sign in to organise saved account packs.');return;}
    if(!navigator.onLine||stale){message('Reconnect and refresh the library before organising packs. Your quizzes are still available.');return;}
    saving=true;panel.querySelectorAll('[data-pin],[data-archive],.collection-form button').forEach(b=>b.disabled=true);
    try{
      const saved=await app.api('packs/'+p.id+'/organisation',{expectedRevision:p.library_revision??0,preferences:{collection:p.collection??'',pinned:!!p.pinned,archived:!!p.archived,...changes}});
      Object.assign(p,saved);await storage('put','pack-library:'+app.actor.id,{kind:'pack-library',owner:app.actor.id,packs});
      const select=panel.querySelector('#packCollection');select.innerHTML='<option value="">All collections</option><option value="__none">Unfiled</option>'+options(collections());
      if(filters.collection&&!['__none',...collections()].includes(filters.collection))filters.collection='';select.value=filters.collection;
      panel.querySelector('#collectionNames').innerHTML=options(collections());draw();
      message(changes.archived===true?'Pack archived. Questions and all attempt history are retained.':changes.archived===false?'Pack restored to your library.':'Pack organisation synced.');
    }catch(e){message(e.message+' Your saved questions and results are unchanged.');}
    finally{saving=false;panel.querySelectorAll('[data-pin],[data-archive],.collection-form button').forEach(b=>b.disabled=false);}
  }
  function draw(){
    panel.querySelectorAll('[data-shelf]').forEach(b=>{const shelf=b.dataset.shelf;b.setAttribute('aria-pressed',String(filters.shelf===shelf));b.querySelector('span').textContent=packs.filter(p=>shelf==='archive'?p.archived:!p.archived&&(shelf!=='pinned'||p.pinned)).length;});
    const query=filters.query.toLocaleLowerCase().trim();
    const shown=packs.filter(p=>{
      const s=stats(p),search=[p.title,p.collection,p.mode,...(p.topics??[]).map(t=>t.label),...(p.blocks??[])].join(' ').toLocaleLowerCase();
      return (filters.shelf==='archive'?p.archived:!p.archived&&(filters.shelf!=='pinned'||p.pinned))&&search.includes(query)&&(!filters.collection||(filters.collection==='__none'?!p.collection:p.collection===filters.collection))&&(!filters.block||p.blocks?.includes(filters.block))&&(!filters.stage||(filters.stage==='unclassified'?!p.stages?.length:p.stages?.includes(filters.stage)))&&(!filters.status||(filters.status==='new'?!s.attempts:filters.status==='active'?!!s.active:s.completed>0));
    }).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(filters.sort==='title'?a.title.localeCompare(b.title):filters.sort==='oldest'?(a.created_at??'').localeCompare(b.created_at??''):filters.sort==='studied'?(b.last_studied??'').localeCompare(a.last_studied??''):(b.created_at??'').localeCompare(a.created_at??'')));
    panel.querySelector('#packFilterCount').textContent=[filters.block,filters.stage,filters.status].filter(Boolean).length?'· '+[filters.block,filters.stage,filters.status].filter(Boolean).length+' active':'';
    panel.querySelector('#packCount').textContent=`${shown.length} ${shown.length===1?'pack':'packs'}${shown.length>filters.limit?` · showing ${Math.min(shown.length,filters.limit)}`:''}`;
    const cards=panel.querySelector('#libraryCards');cards.innerHTML=shown.slice(0,filters.limit).map(p=>{
      const s=stats(p),topics=p.topics??[];
      return `<article class="card padded library-pack" data-library-pack="${esc(p.id)}"><div class="section-heading"><span class="pack-folder">${esc(p.collection||'Unfiled')}</span><button class="btn ghost small" data-pin="${esc(p.id)}" aria-pressed="${!!p.pinned}" aria-label="${p.pinned?'Unpin':'Pin'} ${esc(p.title)}">${p.pinned?'Pinned':'Pin'}</button></div><h2>${esc(p.title)}</h2><p class="fine-print">${p.question_count??p.questions?.length??'—'} questions · ${esc((p.stages??[]).map(s=>STAGE_LABELS[s]??s).join(' / ')||p.mode||'Imported')}</p><p class="pack-topics">${topics.length?esc(topics.slice(0,3).map(t=>t.label).join(' · '))+(topics.length>3?` +${topics.length-3} more`:''):'No confirmed topic mappings'}</p><p class="fine-print">${s.active?'In progress · ':''}${s.completed?`${s.completed} completed ${s.completed===1?'attempt':'attempts'}`:s.attempts?'Practised; no completed attempt':'Not started'}<br>Added ${date(p.created_at)}${p.last_studied?` · Last studied ${date(p.last_studied)}`:''}${downloaded.has(p.id)?'<br>Available offline':''}</p><div class="row pack-start">${s.active?`<button class="btn" data-library-resume="${esc(s.active)}">Continue attempt</button>`:''}<button class="btn ${s.active?'secondary':''}" data-library-start="${esc(p.id)}">${s.attempts?'Start new attempt':'Start quiz'}</button></div><details class="pack-actions"><summary>Organise & details</summary><form class="collection-form" data-collection-pack="${esc(p.id)}"><label>Collection<input name="collection" list="collectionNames" maxlength="80" placeholder="e.g. MSK — fractures" value="${esc(p.collection??'')}"></label><button class="btn secondary small">Save collection</button></form><div class="row"><button class="btn ghost small" data-library-map="${esc(p.id)}">Topic mappings</button><button class="btn ghost small" data-archive="${esc(p.id)}">${p.archived?'Restore to library':'Archive pack'}</button></div><p class="fine-print">Archiving hides the pack from your library. Saved answers and competency evidence are kept.</p></details></article>`;
    }).join('')||`<p class="empty-state">${!packs.length?'No saved packs yet. Paste or upload a quiz, then save it to your account.':filters.shelf==='archive'?'No archived packs match these filters.':filters.shelf==='pinned'?'No pinned packs match. Pin a favourite in My library.':'No packs match these filters. Try another topic or clear your filters.'}</p>`;
    panel.querySelector('#morePacks').hidden=shown.length<=filters.limit;
    cards.querySelectorAll('[data-library-start]').forEach(b=>b.onclick=()=>app.openPack(b.dataset.libraryStart).catch(e=>app.notify(e.message,true)));
    cards.querySelectorAll('[data-library-resume]').forEach(b=>b.onclick=()=>app.resume(b.dataset.libraryResume).catch(e=>app.notify(e.message,true)));
    cards.querySelectorAll('[data-library-map]').forEach(b=>b.onclick=()=>app.renderMappings(document.getElementById('workspace'),b.dataset.libraryMap).catch(e=>app.notify(e.message,true)));
    cards.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{const p=packs.find(p=>p.id===b.dataset.pin);void save(p,{pinned:!p.pinned});});
    cards.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>{const p=packs.find(p=>p.id===b.dataset.archive);void save(p,{archived:!p.archived});});
    cards.querySelectorAll('.collection-form').forEach(f=>f.onsubmit=e=>{e.preventDefault();void save(packs.find(p=>p.id===f.dataset.collectionPack),{collection:f.elements.collection.value.trim()});});
  }
  panel.querySelector('#packSearch').oninput=e=>{filters.query=e.target.value;filters.limit=12;draw();};
  for(const [key,id] of Object.entries(controls))panel.querySelector('#'+id).onchange=e=>{filters[key]=e.target.value;filters.limit=12;draw();};
  panel.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>{filters.shelf=b.dataset.shelf;filters.limit=12;draw();});
  panel.querySelector('#morePacks').onclick=()=>{filters.limit+=12;draw();};
  panel.querySelector('#clearPackFilters').onclick=()=>{Object.assign(filters,{query:'',collection:'',block:'',stage:'',status:'',sort:'newest',limit:12});panel.querySelector('#packSearch').value='';for(const [key,id] of Object.entries(controls))panel.querySelector('#'+id).value=filters[key];draw();};
  draw();void storage('all').then(records=>{records.filter(r=>r.kind==='pack'&&r.owner===app.actor?.id).forEach(r=>downloaded.add(r.pack.id));if(panel.isConnected&&!panel.contains(document.activeElement))draw();});
}
