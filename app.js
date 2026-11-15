/* WeekGrid: plan weekly time blocks, mark what you actually did, see progress. */
'use strict';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const STORE_KEY = 'weekgrid:v1';
const SCORE = { done: 1, partial: 0.5, missed: 0 };

// ---------- Sample data (generic student week) ----------
const SAMPLE = {
  categories: [
    { id: 'study', name: 'Study', color: '#6ea8fe', target: 6, tracked: true },
    { id: 'dsa', name: 'DSA', color: '#3ecf8e', target: 5, tracked: true },
    { id: 'learn', name: 'Online course', color: '#c58af9', target: 5, tracked: true },
    { id: 'project', name: 'Project', color: '#f5b84a', target: 3, tracked: true },
    { id: 'gym', name: 'Gym', color: '#f2667a', target: 6, tracked: true },
    { id: 'fixed', name: 'Fixed', color: '#5b6275', target: 0, tracked: false }
  ],
  schedule: {
    mon: [
      { id: 's1', start: '09:00', end: '16:00', title: 'Classes', cat: 'fixed' },
      { id: 's2', start: '18:00', end: '19:15', title: 'Gym: Push', cat: 'gym' },
      { id: 's3', start: '20:00', end: '21:30', title: 'DSA: new concept + 2 problems', cat: 'dsa' }
    ],
    tue: [
      { id: 's4', start: '09:00', end: '16:00', title: 'Classes', cat: 'fixed' },
      { id: 's5', start: '16:30', end: '18:00', title: 'Revise subject A', cat: 'study' },
      { id: 's6', start: '18:15', end: '19:45', title: 'Gym: Pull', cat: 'gym' },
      { id: 's7', start: '20:30', end: '21:30', title: 'Online course', cat: 'learn' }
    ],
    wed: [
      { id: 's8', start: '09:00', end: '16:00', title: 'Classes', cat: 'fixed' },
      { id: 's9', start: '16:30', end: '18:00', title: 'Revise subject B', cat: 'study' },
      { id: 's10', start: '18:30', end: '19:30', title: 'DSA practice', cat: 'dsa' },
      { id: 's11', start: '20:30', end: '21:30', title: 'Online course', cat: 'learn' }
    ],
    thu: [
      { id: 's12', start: '09:00', end: '16:00', title: 'Classes', cat: 'fixed' },
      { id: 's13', start: '18:00', end: '19:15', title: 'Gym: Push', cat: 'gym' },
      { id: 's14', start: '20:00', end: '21:30', title: 'DSA: new concept + revision', cat: 'dsa' }
    ],
    fri: [
      { id: 's15', start: '09:00', end: '13:00', title: 'Classes', cat: 'fixed' },
      { id: 's16', start: '15:00', end: '16:30', title: 'Revise subject C', cat: 'study' },
      { id: 's17', start: '17:00', end: '18:30', title: 'Online course', cat: 'learn' },
      { id: 's18', start: '18:45', end: '20:15', title: 'Gym: Pull', cat: 'gym' }
    ],
    sat: [
      { id: 's19', start: '09:30', end: '11:00', title: 'Project work', cat: 'project' },
      { id: 's20', start: '11:15', end: '12:45', title: 'Online course', cat: 'learn' },
      { id: 's21', start: '14:00', end: '15:30', title: 'Weekly subject revision', cat: 'study' },
      { id: 's22', start: '18:00', end: '19:45', title: 'Gym: Legs', cat: 'gym' }
    ],
    sun: [
      { id: 's23', start: '09:00', end: '10:30', title: 'DSA timed practice', cat: 'dsa' },
      { id: 's24', start: '10:45', end: '12:15', title: 'Project work', cat: 'project' },
      { id: 's25', start: '13:30', end: '15:00', title: 'Online course', cat: 'learn' },
      { id: 's26', start: '20:30', end: '21:00', title: 'Plan next week', cat: 'study' }
    ]
  },
  logs: {},
  settings: { threshold: 70 }
};

// ---------- Utils ----------
const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayKey = (d) => DAYS[(d.getDay() + 6) % 7];
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const todayIso = () => iso(new Date());

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hours = (b) => { let m = toMin(b.end) - toMin(b.start); if (m < 0) m += 1440; return m / 60; };
const fmtH = (h) => (Math.round(h * 10) / 10).toString().replace(/\.0$/, '') + 'h';
const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

// ---------- State ----------
function emptyState() {
  return { categories: [], schedule: Object.fromEntries(DAYS.map((k) => [k, []])), logs: {}, settings: { threshold: 70 } };
}

function normalize(s) {
  const base = emptyState();
  if (!s || typeof s !== 'object') return base;
  return {
    categories: Array.isArray(s.categories) ? s.categories : [],
    schedule: Object.fromEntries(DAYS.map((k) => [k, Array.isArray(s.schedule?.[k]) ? s.schedule[k] : []])),
    logs: s.logs && typeof s.logs === 'object' && !Array.isArray(s.logs) ? s.logs : {},
    settings: { ...base.settings, ...(s.settings || {}) },
    presetVersion: s.presetVersion ?? null
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* storage unavailable or corrupt */ }
  return normalize(clone(SAMPLE));
}

let state = load();
for (const k of DAYS) for (const b of state.schedule[k]) if (!b.id) b.id = uid();
const ui = { view: 'today', date: todayIso(), week: iso(mondayOf(new Date())), editDay: dayKey(new Date()) };

let firstLog = null;
function save() {
  firstLog = Object.keys(state.logs).sort()[0] || null;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save (storage blocked)'); }
}

const catOf = (id) => state.categories.find((c) => c.id === id);
const isTracked = (b) => { if ('tracked' in b) return b.tracked; const c = catOf(b.cat); return c ? c.tracked !== false : true; };
const blocksFor = (key) => [...state.schedule[key]].sort((a, b) => toMin(a.start) - toMin(b.start));
const logFor = (dIso) => state.logs[dIso] || { marks: {}, note: '' };
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

// Past days are frozen: each keeps a copy of the blocks it had, so editing the
// timetable later never rewrites history. Today and future days follow the live timetable.
const snapshot = (key) => blocksFor(key).map((b) => ({ id: b.id, start: b.start, end: b.end, title: b.title, cat: b.cat, tracked: isTracked(b) }));
function blocksOn(dIso) {
  const log = state.logs[dIso];
  if (dIso < todayIso() && log?.blocks) return log.blocks;
  return blocksFor(dayKey(fromIso(dIso)));
}
function freezePast() {
  const first = Object.keys(state.logs).sort()[0];
  if (!first) return;
  const today = todayIso();
  let changed = false;
  for (let d = fromIso(first), i = 0; iso(d) < today && i < 3660; d = addDays(d, 1), i++) {
    const k = iso(d);
    const log = state.logs[k] || (state.logs[k] = { marks: {}, note: '' });
    if (!log.marks) log.marks = {};
    if (typeof log.note !== 'string') log.note = '';
    if (!log.blocks) { log.blocks = snapshot(dayKey(d)); changed = true; }
  }
  if (changed) save();
}

// Optional personal timetable: a my-timetable.js file next to index.html sets
// window.WEEKGRID_PRESET = { version, categories, schedule }. It is applied once per version and never touches logs.
function applyPreset() {
  const p = window.WEEKGRID_PRESET;
  if (!p || !p.schedule || !Array.isArray(p.categories) || state.presetVersion === p.version) return;
  const fresh = normalize({ categories: clone(p.categories), schedule: clone(p.schedule) });
  state.categories = fresh.categories;
  state.schedule = fresh.schedule;
  state.presetVersion = p.version;
  save();
}

function setMark(dIso, blockId, status) {
  const log = state.logs[dIso] || (state.logs[dIso] = { marks: {}, note: '' });
  if (log.marks[blockId] === status) delete log.marks[blockId];
  else log.marks[blockId] = status;
  save();
}

// ---------- Stats ----------
// Days before you started logging (and future days) are left blank, not scored as zero.
const counts = (dIso) => Boolean(firstLog) && dIso >= firstLog && dIso <= todayIso();

function dayStats(dIso) {
  const blocks = blocksOn(dIso).filter(isTracked);
  const marks = logFor(dIso).marks || {};
  let score = 0;
  const byCat = {};
  for (const b of blocks) {
    const s = SCORE[marks[b.id]] ?? 0;
    score += s;
    byCat[b.cat] = byCat[b.cat] || { done: 0, planned: 0 };
    byCat[b.cat].planned += hours(b);
    byCat[b.cat].done += hours(b) * s;
  }
  const pct = blocks.length ? Math.round((score / blocks.length) * 100) : null;
  // "So far" score: today, blocks that have not ended yet are not held against you.
  let soFar = pct;
  if (dIso === todayIso()) {
    const t = nowMin();
    const due = blocks.filter((b) => marks[b.id] || (toMin(b.end) >= toMin(b.start) && toMin(b.end) <= t));
    soFar = due.length ? Math.round((due.reduce((a, b) => a + (SCORE[marks[b.id]] ?? 0), 0) / due.length) * 100) : null;
  }
  return { pct, soFar, byCat, count: blocks.length, marked: blocks.filter((b) => marks[b.id]).length };
}

function streak() {
  const th = Number(state.settings.threshold) || 70;
  let d = new Date();
  let n = 0;
  const today = dayStats(iso(d));
  if (today.pct === null || today.pct < th) d = addDays(d, -1); // today still in progress
  for (let i = 0; i < 365; i++) {
    const s = dayStats(iso(d));
    if (s.pct === null) { d = addDays(d, -1); continue; } // nothing tracked that day: skip
    if (s.pct >= th) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}

function weekStats(mondayIso) {
  const start = fromIso(mondayIso);
  const days = DAYS.map((_, i) => { const dIso = iso(addDays(start, i)); return { dIso, ...dayStats(dIso) }; });
  const byCat = {};
  for (const d of days) {
    for (const [cat, v] of Object.entries(d.byCat)) {
      byCat[cat] = byCat[cat] || { done: 0, planned: 0 };
      byCat[cat].done += v.done;
      byCat[cat].planned += v.planned;
    }
  }
  const scored = days.filter((d) => d.soFar !== null && counts(d.dIso));
  const avg = scored.length ? Math.round(scored.reduce((a, d) => a + d.soFar, 0) / scored.length) : 0;
  const best = scored.reduce((b, d) => (!b || d.soFar > b.soFar ? d : b), null);
  return { days, byCat, avg, best };
}

// ---------- Look and motion helpers ----------
const DAY_COLORS = { mon: '#8fa8e8', tue: '#b3a4e0', wed: '#86cfb0', thu: '#dcc08a', fri: '#d99aa0', sat: '#8fc4d6', sun: '#d6a3c4' };
// Soften any category colour so saturated picks still sit quietly on black.
function tone(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#9a9a9a';
  const n = parseInt(m[1], 16);
  const mix = (v) => Math.round(v * 0.62 + 190 * 0.38);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
const PALETTE = Object.values(DAY_COLORS);
const TAB_INK = { today: '#86cfb0', week: '#8fa8e8', timetable: '#dcc08a', settings: '#d6a3c4' };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const shortDate = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function animateNum(el, from, to) {
  if (!el) return;
  if (reduced() || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  const dur = 650;
  (function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

function burst(el, color) {
  if (reduced() || !el) return;
  const r = el.getBoundingClientRect();
  const fx = $('#fx');
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('i');
    const ang = (Math.PI * 2 * i) / 16 + rand(-0.2, 0.2);
    const dist = rand(34, 90);
    s.className = 'spark';
    s.style.cssText = `left:${r.left + r.width / 2 - 4}px;top:${r.top + r.height / 2 - 4}px;--c:${i % 3 ? color : PALETTE[i % 7]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px`;
    fx.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

function confetti() {
  if (reduced()) return;
  const fx = $('#fx');
  for (let i = 0; i < 110; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.cssText = `left:${rand(0, 100)}vw;--c:${PALETTE[i % 7]};--dx:${rand(-120, 120)}px;--r:${rand(-900, 900)}deg;--t:${rand(1.6, 3.2)}s;--dl:${rand(0, 0.6)}s`;
    fx.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

function moveInk() {
  const tab = document.querySelector('.tab.active');
  const ink = document.querySelector('.tab-ink');
  if (!tab || !ink) return;
  ink.style.width = `${tab.offsetWidth - 24}px`;
  ink.style.transform = `translateX(${tab.offsetLeft + 12}px)`;
  ink.style.setProperty('--ink', TAB_INK[ui.view]);
}

function heroMsg(st, th) {
  if (st.pct === null) return ['Nothing scheduled', ''];
  if (st.pct === 100) return ['Clean sweep', 'win'];
  if (st.pct >= th) return ['Streak day locked in', 'win'];
  if (st.marked === 0) return ['Fresh page', ''];
  if (st.pct >= 50) return ['Past halfway', ''];
  return ['Keep going', ''];
}

// ---------- Render: Today ----------
function renderToday() {
  const d = fromIso(ui.date);
  const key = dayKey(d);
  const dc = DAY_COLORS[key];
  const blocks = blocksOn(ui.date);
  const log = logFor(ui.date);
  const st = dayStats(ui.date);
  const isToday = ui.date === todayIso();
  const th = Number(state.settings.threshold) || 70;
  const [msg, msgCls] = heroMsg(st, th);
  const n = streak();

  const segs = blocks.filter(isTracked).map((b, i) =>
    `<i class="seg s-${log.marks[b.id] || 'none'}" data-seg="${b.id}" style="--c:${tone(catOf(b.cat)?.color)};--i:${i};flex:${hours(b) || 1}"></i>`).join('');

  const mon = mondayOf(d);
  const strip = DAYS.map((k, i) => {
    const dIso = iso(addDays(mon, i));
    const s = dayStats(dIso);
    const future = !counts(dIso);
    return `<button class="tile ${dIso === ui.date ? 'sel' : ''} ${future ? 'future' : ''}" data-action="open-day" data-date="${dIso}"
      style="--d:${DAY_COLORS[k]};--h:${future ? 0 : s.pct || 0}%;--i:${i}" aria-label="${DAY_NAMES[k]}">
      <span class="fill"></span><span class="l">${DAY_NAMES[k][0]}</span><span class="p">${future || s.pct === null ? '' : s.pct + '%'}</span></button>`;
  }).join('');

  const rows = blocks.map((b, i) => {
    const c = catOf(b.cat);
    const tracked = isTracked(b);
    const m = log.marks[b.id];
    const btn = (status, label, title) =>
      `<button class="mark ${m === status ? 'on' : ''}" data-action="mark" data-id="${b.id}" data-status="${status}" title="${title}" aria-label="${title}" aria-pressed="${m === status}">${label}</button>`;
    return `
      <div class="block ${tracked ? `st-${m || 'none'}` : 'fixed'}" data-bid="${b.id}" style="--c:${tone(c?.color)};--i:${i}">
        <div class="time"><span>${esc(b.start)}</span> <span class="to">${esc(b.end)}</span></div>
        <div><div class="title">${esc(b.title || 'Untitled')}</div>
        ${tracked ? `<div class="meta"><b>${esc(c?.name || 'No category')}</b>${fmtH(hours(b))}</div>` : ''}</div>
        ${tracked ? `<div class="marks">${btn('done', '✓', 'Done')}${btn('partial', '½', 'Partial')}${btn('missed', '✕', 'Missed')}</div>` : '<div></div>'}
      </div>`;
  }).join('');

  let nudge = '';
  if (isToday) {
    const y = iso(addDays(d, -1));
    const ys = dayStats(y);
    const open = ys.count - ys.marked;
    if (counts(y) && open > 0) nudge = `<button class="nudge" data-action="open-day" data-date="${y}">Yesterday still has ${open} unmarked ${open === 1 ? 'block' : 'blocks'}. Finish it</button>`;
  }

  const from = ui.enter ? 0 : ui.lastPct || 0;
  $('#view-today').innerHTML = `
    <div class="hero" style="--day:${dc}">
      <div class="hero-glow"></div>
      <div class="hero-top">
        <button class="nav-btn" data-action="day-prev" aria-label="Previous day">‹</button>
        <div class="hero-date">
          <div class="dow">${[...DAY_NAMES[key]].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('')}</div>
          <div class="dom">${d.getDate()} <span class="mon">${esc(d.toLocaleDateString(undefined, { month: 'long' }))}</span>
            ${isToday ? '<span class="pill">today</span>' : '<a href="#" class="jump" data-action="day-today">Back to today</a>'}</div>
        </div>
        <button class="nav-btn" data-action="day-next" aria-label="Next day">›</button>
      </div>
      <div class="hero-score">
        <div class="pct"><span id="pct-num">${from}</span><span class="pct-sign">%</span></div>
        <div class="hero-side">
          <div class="hero-msg ${msgCls}">${msg}</div>
          ${n ? `<div class="streak"><span class="flame">🔥</span> ${n} day streak</div>` : `<div class="muted small">${st.marked} of ${st.count} blocks marked</div>`}
        </div>
      </div>
      <div class="segs">${segs}</div>
      <div class="strip">${strip}</div>
    </div>
    ${nudge}
    <div class="blocks">${rows || `<div class="empty-state">No blocks on ${DAY_NAMES[key]} yet. Add some in Timetable.</div>`}</div>
    <h3>What slipped, and why?</h3>
    <textarea id="day-note" placeholder="One honest line is enough.">${esc(log.note)}</textarea>`;

  animateNum($('#pct-num'), from, st.pct || 0);
  ui.lastPct = st.pct || 0;
}

function markFx(id, status, prevPct) {
  const btn = document.querySelector(`.mark[data-id="${id}"][data-status="${status}"]`);
  if (!btn || !btn.classList.contains('on')) return;
  const block = btn.closest('.block');
  btn.classList.add('pop');
  block.classList.add('just');
  document.querySelector(`[data-seg="${id}"]`)?.classList.add('just');
  if (status === 'done') burst(btn, block.style.getPropertyValue('--c'));
  const now = dayStats(ui.date).pct;
  if (now === 100 && prevPct < 100) confetti();
}

// ---------- Render: Week ----------
function renderWeek() {
  const ws = weekStats(ui.week);
  const start = fromIso(ui.week);
  const today = todayIso();
  const bestKey = ws.best ? dayKey(fromIso(ws.best.dIso)) : null;

  const bars = ws.days.map((d, i) => `
    <button class="bar-col ${d.dIso === today ? 'today' : ''}" data-action="open-day" data-date="${d.dIso}" style="--d:${DAY_COLORS[DAYS[i]]}" aria-label="Open ${DAY_NAMES[DAYS[i]]}">
      <span class="pc">${d.pct === null || !counts(d.dIso) ? '' : d.pct + '%'}</span>
      <span class="bar-track"><span class="bar" style="--h:${counts(d.dIso) ? d.pct || 0 : 0}%;--i:${i}"></span></span>
      <span class="lb">${DAY_NAMES[DAYS[i]].slice(0, 3)}</span>
    </button>`).join('');

  const cur = mondayOf(new Date());
  let ci = 0;
  let heat = '<span></span>' + DAYS.map((k) => `<span class="hd" style="--d:${DAY_COLORS[k]}">${DAY_NAMES[k][0]}</span>`).join('');
  for (let w = 7; w >= 0; w--) {
    const wkStart = addDays(cur, -7 * w);
    heat += `<span class="wk ${w === 0 ? 'cur' : ''}">${esc(shortDate(wkStart))}</span>`;
    heat += DAYS.map((k, i) => {
      const dIso = iso(addDays(wkStart, i));
      const s = dayStats(dIso);
      const none = !counts(dIso) || s.pct === null;
      const a = s.pct ? Math.round(14 + s.pct * 0.86) : 0;
      return `<button class="cell ${none ? 'none' : ''} ${dIso === today ? 'is-today' : ''}" data-action="open-day" data-date="${dIso}"
        style="--d:${DAY_COLORS[k]};--a:${a};--i:${ci++}" title="${esc(shortDate(fromIso(dIso)))}${none ? '' : ': ' + s.pct + '%'}"></button>`;
    }).join('');
  }

  const catRows = state.categories.filter((c) => c.tracked !== false).map((c, i) => {
    const v = ws.byCat[c.id] || { done: 0, planned: 0 };
    const goal = Number(c.target) || v.planned;
    const pct = goal ? Math.min(100, Math.round((v.done / goal) * 100)) : 0;
    return `
      <div class="cat-row" style="--c:${tone(c.color)}">
        <div class="row space"><span class="cat-name">${esc(c.name)}</span>
        <span class="cat-num"><b>${fmtH(v.done)}</b> of ${fmtH(goal)}</span></div>
        <div class="cat-track"><div class="cat-fill" style="--w:${pct}%;--i:${i}"></div></div>
      </div>`;
  }).join('');

  const notes = ws.days.filter((d) => logFor(d.dIso).note.trim()).map((d) => {
    const k = dayKey(fromIso(d.dIso));
    return `<div class="note-line"><b style="--d:${DAY_COLORS[k]}">${DAY_NAMES[k].slice(0, 3)}</b>${esc(logFor(d.dIso).note)}</div>`;
  }).join('');

  $('#view-week').innerHTML = `
    <div class="row space">
      <button class="nav-btn" data-action="week-prev" aria-label="Previous week">‹</button>
      <h2>${esc(shortDate(start))} to ${esc(shortDate(addDays(start, 6)))}</h2>
      <button class="nav-btn" data-action="week-next" aria-label="Next week">›</button>
    </div>
    <div class="figs">
      <div class="fig" style="--i:0"><div class="num"><span id="avg-num">0</span>%</div><div class="label">average completion</div></div>
      <div class="fig" style="--i:1"><div class="num"><span id="streak-num">0</span> 🔥</div><div class="label">day streak</div></div>
      <div class="fig" style="--i:2"><div class="num" style="color:${bestKey ? DAY_COLORS[bestKey] : 'var(--dim)'}">${bestKey ? DAY_NAMES[bestKey].slice(0, 3) : 'None'}</div><div class="label">best day</div></div>
    </div>
    <h3>Day by day</h3>
    <div class="panel" style="--i:3"><div class="bars">${bars}</div></div>
    <h3>Hours against your targets</h3>
    <div class="panel" style="--i:4">${catRows || '<div class="muted">No tracked categories yet. Add one in Settings.</div>'}</div>
    <h3>Last 8 weeks</h3>
    <div class="panel" style="--i:5"><div class="heat">${heat}</div></div>
    <h3>Notes this week</h3>
    <div class="panel" style="--i:6">${notes || '<div class="muted small">No notes yet. Write one on the Today tab.</div>'}</div>
    <p class="muted small">A day counts toward the streak at ${esc(state.settings.threshold)}% or more. A partial block earns half credit.</p>`;

  const from = ui.enter ? 0 : null;
  animateNum($('#avg-num'), from ?? ws.avg, ws.avg);
  animateNum($('#streak-num'), from ?? streak(), streak());
}

// ---------- Render: Timetable editor ----------
function clashOf(key) {
  const list = blocksFor(key);
  const out = new Set();
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    if (toMin(prev.end) > toMin(prev.start) && toMin(list[i].start) < toMin(prev.end)) { out.add(prev.id); out.add(list[i].id); }
  }
  return out;
}
function renderTimetable() {
  const key = ui.editDay;
  const catOptions = (sel) => state.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const rows = blocksFor(key).map((b, i) => `
    <div class="edit-row ${clashOf(key).has(b.id) ? 'clash' : ''}" data-id="${b.id}" style="--i:${i}">
      <input type="time" value="${esc(b.start)}" data-field="start" aria-label="Start" />
      <input type="time" value="${esc(b.end)}" data-field="end" aria-label="End" />
      <input type="text" class="title-in" value="${esc(b.title)}" data-field="title" placeholder="What are you doing?" aria-label="Title" />
      <select data-field="cat" aria-label="Category">${catOptions(b.cat)}</select>
      <button class="btn danger icon" data-action="del-block" data-id="${b.id}" aria-label="Delete block">✕</button>
    </div>`).join('');

  const planned = blocksFor(key).filter(isTracked).reduce((a, b) => a + hours(b), 0);
  const clash = clashOf(key);

  $('#view-timetable').innerHTML = `
    <h2>Weekly timetable</h2>
    <p class="muted small">Your repeating week. Blocks in untracked categories (like "Fixed") show on Today but aren't scored.</p>
    <div class="day-tabs">${DAYS.map((k) => `<button class="btn ${k === key ? 'active' : ''}" data-action="edit-day" data-day="${k}" style="--d:${DAY_COLORS[k]}">${DAY_NAMES[k].slice(0, 3)}</button>`).join('')}</div>
    <div class="row space" style="margin-bottom:8px"><strong style="color:${DAY_COLORS[key]};font-size:20px">${DAY_NAMES[key]}</strong><span class="muted small">${fmtH(planned)} tracked</span></div>
    ${rows || '<div class="empty-state">No blocks yet. Add your first one below.</div>'}
    ${clash.size ? `<p class="warn small">${clash.size} blocks overlap in time on ${DAY_NAMES[key]}. Check the start and end times.</p>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="btn primary" data-action="add-block">+ Add block</button>
      <select class="field" id="copy-target" aria-label="Copy to day">
        ${DAYS.filter((k) => k !== key).map((k) => `<option value="${k}">${DAY_NAMES[k]}</option>`).join('')}
      </select>
      <button class="btn" data-action="copy-day">Copy ${DAY_NAMES[key].slice(0, 3)} to…</button>
    </div>`;
}

// ---------- Render: Settings ----------
function renderSettings() {
  const cats = state.categories.map((c) => `
    <div class="edit-row cat-edit" data-cat="${esc(c.id)}">
      <input type="text" value="${esc(c.name)}" data-cfield="name" aria-label="Category name" />
      <input type="color" value="${esc(c.color)}" data-cfield="color" aria-label="Color" />
      <label><input type="number" min="0" step="0.5" value="${esc(c.target)}" data-cfield="target" style="width:56px" class="field" />h/wk</label>
      <label><input type="checkbox" ${c.tracked !== false ? 'checked' : ''} data-cfield="tracked" />Tracked</label>
      <button class="btn danger icon" data-action="del-cat" data-id="${esc(c.id)}" aria-label="Delete category">✕</button>
    </div>`).join('');

  $('#view-settings').innerHTML = `
    <h2>Settings</h2>
    <h3>Categories</h3>
    <p class="muted small">Set a weekly target in hours. Untick "Tracked" for things like classes or travel.</p>
    ${cats || '<div class="muted">No categories.</div>'}
    <button class="btn primary" data-action="add-cat" style="margin-top:6px">+ Add category</button>

    <h3>Streak</h3>
    <div class="row"><span>A day counts toward your streak at</span>
      <input type="number" class="field" id="threshold" min="1" max="100" value="${esc(state.settings.threshold)}" style="width:70px" />%</div>

    <h3>Data</h3>
    <p class="muted small">Data stays in this browser only. Export regularly to back it up or move it to another device.</p>
    <div class="row">
      <button class="btn" data-action="export">Export JSON</button>
      <button class="btn" data-action="import">Import JSON</button>
      <button class="btn" data-action="load-sample">Load sample week</button>
      <button class="btn danger" data-action="reset">Clear everything</button>
    </div>`;
}

// ---------- Transitions ----------
let busy = false;

// Seven columns sweep up over the page, the view swaps behind them, then they lift away.
function wipe(swap) {
  if (reduced()) { swap(); return; }
  if (busy) return;
  busy = true;
  const w = $('#wipe');
  w.className = 'wipe-in';
  setTimeout(() => {
    swap();
    w.className = 'wipe-out';
    setTimeout(() => { w.className = ''; busy = false; }, 820);
  }, 560);
}

// Lighter move for stepping between days or weeks: old content leaves one way, new arrives from the other.
function slide(dir) {
  const v = $(`#view-${ui.view}`);
  if (reduced()) { render(true); return; }
  v.classList.add(dir > 0 ? 'leave-l' : 'leave-r');
  setTimeout(() => {
    v.classList.remove('leave-l', 'leave-r');
    render(true);
    v.classList.add(dir > 0 ? 'from-r' : 'from-l');
    setTimeout(() => v.classList.remove('from-r', 'from-l'), 600);
  }, 180);
}

// Welcome sequence on open: the grid assembles, the name lands, then the curtain lifts.
function intro() {
  if (reduced()) { render(true); return; }
  const now = new Date();
  const h = now.getHours();
  const hi = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const st = dayStats(todayIso());
  const left = st.count - st.marked;
  const sub = st.count === 0 ? 'Nothing on the grid today' : left === 0 ? 'Every block is marked' : `${left} ${left === 1 ? 'block' : 'blocks'} waiting on the grid`;
  let cells = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    const dist = Math.hypot(c - 3, r - 2);
    cells += `<i style="--d:${DAY_COLORS[DAYS[c]]};--dl:${Math.round(dist * 90)}ms;--o:${(0.25 + ((c * 7 + r * 13) % 10) / 13).toFixed(2)}"></i>`;
  }
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <div class="i-grid">${cells}</div>
    <div class="i-word">${[...'WeekGrid'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('')}</div>
    <div class="i-hi">${hi}</div>
    <div class="i-sub">${fmtDate(now)}. ${sub}.</div>`;
  $('#wipe').className = 'wipe-hold';
  document.body.appendChild(el);
  busy = true;
  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    el.classList.add('out');
    render(true);
    $('#wipe').className = 'wipe-out';
    setTimeout(() => { el.remove(); $('#wipe').className = ''; busy = false; }, 900);
  };
  el.addEventListener('click', leave);
  document.addEventListener('keydown', leave, { once: true });
  setTimeout(leave, 3300);
}

// ---------- Rendering / navigation ----------
const RENDER = { today: renderToday, week: renderWeek, timetable: renderTimetable, settings: renderSettings };

function render(enter = false) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === ui.view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${ui.view}`));
  const view = $(`#view-${ui.view}`);
  ui.enter = enter && !reduced();
  RENDER[ui.view]();
  view.classList.remove('enter');
  if (ui.enter) { void view.offsetWidth; view.classList.add('enter'); }
  moveInk();
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) {
    if (tab.dataset.view !== ui.view) wipe(() => { ui.view = tab.dataset.view; render(true); });
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  let enter = true;
  const before = ui.date + ui.week;

  switch (a) {
    case 'mark': {
      const prev = dayStats(ui.date).pct || 0;
      setMark(ui.date, el.dataset.id, el.dataset.status);
      render(false);
      markFx(el.dataset.id, el.dataset.status, prev);
      return;
    }
    case 'day-prev': ui.date = iso(addDays(fromIso(ui.date), -1)); break;
    case 'day-next': ui.date = iso(addDays(fromIso(ui.date), 1)); break;
    case 'day-today': e.preventDefault(); ui.date = todayIso(); break;
    case 'week-prev': ui.week = iso(addDays(fromIso(ui.week), -7)); break;
    case 'week-next': ui.week = iso(addDays(fromIso(ui.week), 7)); break;
    case 'open-day':
      if (ui.view !== 'today') { wipe(() => { ui.date = el.dataset.date; ui.view = 'today'; render(true); }); return; }
      ui.date = el.dataset.date;
      break;
    case 'edit-day': ui.editDay = el.dataset.day; break;
    case 'add-block': {
      const list = blocksFor(ui.editDay);
      const last = list[list.length - 1];
      const start = last ? last.end : '09:00';
      const endMin = (toMin(start) + 60) % 1440;
      const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      state.schedule[ui.editDay].push({ id: uid(), start, end, title: '', cat: state.categories[0]?.id || '' });
      save();
      enter = false;
      break;
    }
    case 'del-block':
      state.schedule[ui.editDay] = state.schedule[ui.editDay].filter((b) => b.id !== el.dataset.id);
      save();
      enter = false;
      break;
    case 'copy-day': {
      const target = $('#copy-target').value;
      if (state.schedule[target].length && !confirm(`Replace ${DAY_NAMES[target]}'s blocks?`)) return;
      state.schedule[target] = state.schedule[ui.editDay].map((b) => ({ ...b, id: uid() }));
      save();
      toast(`Copied to ${DAY_NAMES[target]}`);
      enter = false;
      break;
    }
    case 'add-cat':
      state.categories.push({ id: uid(), name: 'New category', color: PALETTE[state.categories.length % 7], target: 0, tracked: true });
      save();
      enter = false;
      break;
    case 'del-cat': {
      const used = DAYS.some((k) => state.schedule[k].some((b) => b.cat === el.dataset.id));
      if (used && !confirm('Blocks use this category. Delete anyway?')) return;
      state.categories = state.categories.filter((c) => c.id !== el.dataset.id);
      save();
      enter = false;
      break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `weekgrid-${todayIso()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    case 'import': $('#import-file').click(); return;
    case 'load-sample':
      if (!confirm('Replace your timetable and categories with the sample week? Your logs are kept.')) return;
      state.categories = clone(SAMPLE.categories);
      state.schedule = clone(SAMPLE.schedule);
      save();
      toast('Sample week loaded');
      break;
    case 'reset':
      if (!confirm('Delete all data? Export first if you want a backup.')) return;
      state = { ...emptyState(), presetVersion: state.presetVersion };
      save();
      toast('Everything cleared');
      break;
    default: return;
  }
  const after = ui.date + ui.week;
  if (enter && after !== before) slide(after > before ? 1 : -1);
  else render(enter);
});

// Inline edits (no re-render on each keystroke to keep focus)
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'day-note') {
    const log = state.logs[ui.date] || (state.logs[ui.date] = { marks: {}, note: '' });
    log.note = t.value;
    save();
    return;
  }
  if (t.id === 'threshold') {
    const v = Math.min(100, Math.max(1, Number(t.value) || 70));
    state.settings.threshold = v;
    save();
    return;
  }
  const row = t.closest('.edit-row');
  if (!row) return;
  if (t.dataset.field) {
    const b = state.schedule[ui.editDay].find((x) => x.id === row.dataset.id);
    if (b) { b[t.dataset.field] = t.value; save(); }
  } else if (t.dataset.cfield) {
    const c = state.categories.find((x) => x.id === row.dataset.cat);
    if (!c) return;
    const f = t.dataset.cfield;
    c[f] = f === 'tracked' ? t.checked : f === 'target' ? Number(t.value) || 0 : t.value;
    save();
  }
});

// Re-sort / refresh totals after an edit is finished
document.addEventListener('change', (e) => {
  if (e.target.closest('#view-timetable .edit-row') && ['start', 'end', 'cat'].includes(e.target.dataset.field)) render(false);
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.schedule || !Array.isArray(data.categories)) throw new Error('bad file');
    const kept = state.logs;
    const pv = state.presetVersion;
    state = normalize(data);
    state.presetVersion = pv;
    if (!Object.keys(state.logs).length) state.logs = kept; // a timetable-only file keeps your history
    save();
    render(true);
    toast('Timetable imported');
  } catch (err) {
    toast('That file is not a WeekGrid export');
  }
});

// Refresh when the date rolls over or the tab regains focus
let dayShown = todayIso();
function rollover() {
  const today = todayIso();
  if (today === dayShown) return false;
  if (ui.date === dayShown) ui.date = today; // was following "today": keep following it
  ui.week = iso(mondayOf(new Date()));
  dayShown = today;
  freezePast();
  return true;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) render(rollover()); });
setInterval(() => { if (!busy && rollover()) render(true); }, 60000);

// Arrow keys step through days (Today) or weeks (Week)
document.addEventListener('keydown', (e) => {
  if (busy || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const dir = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null;
  if (dir) document.querySelector(`#view-${ui.view} [data-action$="-${dir}"]`)?.click();
});
window.addEventListener('resize', moveInk);
document.fonts?.ready.then(moveInk);

save(); // sets firstLog
freezePast();
applyPreset();
intro();
