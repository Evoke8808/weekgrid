// The one reactive store. `store.data` is the saved state (same JSON as the old app);
// `ui` is everything about what's on screen. Components read and mutate these directly.
import { STORE_KEY } from './constants.js';
import { parseStored, freezePast, applyPreset, normalize } from './model.js';
import { iso, mondayOf, dayKey, todayIso } from './dates.js';

const readRaw = () => { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } };

export const store = $state({ data: parseStored(readRaw()) });

export const ui = $state({
  view: 'today',
  date: todayIso(),
  week: iso(mondayOf(new Date())),
  editDay: dayKey(new Date()),
  enter: 0, // bumped to replay a view's entrance animation
  busy: false,
  slide: '', // day/week slide class on the view
  gym: null // open workout (later part)
});

export const toast = $state({ text: '', show: false, action: '', run: null });
let toastTimer;
// say('Saved') or say('New version ready', { action: 'Reload', run: fn, ms: 8000 })
export function say(text, { action = '', run = null, ms = 1800 } = {}) {
  toast.text = text;
  toast.action = action;
  toast.run = run;
  toast.show = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.show = false; }, ms);
}
export function toastAction() {
  const fn = toast.run;
  toast.show = false;
  fn?.();
}

// ---- "Last changed" stamps, used by sync to merge day by day (newest wins) ----
const shadow = { logs: {}, meta: '', ready: false };
const metaJson = (s) => JSON.stringify([s.categories, s.schedule, s.workouts, s.settings, s.cardio]);
const logJson = (log) => { const { t, ...rest } = log; return JSON.stringify(rest); };
export function rebuildShadow() {
  const s = store.data;
  shadow.logs = Object.fromEntries(Object.entries(s.logs).map(([d, log]) => [d, logJson(log)]));
  shadow.meta = metaJson(s);
  shadow.ready = true;
}
function stamp() {
  const s = store.data;
  const now = Date.now();
  for (const [d, log] of Object.entries(s.logs)) {
    const j = logJson(log);
    if (shadow.logs[d] !== j) { if (shadow.ready) log.t = now; shadow.logs[d] = j; }
  }
  const m = metaJson(s);
  if (shadow.meta !== m) { if (shadow.ready) s.metaT = now; shadow.meta = m; }
}

const saveHooks = new Set();
export const onSave = (fn) => { saveHooks.add(fn); return () => saveHooks.delete(fn); }; // sync listens here

export function save() {
  stamp();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store.data)); }
  catch (e) { say('Could not save (storage blocked)'); }
  for (const fn of saveHooks) fn();
}

// Take in data merged by sync: stored as is, without new "last changed" stamps or save hooks
// (so it does not bounce straight back to the server).
export function adopt(next) {
  store.data = normalize(next);
  rebuildShadow();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store.data)); }
  catch (e) { say('Could not save (storage blocked)'); }
}

// Swap in a whole new state (import, reset).
export function replace(next) {
  store.data = normalize(next);
  save();
}

// Startup: same order as the original app.
export function boot() {
  rebuildShadow();
  save();
  if (freezePast(store.data, todayIso())) save();
  if (applyPreset(store.data, globalThis.WEEKGRID_PRESET)) save();
}

// Called on focus and every minute: when the date changes, move "today" forward and freeze yesterday.
let dayShown = todayIso();
export function rollover() {
  const today = todayIso();
  if (today === dayShown || ui.gym) return false; // never switch days under an open workout
  if (ui.date === dayShown) ui.date = today; // was following "today": keep following it
  ui.week = iso(mondayOf(new Date()));
  dayShown = today;
  if (freezePast(store.data, today)) save();
  return true;
}
