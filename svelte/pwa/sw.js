// WeekGrid service worker. Built into dist/sw.js by pwa/plugin.js, which fills in
// VERSION (a hash of the build) and FILES (every file in the build).
//
// - The app shell and its hashed files are cached on install, so the app opens offline.
// - A new build installs in the background and waits; the page decides when to switch
//   (see src/lib/pwa.svelte.js), so an update never reloads you in the middle of a set.
// - Google Fonts are cached after first use; my-timetable.js is always re-checked.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `weekgrid-${VERSION}`;
const FONTS = 'weekgrid-fonts';
const SHELL = 'index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([CACHE, FONTS]);
    for (const k of await caches.keys()) if (k.startsWith('weekgrid-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
  else if (e.data === 'version') e.source?.postMessage({ version: VERSION });
});

const isFont = (u) => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';

async function fromCache(req) {
  const c = await caches.open(CACHE);
  return c.match(req, { ignoreSearch: true });
}

// Fonts: answer from cache at once, refresh in the background.
async function font(req) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  const fresh = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await fresh) || new Response('', { status: 504, statusText: 'Offline' });
}

// Network first, cached copy when offline (my-timetable.js and anything not in the build).
async function networkFirst(req) {
  try {
    const r = await fetch(req, { cache: 'no-cache' });
    // Some servers answer a missing file with the HTML page; a script must not get HTML.
    if (r.ok && req.mode !== 'navigate' && /html/.test(r.headers.get('content-type') || '')) {
      return new Response('', { status: 404, statusText: 'Not found' });
    }
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  } catch (err) {
    return (await fromCache(req)) || new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isFont(url)) return e.respondWith(font(req));
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // sync calls always go to the network, never the cache

  // Opening the app: the cached shell, so it starts instantly and works offline.
  if (req.mode === 'navigate') {
    return e.respondWith(fromCache(SHELL).then((hit) => hit || networkFirst(req)));
  }
  if (url.pathname.endsWith('/my-timetable.js')) return e.respondWith(networkFirst(req));
  // Built files never change under the same name: cache first.
  e.respondWith(fromCache(req).then((hit) => hit || networkFirst(req)));
});
