// Shared presentation only: no account requests or study data live here.
const paths={home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',quiz:'M12 5v14M5 12h14',packs:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4ZM20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3Z',progress:'M5 20V10m7 10V4m7 16v-7',study:'M4 5h16v16H4ZM8 3v4m8-4v4M4 11h16',performance:'M4 12h4l3-8 4 16 3-8h2',sources:'M5 3h11l3 3v15H5ZM8 8h7m-7 4h8m-8 4h6',settings:'M4 7h16M4 17h16M8 4v6m8 4v6',more:'M5 12h.01M12 12h.01M19 12h.01'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]??paths.more}"/></svg>`;
const mobile=matchMedia('(max-width: 720px)'),nav=document.querySelector('.workspace-nav');
const more=document.getElementById('moreDialog'),appearance=document.getElementById('appearanceDialog');
let opener=null;
function open(dialog,button){opener=button;dialog.showModal();document.body.classList.add('sheet-open');}
const quizTools=document.getElementById('quizToolsDialog');
for(const dialog of [more,appearance,quizTools]){
  if(!dialog)continue;
  dialog.querySelector('[data-dismiss]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{document.body.classList.remove('sheet-open');opener?.focus({preventScroll:true});});
}
document.getElementById('appearanceBtn')?.addEventListener('click',e=>open(appearance,e.currentTarget));
const moreBtn=document.getElementById('moreBtn');
if(moreBtn){
  document.body.classList.add('connected-shell');
  const buttons=[...nav.querySelectorAll('[data-view]')],secondary=buttons.filter(b=>!['home','quiz','packs','progress'].includes(b.dataset.view));
  const longLabels=new Map(buttons.map(b=>[b,b.textContent]));
  const labels={home:'Home',quiz:'New quiz',packs:'My packs',progress:'Progress'};
  for(const b of buttons){const label=b.textContent;b.setAttribute('aria-label',label);b.innerHTML=icon(b.dataset.view)+`<span class="nav-label-wide">${label}</span><span class="nav-label-short">${labels[b.dataset.view]??label}</span>`;}
  moreBtn.innerHTML=icon('more')+'<span>More</span>';
  moreBtn.addEventListener('click',()=>open(more,moreBtn));
  const account=document.getElementById('accountBtn'),items=document.getElementById('moreItems');
  // Move the existing controls, retaining their handlers and a single focus target.
  function layout(){
    if(more.open)more.close();
    for(const b of buttons)b.setAttribute('aria-label',mobile.matches?(labels[b.dataset.view]??longLabels.get(b)):longLabels.get(b));
    for(const b of [...secondary,account])mobile.matches?items.append(b):nav.insertBefore(b,moreBtn);
  }
  layout();mobile.addEventListener('change',layout);
  items.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('button').disabled)more.close();});
  document.addEventListener('synapse:view',e=>{
    const view=e.detail.view;document.body.dataset.currentView=view;
    moreBtn.setAttribute('aria-pressed',String(secondary.some(b=>b.dataset.view===view)));
    if(!e.detail.quiet){if(more.open)more.close();window.scrollTo({top:0,behavior:'instant'});}
  });
}
// Keep the keyboard from sitting behind the bottom bar on small phones.
if(window.visualViewport){
  const update=()=>document.body.classList.toggle('keyboard-open',mobile.matches&&window.innerHeight-window.visualViewport.height>150);
  window.visualViewport.addEventListener('resize',update);
}

// A bounded study viewport: only the question scrolls, never the page behind it.
const quizApp=document.getElementById('app');
const toolGroups=[document.querySelector('.quiz-actions'),document.querySelector('.connection-strip'),...(!moreBtn?[nav]:[])].filter(Boolean).map(el=>{
  const marker=document.createComment('quiz tools return here');el.before(marker);return {el,marker};
});
function updateQuizFocus(){
  const focused=mobile.matches&&document.body.dataset.quizScreen==='quiz'&&!quizApp.hidden;
  document.body.classList.toggle('quiz-focused',focused);
  for(const {el,marker} of toolGroups){
    const destination=el.classList.contains('connection-strip')?document.getElementById('quizToolsStatus'):document.getElementById('quizToolsActions');
    if(focused&&el.parentElement!==destination)destination.append(el);
    else if(!focused&&el.parentNode!==marker.parentNode)marker.after(el);
  }
  if(!focused&&quizTools.open)quizTools.close();
  updateQuizStatus();
}
function updateQuizStatus(){
  const status=quizApp.querySelector('.quiz-live-status');if(!status)return;
  const error=document.querySelector('#connectionNotice.error');
  const text=error?.textContent||document.getElementById('saveStatus')?.textContent||'Saved on device';
  if(status.textContent!==text)status.textContent=text;
  status.classList.toggle('error',Boolean(error));
}
new MutationObserver(updateQuizFocus).observe(document.body,{attributes:true,attributeFilter:['data-quiz-screen','data-current-view']});
new MutationObserver(updateQuizFocus).observe(quizApp,{attributes:true,attributeFilter:['hidden'],childList:true});
const statusStrip=document.querySelector('.connection-strip');
if(statusStrip)new MutationObserver(updateQuizStatus).observe(statusStrip,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
mobile.addEventListener('change',updateQuizFocus);
document.addEventListener('click',event=>{const trigger=event.target.closest('#quizToolsBtn');if(trigger)open(quizTools,trigger);});
document.getElementById('quizDisplayBtn').addEventListener('click',()=>{quizTools.close();open(appearance,document.getElementById('quizToolsBtn'));});
updateQuizFocus();
