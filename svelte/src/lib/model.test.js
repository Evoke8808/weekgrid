import { describe, it, expect } from 'vitest';
import { normalize, parseStored, blocksOn, freezePast, applyPreset, setMark, isTracked, emptyState } from './model.js';
import { hours, toMin, dayKeyOf, mondayOf, iso, fromIso } from './dates.js';

const base = () => normalize({
  categories: [{ id: 'dsa', name: 'DSA', color: '#3ecf8e', tracked: true }, { id: 'fixed', name: 'Fixed', tracked: false }],
  schedule: {
    mon: [{ id: 'b', start: '20:00', end: '21:30', title: 'DSA', cat: 'dsa' }, { id: 'a', start: '09:00', end: '16:00', title: 'Classes', cat: 'fixed' }],
    tue: [{ id: 'c', start: '18:00', end: '19:00', title: 'DSA', cat: 'dsa' }]
  },
  logs: {}
});

describe('dates', () => {
  it('handles block lengths, including past midnight', () => {
    expect(hours({ start: '20:00', end: '21:30' })).toBe(1.5);
    expect(hours({ start: '23:00', end: '01:00' })).toBe(2);
    expect(toMin('06:10')).toBe(370);
  });
  it('finds weekday keys and Mondays', () => {
    expect(dayKeyOf('2026-11-16')).toBe('mon');
    expect(dayKeyOf('2026-11-22')).toBe('sun');
    expect(iso(mondayOf(fromIso('2026-11-22')))).toBe('2026-11-16');
  });
});

describe('normalize / parseStored', () => {
  it('drops junk logs and fills missing fields', () => {
    const s = normalize({ logs: { 'not-a-date': {}, '2026-11-16': { marks: 'x' } }, schedule: { mon: [{ start: '1:00' }, null] } });
    expect(Object.keys(s.logs)).toEqual(['2026-11-16']);
    expect(s.logs['2026-11-16']).toMatchObject({ marks: {}, note: '' });
    expect(s.schedule.mon).toHaveLength(1);
    expect(s.schedule.mon[0].id).toBeTruthy();
    expect(s.settings).toEqual({ threshold: 70, rest: 90 });
  });
  it('starts from the sample week when storage is empty or corrupt', () => {
    expect(parseStored(null).categories.length).toBeGreaterThan(0);
    expect(parseStored('{oops').workouts.length).toBe(3);
  });
  it('gives old saves (no workouts/cardio) the sample ones', () => {
    const s = parseStored(JSON.stringify(emptyState()).replace('"workouts":[],', ''));
    expect(s.workouts.length).toBe(3);
  });
});

describe('history', () => {
  it('sorts live blocks and uses tracked flags from categories', () => {
    const s = base();
    expect(blocksOn(s, '2026-11-23', '2026-11-21').map((b) => b.id)).toEqual(['a', 'b']);
    expect(isTracked(s, s.schedule.mon[0])).toBe(true);
    expect(isTracked(s, { cat: 'fixed' })).toBe(false);
  });
  it('freezes past days so editing the timetable never rewrites them', () => {
    const s = base();
    s.logs['2026-11-16'] = { marks: { b: 'done' }, note: '' };
    expect(freezePast(s, '2026-11-18')).toBe(true);
    expect(s.logs['2026-11-17'].blocks.map((b) => b.id)).toEqual(['c']);
    s.schedule.mon = [];
    expect(blocksOn(s, '2026-11-16', '2026-11-18').map((b) => b.id)).toEqual(['a', 'b']);
    expect(freezePast(s, '2026-11-18')).toBe(false);
  });
});

describe('preset and marks', () => {
  it('applies a preset once per version and keeps logs', () => {
    const s = base();
    s.logs['2026-11-16'] = { marks: { b: 'done' }, note: 'x' };
    const p = { version: 2, categories: [{ id: 'gym', name: 'Gym' }], schedule: { wed: [{ id: 'g', start: '18:00', end: '19:00', title: 'Gym', cat: 'gym' }] } };
    expect(applyPreset(s, p)).toBe(true);
    expect(s.schedule.wed[0].id).toBe('g');
    expect(s.logs['2026-11-16'].note).toBe('x');
    expect(applyPreset(s, p)).toBe(false);
  });
  it('toggles a mark off when tapped twice', () => {
    const s = base();
    setMark(s, '2026-11-16', 'b', 'done');
    expect(s.logs['2026-11-16'].marks.b).toBe('done');
    setMark(s, '2026-11-16', 'b', 'done');
    expect(s.logs['2026-11-16'].marks.b).toBeUndefined();
  });
});

describe('timetable editing', async () => {
  const { addBlock, deleteBlock, copyDay, clashOf } = await import('./model.js');
  it('adds an hour after the last block, wrapping past midnight', () => {
    const s = base();
    expect(addBlock(s, 'mon')).toMatchObject({ start: '21:30', end: '22:30', title: '', cat: 'dsa' });
    expect(addBlock(s, 'wed')).toMatchObject({ start: '09:00', end: '10:00' });
    s.schedule.thu = [{ id: 'x', start: '22:00', end: '23:30', cat: 'dsa' }];
    expect(addBlock(s, 'thu')).toMatchObject({ start: '23:30', end: '00:30' });
  });
  it('deletes and copies with fresh ids', () => {
    const s = base();
    copyDay(s, 'mon', 'sun');
    expect(s.schedule.sun.map((b) => b.title)).toEqual(['DSA', 'Classes']);
    expect(s.schedule.sun[0].id).not.toBe('b');
    deleteBlock(s, 'mon', 'a');
    expect(s.schedule.mon.map((b) => b.id)).toEqual(['b']);
  });
  it('flags overlapping blocks but not ones crossing midnight', () => {
    const s = base();
    expect(clashOf(s, 'mon').size).toBe(0);
    s.schedule.mon.push({ id: 'o', start: '15:00', end: '17:00', cat: 'dsa' });
    expect([...clashOf(s, 'mon')].sort()).toEqual(['a', 'o']);
    s.schedule.tue = [{ id: 'n', start: '22:00', end: '01:00' }, { id: 'm', start: '23:30', end: '23:45' }];
    expect(clashOf(s, 'tue').size).toBe(0); // a block crossing midnight is not checked (same as the original)
  });
});

describe('settings', async () => {
  const m = await import('./model.js');
  it('adds categories and knows when one is in use', () => {
    const s = base();
    const c = m.addCategory(s);
    expect(c).toMatchObject({ name: 'New category', target: 0, tracked: true });
    expect(m.categoryUsed(s, 'dsa')).toBe(true);
    expect(m.categoryUsed(s, c.id)).toBe(false);
    m.deleteCategory(s, c.id);
    expect(s.categories.find((x) => x.id === c.id)).toBeUndefined();
  });
  it('loads the sample week without touching logs, and clears everything but the preset version', () => {
    const s = base();
    s.logs['2026-11-16'] = { marks: { b: 'done' }, note: '' };
    s.presetVersion = 4;
    m.loadSample(s);
    expect(s.schedule.mon[0].id).toBe('s1');
    expect(s.logs['2026-11-16'].marks.b).toBe('done');
    const c = m.clearedState(s);
    expect(c.logs).toEqual({});
    expect(c.categories).toEqual([]);
    expect(c.presetVersion).toBe(4);
  });
  it('imports: timetable-only keeps history; history replaced only when asked; old files keep workouts', () => {
    const s = base();
    s.logs['2026-11-16'] = { marks: { b: 'done' }, note: 'mine' };
    s.workouts = [{ id: 'w', name: 'Push', exercises: [] }];
    s.presetVersion = 2;
    const file = { categories: [{ id: 'x', name: 'X' }], schedule: { mon: [{ id: 'z', start: '08:00', end: '09:00', cat: 'x' }] } };
    let n = m.importInto(s, file);
    expect(n.schedule.mon[0].id).toBe('z');
    expect(n.logs['2026-11-16'].note).toBe('mine');
    expect(n.workouts[0].id).toBe('w');
    expect(n.presetVersion).toBe(2);
    const withLogs = { ...file, logs: { '2026-11-10': { marks: {}, note: 'theirs' } } };
    expect(Object.keys(m.importInto(s, withLogs).logs)).toEqual(['2026-11-10']);
    expect(Object.keys(m.importInto(s, withLogs, { replaceHistory: false }).logs)).toEqual(['2026-11-16']);
    expect(() => m.importInto(s, { hello: 1 })).toThrow();
    expect(m.hasHistory(withLogs)).toBe(true);
  });
});
