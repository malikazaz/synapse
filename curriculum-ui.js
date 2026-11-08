import {storage} from './shared/offline.js';
import {DOMAIN_LABELS} from './shared/quiz.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique=values=>[...new Set(values)].sort();
export const scopeLabel=value=>({'core':'Core teaching','self-study':'Self-directed study','supplementary':'Supplementary learning'}[value]??value);
export const blockLabel=b=>`Year ${b.year} · ${b.label}${b.topic_block==='MSK'?' (MSK)':''}`;
export async function loadCurriculum(app){
  if(!app.actor)return {blocks:[],items:[],available:false};
  if(app.curriculumCache?.owner===app.actor.id&&Date.now()-app.curriculumCache.at<60000)return app.curriculumCache.value;
  const key='curriculum-view:'+app.actor.id;
  try{
    let offset=0,blocks=[],items=[];
    do{
      const page=await app.api('curriculum?limit=500&offset='+offset);blocks=page.blocks??[];items.push(...(page.items??[]));
      if(page.nextOffset==null)break;
      if(page.nextOffset<=offset)throw new Error('Guide pagination did not advance.');offset=page.nextOffset;
    }while(true);
    const value={blocks,items,available:true};app.curriculumCache={owner:app.actor.id,at:Date.now(),value};
    await storage('put',key,{kind:'curriculum-view',owner:app.actor.id,value});return value;
  }catch{
    const saved=await storage('get',key).catch(()=>null);
    return saved?{...saved.value,stale:true}:{blocks:[],items:[],available:false};
  }
}
export function teachingChoices(curriculum){return curriculum.blocks.map(b=>({value:b.topic_block,label:blockLabel(b),id:b.id}));}
export function earlierGroups(topics,curriculum){const known=new Set(teachingChoices(curriculum).map(b=>b.value));return unique(topics.flatMap(t=>t.blocks??[])).filter(b=>!known.has(b));}
function matchingEntries(topic,curriculum,filter={}){
  const blockIds=new Set(curriculum.blocks.filter(b=>!filter.block||b.topic_block===filter.block).map(b=>b.id));
  return curriculum.items.filter(i=>i.topic_id===topic.id&&blockIds.has(i.block_id)&&(!filter.section||i.section===filter.section)&&(!filter.scope||i.priority===filter.scope));
}
export function topicOriginHtml(topic,curriculum,filter={},compact=false){
  if(!curriculum.available)return '<small class="topic-origin">Guide origins are unavailable; existing topic groups are preserved.</small>';
  const entries=matchingEntries(topic,curriculum,filter);
  if(!entries.length)return `<small class="topic-origin">${curriculum.blocks.length?'Retained catalogue topic — no mapped entry in the selected guide sections.':'No course guide imported for this topic.'}${topic.blocks?.length?' Earlier groups: '+esc(topic.blocks.join(', '))+'.':''}</small>`;
  const lines=unique(entries.map(i=>{const b=curriculum.blocks.find(b=>b.id===i.block_id);return `${blockLabel(b)} → ${i.section||'Section not specified'} · ${scopeLabel(i.priority)}`;}));
  const details=entries.map(i=>{const b=curriculum.blocks.find(b=>b.id===i.block_id);return `<li><strong>${esc(blockLabel(b))} · ${esc(i.section)}</strong><br>${esc(scopeLabel(i.priority))}<br>Guide wording: ${esc(i.source_label)}<br>Source: ${esc(b.source_name)} · ${esc(i.source_locator)}${i.notes?'<br>Mapping note: '+esc(i.notes):''}</li>`;}).join('');
  return `<div class="topic-origin">${lines.map(line=>'<small>'+esc(line)+'</small>').join('')}${compact?'':`<details><summary>Why this topic is here</summary><ul>${details}</ul></details>`}</div>`;
}
export function guideSectionsHtml(curriculum,block){
  const entries=curriculum.items.filter(i=>i.block_id===block.id);
  return `<details><summary>Sections in this guide</summary><ul>${unique(entries.map(i=>i.section)).map(section=>`<li><strong>${esc(section||'Section not specified')}</strong> · ${unique(entries.filter(i=>i.section===section).map(i=>scopeLabel(i.priority))).map(esc).join(', ')}</li>`).join('')}</ul></details>`;
}
export async function renderCurriculumProgress(panel,app){
  if(!app.actor)throw new Error('Sign in to view your UKMLA progress.');
  let topics,stale=false;
  try{topics=await app.api('progress');await storage('put','progress:'+app.actor.id,{kind:'progress',owner:app.actor.id,items:topics});}
  catch(error){topics=(await storage('get','progress:'+app.actor.id))?.items;if(!topics)throw error;stale=true;}
  const curriculum=await loadCurriculum(app),blocks=teachingChoices(curriculum),groups=earlierGroups(topics,curriculum);
  const options=values=>unique(values).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  panel.innerHTML=`<p class="eyebrow">COVERAGE & RETENTION</p><h1>UKMLA progress</h1><p>A teaching block can include several specialties. Guide sections explain why a topic is assigned; body systems describe its clinical area.</p><p class="fine-print">First-attempt knowledge evidence · rule ccs-2-akt. All learning stages share one topic record. Manual confidence remains in your Google Sheet.</p>${stale?'<p class="notice">Showing saved progress. Cloud updates are unavailable.</p>':''}${curriculum.stale?'<p class="notice">Showing saved guide descriptions.</p>':!curriculum.available?'<p class="notice">Guide descriptions are unavailable. You can still browse all topics and earlier catalogue groups.</p>':''}
    <div class="curriculum-filters primary-filters">
    <label>Teaching block<select id="blockFilter" aria-label="Filter teaching block"><option value="">All teaching blocks</option>${blocks.map(b=>`<option value="${esc(b.value)}">${esc(b.label)}</option>`).join('')}</select></label>
    <label>Search<input id="topicSearch" type="search" placeholder="Find a topic…" aria-label="Search topics"></label></div>
    <details class="filter-details"><summary>Refine topics <span id="filterCount"></span></summary><div class="curriculum-filters">
    <label>Guide section<select id="sectionFilter" aria-label="Filter guide section"></select></label>
    <label>Teaching scope<select id="scopeFilter" aria-label="Filter teaching scope"><option value="">All teaching scopes</option>${['core','self-study','supplementary'].map(v=>`<option value="${v}">${scopeLabel(v)}</option>`).join('')}</select></label>
    <label>Body system<select id="systemFilter" aria-label="Filter body system"><option value="">All body systems</option>${options(topics.flatMap(t=>t.systems))}</select></label>
    <label>Competency<select id="ratingFilter" aria-label="Filter competency"><option value="">All ratings</option>${options(['Untested','Red','Amber','Green','Overdue'])}</select></label>
    <label>Topic type<select id="typeFilter" aria-label="Filter topic type"><option value="">Conditions & presentations</option><option>Condition</option><option>Presentation</option></select></label>
    </div></details>
    ${groups.length?`<details class="earlier-groups"><summary>Earlier catalogue groups</summary><p class="fine-print">These are preserved topic groupings, not additional teaching blocks. They can be combined with the filters above.</p><label>Earlier group<select id="legacyFilter" aria-label="Filter earlier catalogue group"><option value="">All earlier groups</option>${options(groups)}</select></label></details>`:''}
    <p id="topicCount" role="status"></p><p class="fine-print">Coverage /5 counts domains with at least two eligible questions. Open Evidence to see what still needs practice.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Topic evidence"><table class="curriculum-table"><thead><tr><th>Topic and guide origin</th><th>Competency</th><th>Accuracy</th><th>Coverage</th><th>Next review</th></tr></thead><tbody id="progressRows"></tbody></table></div><section id="unmappedGuideEntries" class="card padded"></section>`;
  const val=id=>panel.querySelector('#'+id)?.value??'';
  function sectionOptions(){
    const block=val('blockFilter'),selected=val('sectionFilter'),ids=new Set(curriculum.blocks.filter(b=>!block||b.topic_block===block).map(b=>b.id));
    const values=unique(curriculum.items.filter(i=>ids.has(i.block_id)).map(i=>i.section).filter(Boolean));
    panel.querySelector('#sectionFilter').innerHTML='<option value="">All guide sections (including retained topics)</option>'+options(values);
    if(values.includes(selected))panel.querySelector('#sectionFilter').value=selected;
  }
  function draw(){
    const filter={block:val('blockFilter'),section:val('sectionFilter'),scope:val('scopeFilter')},query=val('topicSearch').toLowerCase(),system=val('systemFilter'),status=val('ratingFilter'),type=val('typeFilter'),group=val('legacyFilter');
    const filtered=topics.filter(t=>{
      const entries=matchingEntries(t,curriculum,filter),text=[t.label,t.id,...(t.aliases??[]),...entries.map(i=>i.source_label)].join(' ').toLowerCase();
      return text.includes(query)&&(!filter.block||t.blocks.includes(filter.block)||entries.length>0)&&(!(filter.section||filter.scope)||entries.length>0)&&(!system||t.systems.includes(system))&&(!group||t.blocks.includes(group))&&(!type||t.type===type)&&(!status||(status==='Overdue'?t.overdue:t.status===status));
    });
    const refinements=[filter.section,filter.scope,system,status,type].filter(Boolean).length;
    panel.querySelector('#filterCount').textContent=refinements?'· '+refinements+' active':'';
    panel.querySelector('#topicCount').textContent=`${filtered.length} ${filtered.length===1?'topic':'topics'}`;
    panel.querySelector('#progressRows').innerHTML=filtered.map(t=>`<tr><td><strong>${esc(t.label)}</strong><small>${esc(t.type)} · ${esc(t.id)} · ${esc(t.systems.join(', ')||'Body system not assigned')}</small>${topicOriginHtml(t,curriculum,filter)}<details><summary>Evidence</summary><p>${esc(t.reason)}</p>${(t.learning?.stages??[]).map(s=>`<p>${esc(s.label)}: ${s.evidenceCount} fresh questions${s.accuracy===null?'':`, ${s.accuracy.toFixed(0)}% in latest ${s.recentCount}`}</p>`).join('')}${t.learning?.unclassifiedCount?`<p>${t.learning.unclassifiedCount} earlier questions have no stage label.</p>`:''}${t.domains.map((d,i)=>`<p>${esc(DOMAIN_LABELS[t.type][i])}: ${d.count} questions${d.accuracy===null?'':`, ${d.accuracy.toFixed(0)}%`}</p>`).join('')}</details></td><td data-label="Competency"><span class="rag ${t.status.toLowerCase()}">${t.status}</span>${t.overdue?'<small>Review overdue</small>':''}</td><td data-label="Recent accuracy">${t.accuracy===null?'—':t.accuracy.toFixed(0)+'%'}</td><td data-label="Domain coverage">${t.coverage}/5<small>${t.evidenceCount} eligible questions</small></td><td data-label="Next review">${t.nextReview?new Date(t.nextReview).toLocaleDateString('en-GB'):'—'}</td></tr>`).join('')||'<tr><td colspan="5">No topics match these filters.</td></tr>';
    const blockIds=new Set(curriculum.blocks.filter(b=>!filter.block||b.topic_block===filter.block).map(b=>b.id));
    const unmatched=curriculum.items.filter(i=>!i.topic_id&&blockIds.has(i.block_id)&&(!filter.section||i.section===filter.section)&&(!filter.scope||i.priority===filter.scope)&&(!type||i.source_type===type)&&i.source_label.toLowerCase().includes(query));
    const extra=panel.querySelector('#unmappedGuideEntries');extra.hidden=!unmatched.length;
    extra.innerHTML=`<details><summary>${unmatched.length} additional guide entries without a UKMLA topic mapping</summary><p>Preserved learning objectives and entries awaiting reconciliation. No competency credit is assigned. Body-system, earlier-group and competency filters apply only to the mapped topic table above.</p><ul>${unmatched.map(i=>{const b=curriculum.blocks.find(b=>b.id===i.block_id);return `<li><strong>${esc(i.source_label)}</strong><br>${esc(blockLabel(b))} → ${esc(i.section)} · ${esc(scopeLabel(i.priority))}<br>${esc(b.source_name)} · ${esc(i.source_locator)}<br>${i.match_method==='local-objective'?'Supplementary learning objective':'Mapping needs reconciliation'}${i.notes?' · '+esc(i.notes):''}</li>`;}).join('')}</ul></details>`;
  }
  panel.querySelectorAll('input,select').forEach(el=>el.oninput=()=>{if(el.id==='blockFilter')sectionOptions();draw();});sectionOptions();draw();
}
