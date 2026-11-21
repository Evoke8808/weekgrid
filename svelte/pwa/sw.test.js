// The service worker run in a fake worker scope: caches, fetch and events are simulated.
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSw, listFiles } from './plugin.js';

const ORIGIN = 'https://weekgrid.example';

function fakeDist() {
  const d = mkdtempSync(join(tmpdir(), 'wg-dist-'));
  mkdirSync(join(d, 'assets')); mkdirSync(join(d, 'icons'));
  writeFileSync(join(d, 'index.html'), '<html>shell</html>');
  writeFileSync(join(d, 'assets/index-abc.js'), 'js');
  writeFileSync(join(d, 'assets/index-abc.css'), 'css');
  writeFileSync(join(d, 'assets/index-abc.js.map'), 'map');
  writeFileSync(join(d, 'icons/icon-192.png'), 'png');
  writeFileSync(join(d, 'manifest.webmanifest'), '{}');
  writeFileSync(join(d, 'my-timetable.js'), 'personal');
  writeFileSync(join(d, '.DS_Store'), 'x');
  return d;
}

// Minimal Cache Storage keyed by URL
function cacheStorage() {
  const stores = new Map();
  const key = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGIN + '/').href.split('?')[0];
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (r) => m.get(key(r))?.clone(),
      put: async (r, res) => { m.set(key(r), res); },
      addAll: async (list) => { for (const r of list) m.set(key(r), new Response(`cached:${key(r)}`)); }
    };
  };
  return { stores, open, keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n),
    match: async (r) => { for (const m of stores.values()) if (m.has(key(r))) return m.get(key(r)).clone(); } };
}

function loadSw(src, { network }) {
  const listeners = {};
  const self = {
    location: new URL(ORIGIN + '/sw.js'),
    addEventListener: (t, fn) => { listeners[t] = fn; },
    skipWaiting: () => { self.skipped = true; },
    clients: { claim: async () => {} }
  };
  const caches = cacheStorage();
  const fetch = async (req) => { const r = await network(new URL(req.url ?? req, ORIGIN + '/')); if (!r) throw new TypeError('offline'); return r; };
  // Inside a worker, relative URLs resolve against the worker's location
  class Req extends Request { constructor(u, o) { super(new URL(u, ORIGIN + '/'), o); } }
  new Function('self', 'caches', 'fetch', 'Request', 'Response', src)(self, caches, fetch, Req, Response);
  const run = async (type, extra) => {
    let p;
    const e = { ...extra, waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; } };
    listeners[type](e);
    return p ? await p : undefined;
  };
  const get = (path, mode = 'no-cors') => {
    const request = { method: 'GET', url: new URL(path, ORIGIN + '/').href, mode };
    return run('fetch', { request });
  };
  return { self, caches, run, get };
}

let dist, sw;
beforeEach(() => { dist = fakeDist(); });

describe('build plugin', () => {
  it('lists built files, skipping maps, dotfiles and the personal timetable', () => {
    expect(listFiles(dist)).toEqual(['assets/index-abc.css', 'assets/index-abc.js', 'icons/icon-192.png', 'index.html', 'manifest.webmanifest']);
  });
  it('writes sw.js with the file list and a version that changes with the build', () => {
    const a = buildSw(dist);
    const src = readFileSync(join(dist, 'sw.js'), 'utf8');
    expect(src).toContain(JSON.stringify(a.files));
    expect(src).not.toContain('__FILES__');
    expect(src).not.toContain('__VERSION__');
    writeFileSync(join(dist, 'assets/index-abc.js'), 'js v2');
    expect(buildSw(dist).version).not.toBe(a.version);
  });
});

describe('service worker', () => {
  let online;
  beforeEach(async () => {
    buildSw(dist);
    online = true;
    sw = loadSw(readFileSync(join(dist, 'sw.js'), 'utf8'), {
      network: async (u) => {
        if (!online) return null;
        if (u.pathname === '/fallback.js') return new Response('<html>', { headers: { 'content-type': 'text/html' } });
        return new Response(`net:${u.pathname}`, { status: u.pathname === '/missing.js' ? 404 : 200 });
      }
    });
    await sw.run('install');
    await sw.run('activate');
  });

  it('precaches the build on install', async () => {
    const name = [...sw.caches.stores.keys()].find((k) => k.startsWith('weekgrid-'));
    expect([...sw.caches.stores.get(name).keys()]).toHaveLength(5);
  });

  it('opens offline from the cached shell', async () => {
    online = false;
    const r = await sw.get('/', 'navigate');
    expect(await r.text()).toBe(`cached:${ORIGIN}/index.html`);
    expect(await (await sw.get('/assets/index-abc.js')).text()).toContain('cached:');
  });

  it('re-checks my-timetable.js online and falls back to the last copy offline', async () => {
    expect(await (await sw.get('/my-timetable.js')).text()).toBe('net:/my-timetable.js');
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    expect(await (await sw.get('/my-timetable.js')).text()).toBe('net:/my-timetable.js');
  });

  it('gives a missing file a 504 offline, never the HTML shell', async () => {
    online = false;
    const r = await sw.get('/nothing.js');
    expect(r.status).toBe(504);
  });

  it('never hands a script the HTML page from a server fallback', async () => {
    const r = await sw.get('/fallback.js');
    expect(r.status).toBe(404);
  });

  it('caches Google Fonts after first use', async () => {
    const font = 'https://fonts.gstatic.com/s/x.woff2';
    expect(await (await sw.get(font)).text()).toBe('net:/s/x.woff2');
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    expect(await (await sw.get(font)).text()).toBe('net:/s/x.woff2');
  });

  it('removes caches from older builds and waits for "skip" before taking over', async () => {
    await sw.caches.open('weekgrid-old');
    await sw.run('activate');
    expect(await sw.caches.keys()).not.toContain('weekgrid-old');
    expect(sw.self.skipped).toBeUndefined();
    await sw.run('message', { data: 'skip' });
    expect(sw.self.skipped).toBe(true);
  });
});
