/* Only public application assets are cached. Private API/auth responses never are. */
const CACHE = 'synapse-shell-v3';
const ASSETS = ['./','./index.html','./app.js','./connected.js','./workspace.js','./study-ui.js','./shared/learning.js','./styles.css','./connected.css','./shared/quiz.js','./shared/offline.js','./shared/sources.js','./manifest.json','./icon-192.png','./icon-512.png'];
const scope = new URL(self.registration.scope);
const assetUrls = new Set(ASSETS.map(p=>new URL(p,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('synapse-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==scope.origin)return;
  const path=url.pathname.slice(scope.pathname.length);
  if(/^(api\/|auth\/|oauth\/|\.well-known\/|mcp|authorize)/.test(path))return;
  if(req.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===scope.pathname+'index.html')){
    event.respondWith(fetch(req).catch(()=>caches.match(new URL('./index.html',scope).href)));return;
  }
  if(!assetUrls.has(url.href))return;
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
