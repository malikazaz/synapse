// Kept separate from the app module so an older cached app can offer an upgrade.
const DRAFT='synapse:update-draft';
const saved=sessionStorage.getItem(DRAFT);
if(saved){
  try{const draft=JSON.parse(saved);const restore=()=>{const paste=document.getElementById('paste');if(paste){paste.value=draft.paste;sessionStorage.removeItem(DRAFT);return true;}return false;};if(!restore()){const observer=new MutationObserver(()=>{if(restore())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}}catch{sessionStorage.removeItem(DRAFT);}
}
if('serviceWorker' in navigator){
  let requested=false,registration,controlled=!!navigator.serviceWorker.controller;
  const offer=()=>{
    if(document.getElementById('appUpdate'))return;
    const banner=document.createElement('aside');banner.id='appUpdate';banner.className='card padded';banner.setAttribute('role','status');
    const message=document.createElement('p');message.textContent='A Synapse update is ready. Update to load the latest study tools. Saved quizzes and answers stay on this device.';
    const button=document.createElement('button');button.className='btn';button.textContent='Update Synapse';banner.append(message,button);document.querySelector('.workspace-nav')?.before(banner);
    if(!banner.isConnected)document.body.prepend(banner);
    button.onclick=async()=>{
      button.disabled=true;
      try{
        // Save the import draft, including a selected text file, before reloading.
        const paste=document.getElementById('paste'),file=document.getElementById('file')?.files?.[0];
        if(paste)sessionStorage.setItem(DRAFT,JSON.stringify({paste:paste.value|| (file?await file.text():'')}));
        const {connected}=await import('./connected.js');await connected.queue;
        // New clients also drain the study-plan draft queue before accepting an update.
        if(connected.beforeUpdate)await connected.beforeUpdate();
        await connected.persist();
        const url=new URL(location.href);const view=connected.tab;
        if(view==='quiz'&&connected.active&&!paste){url.search='';url.searchParams.set('session',connected.active.id);}
        else if(view){url.search='';url.searchParams.set('view',view);}
        history.replaceState(null,'',url);
        requested=true;
        if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
        else location.reload();
      }catch(error){message.textContent='Update paused: '+error.message+' Your current page is unchanged.';button.disabled=false;}
    };
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requested)location.reload();else if(controlled)offer();controlled=true;});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>{
    registration=r;if(r.waiting)offer();
    r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){if(requested)worker.postMessage({type:'ACTIVATE_UPDATE'});else offer();}});});
    // Check on each opening, even when the browser's periodic update check is not due.
    void r.update().catch(()=>{});
  }).catch(()=>{});
}
