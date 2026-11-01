/* Only public application assets are cached. Private API/auth responses never are. */
const CACHE = 'synapse-shell-v3';
const ASSETS = ['./','./index.html','./app.js','./connected.js','./workspace.js','./study-ui.js','./curriculum-ui.js','./session-ui.js','./updates.js','./shared/learning.js','./styles.css','./connected.css','./shared/quiz.js','./shared/offline.js','./shared/sources.js','./manifest.json','./icon-192.png','./icon-512.png'];
const scope = new URL(self.registration.scope);
const assetUrls = new Set(ASSETS.map(p=>new URL(p,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('synapse-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==scope.origin)return;
  const path=url.pathname.slice(scope.pathname.length);
  if(/^(api\/|auth\/|oauth\/|\.well-known\/|mcp|authorize)/.test(path))return;
  if(req.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===scope.pathname+'index.html')){
    // HTML and modules must come from the same release. Never mix new navigation
    // with an older cached renderer while a replacement worker is waiting.
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(new URL('./index.html',scope).href);
      // Cloudflare canonicalises /index.html to /. Recreate the cached response
      // because browsers reject a redirected response for a manual navigation.
      return cached?new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):fetch(req);
    }));return;
  }
  if(!assetUrls.has(url.href))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(req))||fetch(req)));
});
