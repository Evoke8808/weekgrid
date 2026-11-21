import { describe, it, expect } from 'vitest';
import { normalize } from './model.js';
import { dayStats, streak, weekStats } from './stats.js';

// Mon 16 Nov 2026 .. Sun 22 Nov. Two tracked blocks a day, plus untracked classes on Monday.
const block = (id, start, end, cat = 'dsa') => ({ id, start, end, title: id, cat });
const make = () => normalize({
  categories: [{ id: 'dsa', name: 'DSA', tracked: true }, { id: 'fixed', name: 'Fixed', tracked: false }],
  schedule: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, [block(`${k}1`, '10:00', '11:00'), block(`${k}2`, '20:00', '22:00'), ...(k === 'mon' ? [block('cls', '09:00', '16:00', 'fixed')] : [])]])),
  logs: {}
});
const at = (today, now = 23 * 60) => ({ today, now });

describe('dayStats', () => {
  it('scores done=1, partial=0.5 and ignores untracked blocks', () => {
    const s = make();
    s.logs['2026-11-16'] = { marks: { mon1: 'done', mon2: 'partial', cls: 'done' }, note: '' };
    const st = dayStats(s, '2026-11-16', at('2026-11-20'));
    expect(st).toMatchObject({ pct: 75, count: 2, marked: 2 });
    expect(st.byCat.dsa).toEqual({ planned: 3, done: 2 });
  });
  it('does not hold unfinished blocks against today', () => {
    const s = make();
    s.logs['2026-11-18'] = { marks: { wed1: 'done' }, note: '' };
    const st = dayStats(s, '2026-11-18', at('2026-11-18', 12 * 60));
    expect(st.pct).toBe(50);
    expect(st.soFar).toBe(100);
  });
  it('counts required cardio as an extra item', () => {
    const s = make();
    s.cardio = { daily: true, machines: [{ id: 'c', name: 'Cycle', mode: 'down' }], plan: {} };
    s.logs['2026-11-20'] = { marks: { fri1: 'done', fri2: 'done' }, note: '', cardio: { status: 'partial' } };
    expect(dayStats(s, '2026-11-20', at('2026-11-20')).pct).toBe(83);
  });
});

describe('streak and week', () => {
  it('counts consecutive days over the threshold, today only once it qualifies', () => {
    const s = make();
    const full = (a, b) => ({ marks: { [a]: 'done', [b]: 'done' }, note: '' });
    s.logs['2026-11-16'] = full('mon1', 'mon2');
    s.logs['2026-11-17'] = full('tue1', 'tue2');
    s.logs['2026-11-18'] = { marks: { wed1: 'done' }, note: '' }; // 50%: breaks it
    s.logs['2026-11-19'] = full('thu1', 'thu2');
    s.logs['2026-11-20'] = full('fri1', 'fri2');
    expect(streak(s, at('2026-11-21', 9 * 60))).toBe(2); // Saturday not yet earned
    s.logs['2026-11-21'] = full('sat1', 'sat2');
    expect(streak(s, at('2026-11-21', 23 * 60))).toBe(3);
  });
  it('averages only days since logging began, up to today', () => {
    const s = make();
    s.logs['2026-11-18'] = { marks: { wed1: 'done', wed2: 'done' }, note: '' };
    s.logs['2026-11-19'] = { marks: { thu1: 'done' }, note: '' };
    const ws = weekStats(s, '2026-11-16', at('2026-11-19'));
    expect(ws.avg).toBe(75);
    expect(ws.best.dIso).toBe('2026-11-18');
    expect(ws.byCat.dsa.planned).toBe(21);
  });
});

describe('catch-up nudge data', () => {
  it('yesterday counts once logging started before it', async () => {
    const { counts } = await import('./stats.js');
    const s = make();
    s.logs['2026-11-17'] = { marks: {}, note: '' };
    expect(counts(s, '2026-11-17', at('2026-11-18'))).toBe(true);
    expect(counts(s, '2026-11-16', at('2026-11-18'))).toBe(false);
    expect(dayStats(s, '2026-11-17', at('2026-11-18'))).toMatchObject({ count: 2, marked: 0 });
  });
});
