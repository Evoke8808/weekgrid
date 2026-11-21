// @vitest-environment jsdom
// The sync client end to end against the real API handler with an in-memory database.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { handle, memoryDb } from '../api/_sync.js';

let db;
beforeAll(() => {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
});
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  db = memoryDb();
  globalThis.fetch = async (url, opts = {}) => handle(new Request(new URL(url, 'http://local/'), opts), db);
});

async function device() {
  const store = await import('./lib/store.svelte.js');
  const s = await import('./lib/sync.svelte.js');
  const c = await import('./lib/synccrypto.js');
  store.boot();
  await s.startSync();
  return { ...store, ...s, ...c };
}

describe('sync client', () => {
  it('create → server holds only an encrypted copy; a change is pushed; a remote change is pulled', async () => {
    const d = await device();
    const r = await d.createSync();
    expect(r.error).toBeUndefined();
    expect(d.sync.code).toHaveLength(12);
    const [room] = [...db.rooms.values()];
    expect(room.v).toBe(1);
    expect(room.d).not.toContain('Project'); // sample week titles are not readable on the server

    // local change → save → queued push
    vi.useFakeTimers();
    d.store.data.logs['2026-11-20'] = { marks: { x: 'done' }, note: 'from laptop' };
    d.save();
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
    await vi.waitFor(() => expect([...db.rooms.values()][0].v).toBe(2));

    // another device writes a newer note for that day
    const { id, key } = await d.deriveKeys(d.sync.code);
    const remote = await d.open(db.rooms.get(id).d, key);
    remote.logs['2026-11-20'] = { marks: { x: 'partial' }, note: 'from phone', t: Date.now() + 1000 };
    db.rooms.set(id, { v: 3, d: await d.seal(remote, key) });
    await d.syncNow();
    expect(d.store.data.logs['2026-11-20'].note).toBe('from phone');
    expect(d.sync.status).toBe('ok');
    // saved locally too
    expect(JSON.parse(localStorage.getItem('weekgrid:v1')).logs['2026-11-20'].note).toBe('from phone');
  });

  it('join pulls the timetable; a wrong code is refused; stop leaves data in place', async () => {
    // a "laptop" room with a custom timetable
    const c = await import('./lib/synccrypto.js');
    const code = 'ABCDEFGHJKMN';
    const { id, key } = await c.deriveKeys(code);
    const laptop = { categories: [{ id: 'k', name: 'Kiran stuff', color: '#fff', target: 2 }], schedule: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      logs: { '2026-11-19': { marks: { a: 'done' }, note: 'laptop day', t: 5 } }, workouts: [], cardio: { daily: false, machines: [], plan: {} }, settings: { threshold: 70 }, metaT: 50 };
    db.rooms.set(id, { v: 4, d: await c.seal(laptop, key) });

    const d = await device();
    expect((await d.joinSync('XXXX-XXXX-XXXX')).error).toMatch(/No data/);
    expect(d.sync.code).toBeNull();
    expect((await d.joinSync('abcd efgh jkmn')).error).toBeUndefined();
    expect(d.store.data.categories[0].name).toBe('Kiran stuff');
    expect(d.store.data.logs['2026-11-19'].note).toBe('laptop day');

    await d.leaveSync();
    expect(d.sync.code).toBeNull();
    expect(localStorage.getItem('weekgrid:sync2')).toBeNull();
    expect(d.store.data.categories[0].name).toBe('Kiran stuff');
  });

  it('reports a server without a database and an offline device', async () => {
    const d = await device();
    globalThis.fetch = async (url, opts) => handle(new Request(new URL(url, 'http://local/'), opts), null);
    expect((await d.createSync()).error).toMatch(/not set up/);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    expect((await d.createSync()).error).toMatch(/offline/);
  });
});
