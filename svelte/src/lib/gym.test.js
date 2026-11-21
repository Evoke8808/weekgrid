import { describe, it, expect } from 'vitest';
import { normalize } from './model.js';
import * as g from './gym.js';

const make = () => normalize({
  categories: [{ id: 'gym', name: 'Gym', tracked: true }],
  schedule: { wed: [{ id: 'gb', start: '18:00', end: '19:00', title: 'Gym: Push', cat: 'gym' }] },
  workouts: [{ id: 'push', name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: '6-8' }, { name: 'Plank', sets: 2, reps: '45 sec' }] }],
  cardio: { daily: true, machines: [{ id: 'cy', name: 'Cycle', mode: 'down' }, { id: 'tr', name: 'Treadmill', mode: 'up' }], plan: { wed: { machine: 'tr', min: 15 } } },
  logs: {}
});
const D = '2026-11-18', T = '2026-11-18';

describe('workout helpers', () => {
  it('parses targets and keys', () => {
    expect(g.parseReps('6-8')).toEqual({ target: 8, unit: 'reps' });
    expect(g.parseReps('45 sec')).toEqual({ target: 45, unit: 's' });
    expect(g.exKey('  Bench   Press ')).toBe('bench press');
    expect(g.mmss(90)).toBe('1:30');
    expect(g.mins(3720)).toBe('1h 2m');
  });
  it('builds the sheet from the block workout plus extras', () => {
    const s = make();
    expect(g.sheetCtx(s, D, 'gb', T).name).toBe('Push');
    g.addExtra(s, D, 'Dips', '4', '12');
    const ctx = g.sheetCtx(s, D, 'gb', T);
    expect(ctx.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Plank', 'Dips']);
    expect(ctx.exercises[2]).toMatchObject({ sets: 4, reps: '12', extra: true });
    expect(g.sheetCtx(s, D, 'free', T).exercises).toHaveLength(1);
    expect(g.sheetCtx(s, D, 'nope', T)).toBeNull();
    g.removeExtra(s, D, 'dips');
    expect(g.sheetCtx(s, D, 'free', T).exercises).toHaveLength(0);
    expect(g.knownExercises(s)).toEqual(['Bench Press', 'Plank']);
  });
  it('logs sets, times them, counts progress and handles extra sets', () => {
    const s = make();
    g.gymWrite(s, D, 'bench press', 0, 'kg', '40', { sesKey: 'gb', now: 1000 });
    expect(s.logs[D].sessions).toBeUndefined(); // weight alone does not start the clock
    g.gymWrite(s, D, 'bench press', 0, 'reps', '8', { sesKey: 'gb', now: 5000 });
    expect(s.logs[D].sessions.gb.start).toBe(5000);
    expect(s.logs[D].gym['bench press'][0]).toEqual({ kg: '40', reps: '8', at: 5000 });
    g.gymWrite(s, D, 'bench press', 3, 'reps', '', { sesKey: 'gb' }); // + add a set
    const ctx = g.sheetCtx(s, D, 'gb', T);
    expect(g.exStatus(s, D, ctx.exercises[0])).toEqual({ done: 1, total: 4 });
    expect(g.progress(s, D, ctx)).toEqual({ done: 1, total: 5 });
    g.deleteSet(s, D, 'bench press', 3);
    expect(g.setsFor(s, D, 'bench press', 3)).toHaveLength(3);
    g.gymWrite(s, D, 'bench press', 0, 'reps', '', { sesKey: 'gb' });
    expect(s.logs[D].gym['bench press'][0].at).toBeUndefined();
  });
  it('suggests weight from the last session', () => {
    const s = make();
    const ex = { name: 'Bench Press', sets: 3, reps: '6-8' };
    s.logs['2026-11-11'] = { marks: {}, note: '', gym: { 'bench press': [{ kg: '40', reps: '8' }, { kg: '40', reps: '8' }, { kg: '40', reps: '8' }] } };
    const last = g.lastSession(s, 'bench press', D);
    expect(last.date).toBe('2026-11-11');
    expect(g.suggestion(ex, last)).toBe('Try 42.5 kg');
    s.logs['2026-11-11'].gym['bench press'][2].reps = '6';
    expect(g.suggestion(ex, g.lastSession(s, 'bench press', D))).toBe('Stay at 40 kg until you hit 8 on every set');
    expect(g.suggestion({ name: 'Plank', sets: 2, reps: '45 sec' }, { sets: [{ reps: '45' }, { reps: '50' }] })).toBe('Hold 50 s this time');
    expect(g.lastSession(s, 'bench press', '2026-11-11')).toBeNull();
  });
  it('works out pace against the block length', () => {
    const s = make();
    const ctx = g.sheetCtx(s, D, 'gb', T);
    const t0 = 1_000_000;
    g.startSession(s, D, 'gb', t0);
    g.gymWrite(s, D, 'bench press', 0, 'reps', '8', { sesKey: 'gb', now: t0 + 120_000 });
    g.gymWrite(s, D, 'bench press', 1, 'reps', '8', { sesKey: 'gb', now: t0 + 240_000 }); // 2 min gap: fine at 90 s rest + 60 s slack
    g.gymWrite(s, D, 'bench press', 2, 'reps', '8', { sesKey: 'gb', now: t0 + 600_000 }); // 6 min gap: slow
    const p = g.paceInfo(s, D, ctx, 'gb', t0 + 600_000);
    expect(p).toMatchObject({ allotted: 3600, elapsed: 600, done: 3, left: 2, avg: 200, projected: 1000, slowN: 1, wasted: 270 });
    expect(g.paceStatus(p)).toEqual({ cls: 'ok', text: 'On pace, about 43:20 to spare' });
    expect(g.paceStatus({ ...p, elapsed: 3700 }).text).toBe('1:40 over your slot');
  });
});

describe('cardio', () => {
  it('starts from the day plan and saves with a status', () => {
    const s = make();
    const c = g.newCardio(s, D);
    expect(c).toMatchObject({ machine: 'tr', goal: 900, running: false });
    expect(g.newCardio(s, '2026-11-19')).toMatchObject({ machine: 'cy', goal: 600 });
    expect(g.saveCardioLog(s, c, 900)).toMatchObject({ name: 'Treadmill', status: 'done', secs: 900 });
    expect(g.cardioStatus(500, 900)).toBe('partial');
    expect(g.cardioStatus(100, 900)).toBe('missed');
    expect(g.newCardio(s, D).machine).toBe('tr');
  });
  it('edits machines and the weekly plan', () => {
    const s = make();
    g.addMachine(s);
    expect(s.cardio.machines).toHaveLength(3);
    g.setPlanMachine(s, 'mon', 'cy');
    g.setPlanMinutes(s, 'mon', 500);
    expect(s.cardio.plan.mon).toEqual({ machine: 'cy', min: 180 });
    g.deleteMachine(s, 0);
    expect(s.cardio.plan.mon).toBeUndefined();
    expect(s.cardio.plan.wed.machine).toBe('tr');
    g.setPlanMachine(s, 'wed', '');
    expect(s.cardio.plan.wed).toBeUndefined();
  });
});
