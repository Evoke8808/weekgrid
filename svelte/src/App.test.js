// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mount, flushSync, unmount } from 'svelte';

beforeAll(() => {
  // jsdom has no matchMedia or canvas; real browsers do
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  HTMLCanvasElement.prototype.getContext = () => null;
});

const settle = async (ms) => { await vi.advanceTimersByTimeAsync(ms); flushSync(); };

describe('app', () => {
  it('intro → Today: mark, step days, note → wipe to Week', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 18, 22, 30) }); // Wednesday 18 Nov, 22:30
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    const { boot, ui, store } = await import('./lib/store.svelte.js');
    const App = (await import('./App.svelte')).default;
    boot();
    const app = mount(App, { target: document.getElementById('app') });
    flushSync();

    expect(document.querySelectorAll('.tab')).toHaveLength(4);
    expect(document.querySelector('#wipe').className).toBe('wipe-hold');
    await settle(3300 + 950);
    expect(document.querySelector('#intro')).toBeNull();

    // Today = Wednesday of the sample week: 3 tracked blocks + classes
    const q = (s) => document.querySelector(s);
    expect(q('.dow').textContent).toBe('Wednesday');
    expect(q('.pill')).not.toBeNull();
    expect(document.querySelectorAll('.block.fixed')).toHaveLength(1);
    expect(document.querySelectorAll('.seg')).toHaveLength(3);
    expect(q('.hero-msg').textContent).toBe('Fresh page');

    // mark the first tracked block done, then tap again to clear it
    const done = () => q('.block:not(.fixed) .mark[data-status="done"]');
    done().click(); flushSync();
    expect(done().classList.contains('on')).toBe(true);
    expect(q('.block:not(.fixed)').className).toContain('st-done');
    expect(q('.seg').className).toContain('s-done');
    await settle(700);
    expect(q('#pct-num').textContent).toBe('33');
    expect(JSON.parse(localStorage.getItem('weekgrid:v1')).logs['2026-11-18'].marks.s9).toBe('done');
    done().click(); flushSync();
    expect(store.data.logs['2026-11-18'].marks.s9).toBeUndefined();

    // all three done -> clean sweep
    document.querySelectorAll('.block:not(.fixed) .mark[data-status="done"]').forEach((b) => b.click());
    flushSync(); await settle(700);
    expect(q('.hero-msg').textContent).toBe('Clean sweep');
    expect(q('#pct-num').textContent).toBe('100');

    // note is saved per day
    const ta = q('#day-note');
    ta.value = 'Slept late'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.data.logs['2026-11-18'].note).toBe('Slept late');

    // next day with the arrow key, then back to today
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settle(200);
    expect(ui.date).toBe('2026-11-19');
    expect(q('.dow').textContent).toBe('Thursday');
    expect(q('#day-note').value).toBe('');
    await settle(700);
    q('.jump').click(); await settle(900);
    expect(ui.date).toBe('2026-11-18');

    // yesterday was never marked, but logging only began today, so no nudge
    expect(q('.nudge')).toBeNull();

    q('.tab[data-view="week"]').click(); flushSync();
    expect(ui.busy).toBe(true);
    expect(q('section.view').classList.contains('fade-out')).toBe(true);
    await settle(250);
    expect(q('section.view').classList.contains('fade-in')).toBe(true);
    expect(q('section.view').id).toBe('view-week');
    await settle(400);
    expect(ui.view).toBe('week');
    expect(document.querySelectorAll('#view-week .bar-col')).toHaveLength(7);
    await settle(900);
    expect(ui.busy).toBe(false);

    // Week: Mon 16 – Sun 22 Nov. Only Wednesday logged (100%), so it is the best day.
    await settle(700);
    expect(q('h2').textContent).toMatch(/16.*22/);
    expect(q('#avg-num').textContent).toBe('100');
    expect(document.querySelectorAll('.fig .num')[2].textContent).toBe('Wed');
    expect(document.querySelectorAll('.bar-col')).toHaveLength(7);
    expect(document.querySelectorAll('.bar-col .pc')[2].textContent).toBe('100%');
    expect(document.querySelectorAll('.bar-col .pc')[0].textContent).toBe(''); // before logging began
    expect(document.querySelectorAll('.heat .cell')).toHaveLength(56);
    expect(document.querySelectorAll('.heat .cell:not(.none)')).toHaveLength(1);
    expect(q('.note-line').textContent).toContain('Slept late');
    expect(document.querySelectorAll('.cat-row').length).toBe(5); // sample: 5 tracked categories

    // previous week with the arrow key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settle(800);
    expect(ui.week).toBe('2026-11-09');
    expect(q('#avg-num').textContent).toBe('0');
    q('.nav-btn[aria-label="Next week"]').click(); await settle(800);
    expect(ui.week).toBe('2026-11-16');

    // a bar opens that day on Today
    document.querySelectorAll('.bar-col')[4].click(); await settle(2600);
    expect(ui.view).toBe('today');
    expect(ui.date).toBe('2026-11-20');

    // Mono theme: colours switch, saved per device
    expect(document.documentElement.dataset.theme).toBe('color');
    q('.theme-btn').click(); flushSync();
    expect(document.documentElement.dataset.theme).toBe('mono');
    expect(localStorage.getItem('weekgrid:theme')).toBe('mono');
    expect(q('.tab-ink').style.getPropertyValue('--ink')).toBe('#e5484d');
    expect(q('.hero').style.getPropertyValue('--day')).toBe('#f0f0f0'); // Friday
    expect(q('.block:not(.fixed)').style.getPropertyValue('--c')).toMatch(/^rgb\((\d+), \1, \1\)$/); // grey
    q('.theme-btn').click(); flushSync();
    expect(document.documentElement.dataset.theme).toBe('color');

    // Timetable: opens on today's weekday (Wednesday), edit, add, clash, delete, copy
    q('.tab[data-view="timetable"]').click(); await settle(2600);
    expect(q('.day-tabs .btn.active').textContent).toBe('Wed');
    const rowsN = () => document.querySelectorAll('.edit-row').length;
    expect(rowsN()).toBe(4);
    expect(q('#view-timetable .row.space .muted').textContent).toBe('3.5h tracked');

    const title = q('.edit-row .title-in');
    title.value = 'Lectures'; title.dispatchEvent(new Event('input', { bubbles: true })); flushSync();
    expect(store.data.schedule.wed.find((b) => b.id === 's8').title).toBe('Lectures');

    q('.btn.primary').click(); flushSync();
    expect(rowsN()).toBe(5);
    const last = [...document.querySelectorAll('.edit-row')].at(-1);
    expect(last.querySelector('input[type="time"]').value).toBe('21:30');

    // typing an earlier start keeps the row in place until the edit is finished, then it re-sorts
    const start = last.querySelector('input[type="time"]');
    start.value = '17:00'; start.dispatchEvent(new Event('input', { bubbles: true })); flushSync();
    expect([...document.querySelectorAll('.edit-row')].at(-1)).toBe(last);
    expect(q('.warn')).not.toBeNull(); // overlaps the 16:30-18:00 block
    start.dispatchEvent(new Event('change', { bubbles: true })); flushSync();
    expect([...document.querySelectorAll('.edit-row')].indexOf(last)).toBe(2);

    last.querySelector('.btn.danger').click(); flushSync();
    expect(rowsN()).toBe(4);
    expect(q('.warn')).toBeNull();

    window.confirm = () => true;
    const sel = q('select.field'); sel.value = 'sun'; sel.dispatchEvent(new Event('change', { bubbles: true })); flushSync();
    [...document.querySelectorAll('.btn')].find((b) => b.textContent.startsWith('Copy Wed')).click(); flushSync();
    expect(store.data.schedule.sun.map((b) => b.title)).toEqual(store.data.schedule.wed.map((b) => b.title));
    expect(q('.toast').textContent).toBe('Copied to Sunday');

    // switching day replays the rows and shows that day's blocks
    [...document.querySelectorAll('.day-tabs .btn')].find((b) => b.textContent === 'Sat').click(); flushSync();
    expect(q('.day-tabs .btn.active').textContent).toBe('Sat');
    expect(rowsN()).toBe(4);

    // Settings
    q('.tab[data-view="settings"]').click(); await settle(2600);
    expect(ui.view).toBe('settings');
    const catsN = () => document.querySelectorAll('.cat-edit').length;
    expect(catsN()).toBe(6);
    [...document.querySelectorAll('.btn.primary')].find((b) => b.textContent.includes('Add category')).click(); flushSync();
    expect(catsN()).toBe(7);
    const name = [...document.querySelectorAll('.cat-edit')].at(-1).querySelector('input[type="text"]');
    name.value = 'Reading'; name.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.data.categories.at(-1).name).toBe('Reading');
    [...document.querySelectorAll('.cat-edit')].at(-1).querySelector('.btn.danger').click(); flushSync(); // unused: no confirm
    expect(catsN()).toBe(6);

    const thr = q('#threshold');
    thr.value = '250'; thr.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.data.settings.threshold).toBe(100);
    thr.value = '80'; thr.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.data.settings.threshold).toBe(80);

    // theme chips
    [...document.querySelectorAll('.chip-btn')].find((b) => b.textContent === 'Mono').click(); flushSync();
    expect(document.documentElement.dataset.theme).toBe('mono');
    [...document.querySelectorAll('.chip-btn')].find((b) => b.textContent === 'Colour').click(); flushSync();

    // import a timetable-only file: history kept
    const file = new File([JSON.stringify({ categories: [{ id: 'x', name: 'X', color: '#ffffff' }], schedule: { mon: [{ id: 'z', start: '08:00', end: '09:00', title: 'Imported', cat: 'x' }] } })], 'w.json');
    const input = q('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(store.data.schedule.mon[0]?.title).toBe('Imported'));
    expect(store.data.logs['2026-11-18'].note).toBe('Slept late');
    flushSync();
    expect(catsN()).toBe(1);
    expect(q('.toast').textContent).toBe('Timetable imported');

    // a bad file is refused
    Object.defineProperty(input, 'files', { value: [new File(['{"nope":1}'], 'x.json')], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(q('.toast').textContent).toBe('That file is not a WeekGrid export'));

    // sample week back, then clear everything
    [...document.querySelectorAll('.btn')].find((b) => b.textContent === 'Load sample week').click(); flushSync();
    expect(catsN()).toBe(6);
    expect(store.data.logs['2026-11-18'].note).toBe('Slept late');
    [...document.querySelectorAll('.btn')].find((b) => b.textContent === 'Clear everything').click(); flushSync();
    expect(store.data.categories).toEqual([]);
    expect(store.data.logs).toEqual({});
    expect(JSON.parse(localStorage.getItem('weekgrid:v1')).logs).toEqual({});
    unmount(app);
    vi.useRealTimers();
  });
});
