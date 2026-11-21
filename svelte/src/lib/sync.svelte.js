// Sync across devices with a pairing code.
// One device creates a code; others join with it. Data is encrypted on the device with a key made
// from the code, stored on the server under a hash of the code, and merged day by day.
import { store, ui, adopt, onSave, say } from './store.svelte.js';
import { newCode, cleanCode, deriveKeys, seal, open } from './synccrypto.js';
import { merge, payload, stampAll } from './syncmerge.js';
import { clone } from './model.js';

const KEY = 'weekgrid:sync2'; // the old app's GitHub sync used weekgrid:sync
const API = './api/sync';

export const sync = $state({
  code: null,   // the pairing code while connected
  status: 'off', // off | syncing | ok | offline | error
  text: '',
  last: 0       // time of the last successful sync
});

let keys = null; // { id, key } derived from the code
let version = 0; // server version this device last saw
let busy = false, again = false, timer = null;

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ code: sync.code, version })); } catch (e) {} };
const set = (status, text = '') => { sync.status = status; sync.text = text; };

class SyncError extends Error {}

async function api(method, body) {
  let r;
  try {
    r = await fetch(`${API}?id=${keys.id}`, {
      method, cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) { throw new TypeError('offline'); }
  const data = await r.json().catch(() => ({}));
  if (r.ok || r.status === 404 || r.status === 409) return { status: r.status, ...data };
  throw new SyncError(r.status === 503 ? 'The sync server is not set up yet' : data.error || `Server error ${r.status}`);
}

async function push(base) {
  const res = await api('PUT', { base, d: await seal(payload(store.data), keys.key) });
  if (res.status === 409) return false;
  version = res.v;
  return true;
}

// Never swap data under an open workout or while typing; try again shortly.
const blocked = () => ui.gym || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');

export async function syncNow({ first = false, quiet = true } = {}) {
  if (!keys) return;
  if (busy) { again = true; return; }
  if (!first && blocked()) { queue(8000); return; }
  busy = true;
  set('syncing', 'Syncing…');
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await api('GET');
      stampAll(store.data);
      let needPush = true;
      if (remote.status !== 404) {
        let data;
        try { data = await open(remote.d, keys.key); }
        catch (e) { throw new SyncError('Could not unlock the synced data. Check the code.'); }
        const res = merge(store.data, data, { first });
        if (res.pull) {
          adopt(res.state);
          if (!quiet || !first) say('Updated from your other device');
        }
        needPush = res.push;
        version = remote.v;
      } else if (!first && version > 0) {
        // The room vanished (expired or cleared): upload again from this device
        version = 0;
      }
      if (!needPush || (await push(version))) break;
      first = false; // someone wrote in between: pull their change and merge again
    }
    first = false;
    sync.last = Date.now();
    set('ok', '');
    persist();
  } catch (e) {
    if (e instanceof TypeError) set('offline', 'Offline. Changes will sync when you are back online.');
    else set('error', e.message);
  } finally {
    busy = false;
    if (again) { again = false; queue(500); }
  }
}

export function queue(ms = 2500) {
  if (!keys) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}

async function connect(code) {
  sync.code = code;
  keys = await deriveKeys(code);
}

export async function createSync() {
  const code = newCode();
  set('syncing', 'Setting up…');
  await connect(code);
  version = 0;
  persist();
  await syncNow();
  if (sync.status !== 'ok') {
    const error = sync.status === 'offline' ? 'You are offline' : sync.text;
    await leaveSync();
    return { error };
  }
  say('Sync is on. Enter the code on your other device');
  return {};
}

export async function joinSync(input) {
  const code = cleanCode(input);
  if (!code) return { error: 'That is not a sync code (12 letters and numbers)' };
  set('syncing', 'Joining…');
  await connect(code);
  const remote = await api('GET').catch((e) => ({ error: e instanceof TypeError ? 'You are offline' : e.message }));
  if (remote.error || remote.status === 404) {
    keys = null; sync.code = null; set('off');
    return { error: remote.error || 'No data for this code. Check it, or create a new code on the other device.' };
  }
  version = 0;
  persist();
  await syncNow({ first: true, quiet: true });
  if (sync.status === 'error') { const msg = sync.text; await leaveSync(); return { error: msg }; }
  say('Joined. This device now syncs');
  return {};
}

// Stops syncing on this device only. The other devices and the synced copy are untouched.
export async function leaveSync() {
  clearTimeout(timer);
  keys = null; version = 0;
  sync.code = null; sync.last = 0;
  set('off');
  try { localStorage.removeItem(KEY); } catch (e) {}
}

let started = false;
export async function startSync() {
  if (started) return;
  started = true;
  onSave(() => queue());
  addEventListener('online', () => queue(300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(300); });
  setInterval(() => { if (!document.hidden) queue(0); }, 2 * 60 * 1000);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (saved?.code && cleanCode(saved.code)) {
    await connect(saved.code);
    version = Number(saved.version) || 0;
    set('ok', '');
    syncNow();
  }
}

export const _test = { reset() { keys = null; version = 0; busy = false; again = false; started = false; clearTimeout(timer); Object.assign(sync, { code: null, status: 'off', text: '', last: 0 }); }, snapshot: () => clone(store.data) };
