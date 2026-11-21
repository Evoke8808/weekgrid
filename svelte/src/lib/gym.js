// Workout and cardio logic (pure: state in, results out). Saved shape matches the original app:
// logs[day].gym[exerciseKey] = [{ kg, reps, at }], logs[day].extra = [{ name, sets, reps }],
// logs[day].sessions[gymId] = { start, end }, logs[day].cardio = { machine, name, mode, goal, secs, status }.
import { DAYS } from './constants.js';
import { hours, dayKeyOf } from './dates.js';
import { uid, blocksOn, workoutFor, logFor, ensureLog } from './model.js';

export const KG_STEP = 2.5;
export const SLACK = 60; // seconds beyond the chosen rest before a gap counts as slow
export const REST_CHOICES = [60, 90, 120];
export const PACK_DEFAULT = ['Water bottle', 'Towel', 'Phone', 'Earphones', 'Keys', 'Wallet or ID card', 'Locker emptied'];

export const exKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
export const mins = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : mmss(Math.max(0, Math.round(s))));
export const fmtKg = (v) => (v === '' || v === undefined || v === null ? '–' : `${+v} kg`);
export const restLen = (state) => Number(state.settings.rest) || 90;
export const packList = (state) => (Array.isArray(state.settings.pack) ? state.settings.pack : PACK_DEFAULT);

export function parseReps(s) {
  const nums = String(s || '').match(/\d+(\.\d+)?/g) || [];
  return { target: nums.length ? Number(nums[nums.length - 1]) : null, unit: /sec|\bs\b/i.test(s) ? 's' : 'reps' };
}

export const gymLog = (state, dIso) => logFor(state, dIso).gym || {};
export const filled = (s) => s && s.reps !== undefined && s.reps !== '' && s.reps !== null;
export const planned = (ex) => Number(ex.sets) || 1;

export function setsFor(state, dIso, key, n) {
  const arr = gymLog(state, dIso)[key] || [];
  return Array.from({ length: Math.max(n, arr.length) }, (_, i) => arr[i] || {});
}

export function lastSession(state, key, beforeIso) {
  const dates = Object.keys(state.logs).filter((d) => d < beforeIso && (state.logs[d].gym?.[key] || []).some(filled)).sort();
  const d = dates[dates.length - 1];
  return d ? { date: d, sets: state.logs[d].gym[key].filter(filled) } : null;
}

export function suggestion(ex, last) {
  const { target, unit } = parseReps(ex.reps);
  if (!last) return null;
  const top = Math.max(0, ...last.sets.map((s) => Number(s.kg) || 0));
  const hit = target && last.sets.length >= Number(ex.sets) && last.sets.every((s) => Number(s.reps) >= target);
  if (unit === 's') return hit ? `Hold ${target + 5} s this time` : `Aim for ${target} s on every set`;
  if (!top) return hit ? 'You hit every set. Add weight or reps' : `Aim for ${target} reps on every set`;
  return hit ? `Try ${+(top + KG_STEP).toFixed(2)} kg` : `Stay at ${top} kg until you hit ${target} on every set`;
}

export function exStatus(state, dIso, ex) {
  const key = exKey(ex.name);
  const done = setsFor(state, dIso, key, planned(ex)).filter(filled).length;
  return { done, total: Math.max(planned(ex), (gymLog(state, dIso)[key] || []).length) };
}

// What a sheet shows: a gym block's workout plus today's extra exercises, or just the extras ('free').
export function sheetCtx(state, dIso, gymId, today) {
  const b = gymId === 'free' ? null : blocksOn(state, dIso, today).find((x) => x.id === gymId);
  const w = b ? workoutFor(state, b) : null;
  if (gymId !== 'free' && !w) return null;
  const extra = (logFor(state, dIso).extra || []).map((x) => ({ ...x, extra: true }));
  return { b, name: w ? w.name : 'Extra workout', exercises: [...(w ? w.exercises : []), ...extra] };
}

export function progress(state, dIso, ctx) {
  let done = 0, total = 0;
  for (const ex of ctx.exercises) { total += planned(ex); done += Math.min(exStatus(state, dIso, ex).done, planned(ex)); }
  return { done, total };
}

export function startSession(state, dIso, sesKey, now = Date.now()) {
  const log = ensureLog(state, dIso);
  if (!log.sessions) log.sessions = {};
  if (!log.sessions[sesKey]) log.sessions[sesKey] = { start: now };
}

// Write one field of one set. The moment a set's reps are first entered is when it was done.
export function gymWrite(state, dIso, key, j, field, value, { sesKey, now = Date.now() } = {}) {
  const log = ensureLog(state, dIso);
  if (!log.gym) log.gym = {};
  if (!log.gym[key]) log.gym[key] = [];
  const arr = log.gym[key];
  while (arr.length <= j) arr.push({});
  arr[j] = { ...arr[j], [field]: value };
  if (field === 'reps' && value !== '' && !arr[j].at && sesKey) { startSession(state, dIso, sesKey, now); arr[j].at = now; }
  if (field === 'reps' && value === '') delete arr[j].at;
}

export function deleteSet(state, dIso, key, j) {
  const arr = state.logs[dIso]?.gym?.[key];
  if (arr) arr.splice(j, 1);
}

export function addExtra(state, dIso, name, sets, reps) {
  const log = ensureLog(state, dIso);
  if (!log.extra) log.extra = [];
  log.extra.push({ name, sets: Math.max(1, Number(sets) || 3), reps: String(reps || '').trim() || '10' });
}

export function removeExtra(state, dIso, key) {
  const log = state.logs[dIso];
  if (!log) return;
  log.extra = (log.extra || []).filter((x) => exKey(x.name) !== key);
  if (log.gym) delete log.gym[key];
}

export function knownExercises(state) {
  return [...new Set([...(state.workouts || []).flatMap((x) => x.exercises.map((y) => y.name)), ...Object.values(state.logs).flatMap((l) => (l.extra || []).map((y) => y.name))])].filter(Boolean).sort();
}

// ---- Session pace ----
export const sessionOf = (state, dIso, sesKey) => logFor(state, dIso).sessions?.[sesKey] || null;

// Every logged set in this workout, in the order it was done, with the gap before each.
export function gaps(state, dIso, ctx, sesKey) {
  const ses = sessionOf(state, dIso, sesKey);
  const g = gymLog(state, dIso);
  const tl = [];
  for (const ex of ctx.exercises) (g[exKey(ex.name)] || []).forEach((s, j) => { if (filled(s) && s.at) tl.push({ key: exKey(ex.name), j, at: s.at }); });
  tl.sort((a, b) => a.at - b.at);
  const m = {};
  tl.forEach((x, i) => { m[`${x.key}|${x.j}`] = (x.at - (i ? tl[i - 1].at : ses?.start || x.at)) / 1000; });
  return { tl, m };
}

export function paceInfo(state, dIso, ctx, sesKey, now = Date.now()) {
  const ses = sessionOf(state, dIso, sesKey);
  if (!ctx || !ses) return null;
  const allotted = ctx.b ? hours(ctx.b) * 3600 : 0;
  const elapsed = ((ses.end || now) - ses.start) / 1000;
  const { tl, m } = gaps(state, dIso, ctx, sesKey);
  const total = ctx.exercises.reduce((a, ex) => a + Math.max(planned(ex), (gymLog(state, dIso)[exKey(ex.name)] || []).length), 0);
  const left = Math.max(0, total - tl.length);
  const avg = tl.length ? (tl[tl.length - 1].at - ses.start) / 1000 / tl.length : 0;
  const projected = tl.length ? elapsed + left * avg : 0;
  const rest = restLen(state);
  const slow = Object.values(m).filter((g, i) => i > 0 && g > rest + SLACK);
  const wasted = slow.reduce((a, g) => a + (g - rest), 0);
  return { allotted, elapsed, avg, projected, left, done: tl.length, wasted, slowN: slow.length, ended: Boolean(ses.end) };
}

export function paceStatus(p) {
  const over = p.allotted && p.elapsed > p.allotted;
  const willOver = p.allotted && !p.ended && p.done >= 2 && p.projected > p.allotted;
  const text = p.ended ? (over ? `Finished ${mins(p.elapsed - p.allotted)} over your slot` : `Finished with ${mins(p.allotted - p.elapsed)} to spare`)
    : over ? `${mins(p.elapsed - p.allotted)} over your slot`
    : willOver ? `At this pace you finish ${mins(p.projected - p.allotted)} late`
    : p.done >= 2 && p.allotted ? `On pace, about ${mins(p.allotted - p.projected)} to spare` : 'Pace shows after two sets';
  return { cls: over ? 'over' : willOver ? 'warn' : 'ok', text };
}

// ---- Cardio ----
export const machineOf = (state, id) => state.cardio.machines.find((m) => m.id === id);
export const cardioPlan = (state, dIso) => state.cardio.plan[dayKeyOf(dIso)] || null;
export const cardioStatus = (secs, goal) => (secs >= goal - 1 ? 'done' : secs >= goal / 2 ? 'partial' : 'missed');

// A fresh (not started) timer session for a day: saved machine, else that day's recommendation, else the first.
export function newCardio(state, dIso) {
  const saved = logFor(state, dIso).cardio;
  const plan = cardioPlan(state, dIso);
  const m = machineOf(state, saved?.machine) || machineOf(state, plan?.machine) || state.cardio.machines[0];
  return { date: dIso, machine: m?.id, goal: Math.max(60, Math.round((Number(plan?.min) || 10) * 60)), custom: false, running: false, startedAt: 0, acc: 0, rang: false };
}

export function saveCardioLog(state, s, secs) {
  const m = machineOf(state, s.machine);
  const log = ensureLog(state, s.date);
  log.cardio = { machine: s.machine, name: m?.name || 'Cardio', mode: m?.mode || 'up', goal: s.goal, secs: Math.round(secs), status: cardioStatus(secs, s.goal) };
  return log.cardio;
}

// ---- Settings editors ----
export const addMachine = (state) => state.cardio.machines.push({ id: uid(), name: 'New machine', mode: 'up' });
export function deleteMachine(state, i) {
  const gone = state.cardio.machines.splice(i, 1)[0];
  if (gone) for (const k of DAYS) if (state.cardio.plan[k]?.machine === gone.id) delete state.cardio.plan[k];
}
export function setPlanMachine(state, k, id) {
  if (id) state.cardio.plan[k] = { machine: id, min: Number(state.cardio.plan[k]?.min) || 10 };
  else delete state.cardio.plan[k];
}
export function setPlanMinutes(state, k, v) {
  if (state.cardio.plan[k]) state.cardio.plan[k].min = Math.min(180, Math.max(1, Number(v) || 10));
}
export function addWorkout(state) {
  if (!state.workouts) state.workouts = [];
  state.workouts.push({ id: uid(), name: 'New workout', exercises: [] });
}
