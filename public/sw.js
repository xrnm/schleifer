/* Schleifer service worker — minimal app-shell cache.
   Strategy:
   - Pre-cache the app shell on install.
   - Network-first for navigations (so deploys propagate quickly), with
     offline fallback to the cached index.
   - Cache-first for same-origin static assets.
   Cache name is bumped per release via the placeholder below; if you forget
   to bump it, stale clients still get fresh HTML thanks to network-first. */

const CACHE = 'schleifer-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/logo-32.png',
  '/logo-128.png',
  '/logo-256.png',
  '/logo-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (fonts, GA) hit the network

  // Navigation requests: network-first, fall back to cached index.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((m) => m || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    }),
  );
});
