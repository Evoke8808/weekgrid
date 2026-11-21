import { describe, it, expect } from 'vitest';
import { newCode, cleanCode, showCode, deriveKeys, seal, open, ALPHABET } from './synccrypto.js';
import { merge, payload } from './syncmerge.js';
import { emptyState } from './model.js';

describe('sync codes and encryption', () => {
  it('makes readable 12-character codes and accepts sloppy typing', () => {
    const c = newCode();
    expect(c).toHaveLength(12);
    expect([...c].every((ch) => ALPHABET.includes(ch))).toBe(true);
    expect(cleanCode(showCode(c).toLowerCase().replace(/-/g, ' '))).toBe(c);
    expect(cleanCode('ABCD-EFGH-IJK0')).toBeNull(); // I and 0 are never used
    expect(cleanCode('short')).toBeNull();
  });

  it('derives the same room for the same code, a different one otherwise', async () => {
    const a = await deriveKeys('ABCDEFGHJKMN');
    const b = await deriveKeys('ABCDEFGHJKMN');
    const c = await deriveKeys('ABCDEFGHJKMP');
    expect(a.id).toMatch(/^[0-9a-f]{32}$/);
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it('seals and opens data; the wrong code cannot open it', async () => {
    const { key } = await deriveKeys('ABCDEFGHJKMN');
    const data = { logs: { '2026-11-20': { marks: { a: 'done' }, note: 'gym ✓', t: 5 } } };
    const blob = await seal(data, key);
    expect(blob).not.toContain('gym');
    expect(await open(blob, key)).toEqual(data);
    const wrong = await deriveKeys('ABCDEFGHJKMP');
    await expect(open(blob, wrong.key)).rejects.toThrow();
  });
});

const st = (over = {}) => ({ ...emptyState(), metaT: 10, ...over });
const log = (marks, t, extra = {}) => ({ marks, note: '', t, ...extra });

describe('merging', () => {
  it('takes the newer side, day by day, and reports what moved', () => {
    const local = st({ logs: { mon: log({ a: 'done' }, 5), tue: log({ b: 'done' }, 9), wed: log({}, 3) } });
    const remote = st({ logs: { mon: log({ a: 'missed' }, 7), tue: log({}, 2), thu: log({ c: 'done' }, 4) } });
    // (keys do not need to be real dates for merge; normalize is bypassed by using real ones below)
    const L = { ...local, logs: Object.fromEntries(Object.entries(local.logs).map(([k, v], i) => [`2026-11-1${i}`, v])) };
    const R = { ...remote, logs: { '2026-11-10': remote.logs.mon, '2026-11-11': remote.logs.tue, '2026-11-13': remote.logs.thu } };
    const { state, pull, push } = merge(L, R);
    expect(state.logs['2026-11-10'].marks).toEqual({ a: 'missed' }); // remote newer
    expect(state.logs['2026-11-11'].marks).toEqual({ b: 'done' });   // local newer
    expect(state.logs['2026-11-12']).toBeDefined();                  // only here
    expect(state.logs['2026-11-13'].marks).toEqual({ c: 'done' });   // only there
    expect(pull).toBe(true);
    expect(push).toBe(true);
  });

  it('timetable follows the newer metaT', () => {
    const L = st({ metaT: 20, categories: [{ id: 'x', name: 'Mine' }] });
    const R = st({ metaT: 10, categories: [{ id: 'y', name: 'Old' }] });
    let m = merge(L, R);
    expect(m.state.categories[0].name).toBe('Mine');
    expect(m.push).toBe(true);
    m = merge({ ...L, metaT: 5 }, R);
    expect(m.state.categories[0].name).toBe('Old');
    expect(m.pull).toBe(true);
  });

  it('joining takes the synced timetable and keeps both histories', () => {
    const L = st({ metaT: 99, categories: [{ id: 's', name: 'Sample' }], logs: { '2026-11-20': log({ a: 'done' }, 3, { gym: { bench: [{ kg: 40, reps: 8 }] } }) } });
    const R = st({ metaT: 1, categories: [{ id: 'r', name: 'Real' }], logs: { '2026-11-20': log({ b: 'partial' }, 2, { gym: { squat: [{ kg: 60, reps: 5 }] } }) } });
    const { state, pull, push } = merge(L, R, { first: true });
    expect(state.categories[0].name).toBe('Real');
    expect(state.logs['2026-11-20'].marks).toEqual({ a: 'done', b: 'partial' });
    expect(Object.keys(state.logs['2026-11-20'].gym).sort()).toEqual(['bench', 'squat']);
    expect(pull && push).toBe(true);
  });

  it('identical data needs nothing either way; presetVersion never uploads', () => {
    const a = st({ logs: { '2026-11-20': log({ a: 'done' }, 3) }, presetVersion: 7 });
    const { pull, push } = merge(a, payload(a));
    expect(pull || push).toBe(false);
    expect('presetVersion' in payload(a)).toBe(false);
  });
});
