/* Synapse Web Service Worker: cache-first for offline usage */
// Bump this when you redeploy to force fresh caches on phones/iPads.
const CACHE = 'synapse-cache-v4';
const ASSETS = [
  './',
  './index.html?v=4',
  './styles.css?v=4',
  './app.js?v=4',
  './manifest.json?v=4',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE) ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // cache new GET requests
      if (req.method === 'GET' && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
