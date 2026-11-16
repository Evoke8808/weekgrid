// Offline support: app files are cached; network is used first so updates arrive when online.
const CACHE = 'weekgrid-v6';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const own = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    // Own files are always re-checked with the server, so updates arrive on the next open
    fetch(e.request, own ? { cache: 'no-cache' } : undefined).then((r) => {
      if (r.ok && own) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(async () => {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      // Only a page load falls back to the app shell; a missing script or image must not receive HTML
      if (e.request.mode === 'navigate') return caches.match('index.html');
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});
