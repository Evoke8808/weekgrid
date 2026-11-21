// Pure data functions: no DOM, no storage. Everything takes the state (and "today") as arguments
// so it can be tested and reused by the views.
import { DAYS, PALETTE } from './constants.js';
import { iso, fromIso, addDays, dayKey, dayKeyOf, toMin } from './dates.js';
import { SAMPLE } from './sample.js';

// Get (creating if needed) a day's log. Always re-read after assigning: with reactive state the
// assigned object and the stored one are not the same, so changes must go through the stored one.
export function ensureLog(state, dIso) {
  if (!state.logs[dIso]) state.logs[dIso] = { marks: {}, note: '' };
  return state.logs[dIso];
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function emptyState() {
  return { categories: [], schedule: Object.fromEntries(DAYS.map((k) => [k, []])), logs: {}, workouts: [], cardio: { daily: false, machines: [], plan: {} }, settings: { threshold: 70, rest: 90 } };
}

export function normCardio(c) {
  if (!c || typeof c !== 'object') return { daily: false, machines: [], plan: {} };
  return {
    daily: Boolean(c.daily),
    machines: Array.isArray(c.machines) ? c.machines.filter((m) => m && m.id && typeof m.name === 'string').map((m) => ({ id: String(m.id), name: m.name, mode: m.mode === 'down' ? 'down' : 'up' })) : [],
    plan: c.plan && typeof c.plan === 'object' ? c.plan : {}
  };
}

// Clean up anything loaded from storage, an import or sync into a state the app can trust.
export function normalize(s) {
  const base = emptyState();
  if (!s || typeof s !== 'object') return base;
  const logs = {};
  if (s.logs && typeof s.logs === 'object' && !Array.isArray(s.logs)) {
    for (const [d, log] of Object.entries(s.logs)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !log || typeof log !== 'object') continue; // skip anything that is not a day's log
      logs[d] = { ...log, marks: log.marks && typeof log.marks === 'object' ? log.marks : {}, note: typeof log.note === 'string' ? log.note : '' };
    }
  }
  for (const k of DAYS) for (const b of (Array.isArray(s.schedule?.[k]) ? s.schedule[k] : [])) if (b && !b.id) b.id = uid();
  return {
    categories: Array.isArray(s.categories) ? s.categories : [],
    schedule: Object.fromEntries(DAYS.map((k) => [k, Array.isArray(s.schedule?.[k]) ? s.schedule[k].filter((b) => b && typeof b === 'object') : []])),
    logs,
    workouts: Array.isArray(s.workouts) ? s.workouts.filter((w) => w && Array.isArray(w.exercises)) : [],
    cardio: normCardio(s.cardio),
    settings: { ...base.settings, ...(s.settings || {}) },
    metaT: Number(s.metaT) || 0,
    presetVersion: s.presetVersion ?? null
  };
}

// Turn the raw localStorage string into a state. Missing or broken data starts from the sample week.
export function parseStored(raw) {
  if (raw) {
    try {
      const data = JSON.parse(raw);
      const st = normalize(data);
      // Data saved before workouts or cardio existed starts with the sample ones
      if (!Array.isArray(data.workouts)) st.workouts = clone(SAMPLE.workouts);
      if (!data.cardio) st.cardio = clone(SAMPLE.cardio);
      return st;
    } catch (e) { /* corrupt: fall through */ }
  }
  return normalize(clone(SAMPLE));
}

export const catOf = (state, id) => state.categories.find((c) => c.id === id);
export const isTracked = (state, b) => { if ('tracked' in b) return b.tracked; const c = catOf(state, b.cat); return c ? c.tracked !== false : true; };
export const blocksFor = (state, key) => [...state.schedule[key]].sort((a, b) => toMin(a.start) - toMin(b.start));
export const logFor = (state, dIso) => state.logs[dIso] || { marks: {}, note: '' };
export const firstLogOf = (state) => Object.keys(state.logs).sort()[0] || null;

// Past days are frozen: each keeps a copy of the blocks it had, so editing the
// timetable later never rewrites history. Today and future days follow the live timetable.
export const snapshot = (state, key) => blocksFor(state, key).map((b) => ({ id: b.id, start: b.start, end: b.end, title: b.title, cat: b.cat, workout: b.workout, tracked: isTracked(state, b) }));

export function blocksOn(state, dIso, today) {
  const log = state.logs[dIso];
  if (dIso < today && log?.blocks) return log.blocks;
  return blocksFor(state, dayKeyOf(dIso));
}

export const cardioOn = (state) => Boolean(state.cardio.daily && state.cardio.machines.length);
export const cardioReq = (state, dIso, today) => (dIso < today ? Boolean(state.logs[dIso]?.cardioReq) : cardioOn(state));

// Give every past day since the first log its frozen snapshot. Returns true if anything changed.
export function freezePast(state, today) {
  const first = firstLogOf(state);
  if (!first) return false;
  let changed = false;
  for (let d = fromIso(first), i = 0; iso(d) < today && i < 3660; d = addDays(d, 1), i++) {
    const k = iso(d);
    const log = ensureLog(state, k);
    if (!log.marks) log.marks = {};
    if (typeof log.note !== 'string') log.note = '';
    if (!log.blocks) { log.blocks = snapshot(state, dayKey(d)); log.cardioReq = cardioOn(state); changed = true; }
  }
  return changed;
}

// Optional personal timetable (my-timetable.js sets window.WEEKGRID_PRESET). Applied once per
// version; never touches logs. Returns true if it was applied.
export function applyPreset(state, p) {
  if (!p || !p.schedule || !Array.isArray(p.categories) || state.presetVersion === p.version) return false;
  const fresh = normalize({ categories: clone(p.categories), schedule: clone(p.schedule), workouts: clone(p.workouts || state.workouts), cardio: clone(p.cardio || state.cardio) });
  state.categories = fresh.categories;
  state.workouts = fresh.workouts;
  state.cardio = fresh.cardio;
  state.schedule = fresh.schedule;
  state.presetVersion = p.version;
  return true;
}

// Tapping the mark a block already has clears it.
export function setMark(state, dIso, blockId, status) {
  const log = ensureLog(state, dIso);
  if (log.marks[blockId] === status) delete log.marks[blockId];
  else log.marks[blockId] = status;
}

// The workout a gym block opens: an explicit link, else the longest workout name found in the title.
export function workoutFor(state, b) {
  const list = state.workouts || [];
  if (b.workout) { const w = list.find((x) => x.id === b.workout); if (w) return w; }
  const t = String(b.title || '').toLowerCase();
  return list.filter((w) => w.name && t.includes(w.name.toLowerCase())).sort((a, z) => z.name.length - a.name.length)[0] || null;
}

export function setNote(state, dIso, text) {
  const log = ensureLog(state, dIso);
  log.note = text;
}

// ---- Timetable editing ----
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// New one-hour block right after the day's last block (09:00 on an empty day).
export function addBlock(state, key) {
  const list = blocksFor(state, key);
  const last = list[list.length - 1];
  const start = last ? last.end : '09:00';
  const b = { id: uid(), start, end: hhmm((toMin(start) + 60) % 1440), title: '', cat: state.categories[0]?.id || '' };
  state.schedule[key].push(b);
  return b;
}

export function deleteBlock(state, key, id) {
  state.schedule[key] = state.schedule[key].filter((b) => b.id !== id);
}

// Replace `to`'s blocks with copies of `from`'s (new ids, so history stays separate).
export function copyDay(state, from, to) {
  state.schedule[to] = state.schedule[from].map((b) => ({ ...b, id: uid() }));
}

// Ids of blocks that overlap the one before them (blocks that cross midnight are left alone).
export function clashOf(state, key) {
  const list = blocksFor(state, key);
  const out = new Set();
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    if (toMin(prev.end) > toMin(prev.start) && toMin(list[i].start) < toMin(prev.end)) { out.add(prev.id); out.add(list[i].id); }
  }
  return out;
}

// ---- Settings ----

export function addCategory(state) {
  const c = { id: uid(), name: 'New category', color: PALETTE[state.categories.length % 7], target: 0, tracked: true };
  state.categories.push(c);
  return c;
}
export const categoryUsed = (state, id) => DAYS.some((k) => state.schedule[k].some((b) => b.cat === id));
export function deleteCategory(state, id) {
  state.categories = state.categories.filter((c) => c.id !== id);
}

// Swap in the sample timetable, categories, workouts and cardio. Logs are kept.
export function loadSample(state) {
  state.categories = clone(SAMPLE.categories);
  state.schedule = clone(SAMPLE.schedule);
  state.workouts = clone(SAMPLE.workouts);
  state.cardio = clone(SAMPLE.cardio);
}

export const clearedState = (state) => ({ ...emptyState(), presetVersion: state.presetVersion });

// Is this parsed JSON a WeekGrid export?
export const isExport = (data) => Boolean(data && data.schedule && Array.isArray(data.categories));
export const hasHistory = (data) => Boolean(data?.logs && typeof data.logs === 'object' && Object.keys(data.logs).length > 0);

// Build the state after importing `data`. A timetable-only file keeps your history; a file with
// history replaces it only when `replaceHistory` is true. Older files without workouts or cardio keep yours.
export function importInto(current, data, { replaceHistory = true } = {}) {
  if (!isExport(data)) throw new Error('not a WeekGrid export');
  const d = clone(data);
  if (!replaceHistory) delete d.logs;
  const next = normalize(d);
  if (!Array.isArray(data.workouts)) next.workouts = clone(current.workouts);
  if (!data.cardio) next.cardio = clone(current.cardio);
  next.presetVersion = current.presetVersion;
  if (!Object.keys(next.logs).length) next.logs = clone(current.logs);
  return next;
}
