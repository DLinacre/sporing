/* Sporing service worker — offline app shell + offline street tiles */
const CACHE = 'sporing-v3';
const TILES = 'sporing-tiles-v1';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'data.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* OpenStreetMap street tiles: cache-first, bounded */
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(
      caches.open(TILES).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) {
          c.put(req, res.clone());
          const keys = await c.keys();
          if (keys.length > 160) {
            await Promise.all(keys.slice(0, keys.length - 160).map(k => c.delete(k)));
          }
        }
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
