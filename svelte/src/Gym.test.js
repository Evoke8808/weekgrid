// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mount, flushSync, unmount } from 'svelte';

beforeAll(() => {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  HTMLCanvasElement.prototype.getContext = () => null;
  window.confirm = () => true;
  globalThis.CSS = globalThis.CSS || {};
  CSS.escape = CSS.escape || ((v) => String(v).replace(/"/g, '\\"'));
});

const settle = async (ms) => { await vi.advanceTimersByTimeAsync(ms); flushSync(); };
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const type = (el, v, ev = 'input') => { el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); flushSync(); };
const btn = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));

describe('gym and cardio', () => {
  it('logs a workout with rest, extra set, extra exercise, cardio, then packs and marks done', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 16, 18, 30) }); // Monday 16 Nov, 18:30
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    const { boot, ui, store } = await import('./lib/store.svelte.js');
    const App = (await import('./App.svelte')).default;
    boot();
    const app = mount(App, { target: document.getElementById('app') });
    flushSync();
    await settle(4300); // intro

    // Monday has "Gym: Push" in the sample week
    const opener = q('.block-main');
    expect(opener.textContent).toContain('5 exercises');
    opener.click(); flushSync();
    expect(q('#sheet').classList.contains('open')).toBe(true);
    expect(q('.sheet-title').textContent).toBe('Push');
    expect(q('.sheet-prog').textContent).toContain('0 of 16 sets logged');
    expect(q('.pace.idle')).not.toBeNull();

    // Bench press: 4 x 6-8
    q('.ex-head').click(); flushSync();
    const bench = () => q('.ex[data-ex="bench press"]');
    expect(bench().classList.contains('open')).toBe(true);
    expect(bench().querySelector('.last').textContent).toBe('First time logging this one.');
    const setIn = (j, which) => bench().querySelectorAll('.set')[j].querySelectorAll('input')[which === 'kg' ? 0 : 1];

    type(setIn(0, 'kg'), '40');
    type(setIn(0, 'reps'), '8');
    type(setIn(0, 'reps'), '8', 'change');
    const day = '2026-11-16';
    const logged = () => store.data.logs[day].gym['bench press'];
    expect(logged()[0]).toMatchObject({ kg: '40', reps: '8' });
    expect(logged()[0].at).toBeTruthy();
    expect(store.data.logs[day].sessions.s2.start).toBeTruthy(); // the block id of Gym: Push
    expect(bench().querySelectorAll('.set')[0].classList.contains('hit')).toBe(true);

    // the rest timer started by itself
    expect(q('.rest').classList.contains('on')).toBe(true);
    await settle(1000);
    expect(q('#rest-time').textContent).toBe('1:29');

    // set 2: weight box suggests 40; typing reps alone fills it in
    expect(setIn(1, 'kg').placeholder).toBe('40');
    type(setIn(1, 'reps'), '7');
    expect(logged()[1]).toMatchObject({ kg: '40', reps: '7' });
    expect(q('.sheet-prog').textContent).toContain('2 of 16');
    expect(bench().querySelector('.ex-count').textContent).toBe('2/4');

    await settle(91000);
    expect(q('.rest').classList.contains('rang')).toBe(true);
    expect(q('#rest-time').textContent).toBe('Go');
    await settle(2700);
    expect(q('#rest-time').textContent).toBe('1:30');
    expect(q('.pace:not(.idle)')).not.toBeNull();

    // rest length chip
    btn('2:00', q('.rest')).click(); flushSync();
    expect(store.data.settings.rest).toBe(120);
    expect(q('#rest-time').textContent).toBe('2:00');

    // + add a set, then remove it
    btn('+ Add a set', bench()).click(); flushSync();
    expect(bench().querySelectorAll('.set')).toHaveLength(5);
    expect(bench().querySelectorAll('.set')[4].querySelector('.set-n').textContent).toContain('+5');
    bench().querySelector('.set-x').click(); flushSync();
    expect(bench().querySelectorAll('.set')).toHaveLength(4);

    // extra exercise for today only
    type(q('#new-ex'), 'Dips');
    btn('Add', q('.add-ex-row')).click(); flushSync();
    expect(q('.ex[data-ex="dips"]').classList.contains('open')).toBe(true);
    expect(q('.sheet-prog').textContent).toContain('of 19');
    btn('Add', q('.add-ex-row')).click(); flushSync();
    expect(q('.toast').textContent).toBe('Type the exercise name first');

    // cardio from inside the workout: Cycle counts down and saves itself
    btn('Cardio', q('.sheet-card')).click(); flushSync();
    expect(ui.gym).toBe('cardio');
    expect(q('.sheet-title').textContent).toBe('Cardio');
    btn('Cycle', q('.machs')).click(); flushSync();
    expect(q('.c-clock .muted').textContent).toBe('Counting down from 10:00');
    btn('Start', q('.c-actions')).click(); flushSync();
    await settle(5250); // the display updates every 250 ms
    expect(q('#c-time').textContent).toBe('9:55');
    btn('Pause', q('.c-actions')).click(); flushSync();
    await settle(5000);
    expect(q('#c-time').textContent).toBe('9:55');
    btn('Resume', q('.c-actions')).click(); flushSync();
    await settle(600000);
    expect(store.data.logs[day].cardio).toMatchObject({ name: 'Cycle', status: 'done', secs: 600 });
    expect(q('.toast').textContent).toBe('Cardio done: Cycle 10:00');
    expect(ui.gym).toBe('s2'); // back to the workout
    expect(q('.sheet-card .extra-card').textContent).toContain('Cycle, 10:00 done');

    // mark gym done: the checklist comes first
    btn('Mark gym done').click(); flushSync();
    const pack = q('.pack');
    expect(pack).not.toBeNull();
    expect(btn('7 still to pack', pack).disabled).toBe(true);
    qa('.pack input').forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    flushSync();
    btn('All packed', pack).click(); flushSync();
    await settle(700);
    expect(ui.gym).toBe(null);
    expect(q('#sheet').classList.contains('open')).toBe(false);
    expect(store.data.logs[day].marks.s2).toBe('done');
    expect(q('[data-bid="s2"]').className).toContain('st-done');

    // Extra workout card shows today's extras; Escape closes the sheet
    expect(q('.extra-card').textContent).toContain('1 exercise added');
    q('.extra-card').click(); flushSync();
    expect(q('.sheet-title').textContent).toBe('Extra workout');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(400);
    expect(ui.gym).toBe(null);

    // a week later: last session and a suggested weight
    vi.setSystemTime(new Date(2026, 10, 23, 18, 30));
    ui.date = '2026-11-23'; flushSync();
    q('.block-main').click(); flushSync();
    q('.ex-head').click(); flushSync();
    expect(bench().querySelector('.last').textContent).toMatch(/^Last time, (16 Nov|Nov 16): 40 kg × 8, 40 kg × 7$/);
    expect(bench().querySelector('.tip').textContent).toBe('Stay at 40 kg until you hit 8 on every set');
    expect(setIn(0, 'kg').placeholder).toBe('40');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(400);

    // Settings editors
    q('.tab[data-view="settings"]').click(); await settle(800);
    const machines = () => qa('.k-mach').length;
    expect(machines()).toBe(3);
    btn('+ Add machine').click(); flushSync();
    expect(machines()).toBe(4);
    qa('.k-mach').at(-1).querySelector('.btn.danger').click(); flushSync();
    expect(machines()).toBe(3);
    const mon = qa('.k-plan')[0].querySelector('select');
    type(mon, 'cycle', 'change');
    expect(store.data.cardio.plan.mon).toEqual({ machine: 'cycle', min: 10 });
    const daily = q('label.row.small > input[type="checkbox"]');
    daily.checked = true; daily.dispatchEvent(new Event('change', { bubbles: true })); flushSync();
    expect(store.data.cardio.daily).toBe(true);
    type(q('#pack-list'), 'Bottle\nTowel\n\n');
    expect(store.data.settings.pack).toEqual(['Bottle', 'Towel']);
    expect(qa('.panel.wo')).toHaveLength(3);
    btn('+ Add workout').click(); flushSync();
    expect(qa('.panel.wo')).toHaveLength(4);
    btn('+ Add exercise', qa('.panel.wo').at(-1)).click(); flushSync();
    type(qa('.panel.wo').at(-1).querySelector('.wo-ex input'), 'Deadlift');
    expect(store.data.workouts.at(-1).exercises[0]).toEqual({ name: 'Deadlift', sets: 3, reps: '10' });
    unmount(app);
    vi.useRealTimers();
  });
});
