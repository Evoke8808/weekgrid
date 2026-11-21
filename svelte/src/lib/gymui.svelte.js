// The workout/cardio sheets and their timers. One shared 250 ms ticker drives the rest timer,
// the cardio timer and the session clock while any of them needs it.
import { ui, store, save, say } from './store.svelte.js';
import { setMark } from './model.js';
import { dayStats, clock } from './stats.js';
import { reduced } from './motion.js';
import { confetti } from './effects.js';
import { restLen, newCardio, saveCardioLog, machineOf, mmss } from './gym.js';

export const live = $state({ now: Date.now() });
export const rest = $state({ end: 0, total: 0, rang: false });
export const cardio = $state({ s: null }); // the live cardio timer session, if any
export const sheet = $state({ closing: false, openEx: null, backTo: null, pack: false });
export const bus = new EventTarget(); // 'marked' after "Mark gym done", so Today can play its effects

// ---------- ticker ----------
let ticker = null;
const needed = () => Boolean(ui.gym) || rest.end > 0 || Boolean(cardio.s?.running);
function tick() {
  live.now = Date.now();
  checkRest();
  checkCardio();
  if (!needed()) { clearInterval(ticker); ticker = null; }
}
export function wake() { live.now = Date.now(); if (!ticker) ticker = setInterval(tick, 250); }

// ---------- sound ----------
let audio = null;
function beepsAt(secs) {
  const out = [];
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    [0, 0.28, 0.56].forEach((off, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      const at = audio.currentTime + Math.max(0, secs) + off;
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(at); o.stop(at + 0.25);
      out.push(o);
    });
  } catch (e) { /* no sound: vibration and the screen still signal the end */ }
  return out;
}
const stopAll = (list) => { for (const o of list) { try { o.stop(); } catch (e) { /* already stopped */ } } list.length = 0; };

// ---------- rest timer (runs off a fixed end time, so it survives redraws and short sleeps) ----------
const restBeeps = [];
let rangTimer = null;
export const restRunning = () => rest.end > 0 && live.now < rest.end;
export function startRest(secs = restLen(store.data)) {
  clearTimeout(rangTimer);
  rest.rang = false;
  rest.end = Date.now() + secs * 1000;
  rest.total = secs;
  stopAll(restBeeps);
  restBeeps.push(...beepsAt(secs));
  wake();
}
export function stopRest() {
  rest.end = 0;
  rest.rang = false;
  clearTimeout(rangTimer);
  stopAll(restBeeps);
}
export function moreRest() {
  if (rest.end > Date.now()) {
    const left = (rest.end - Date.now()) / 1000 + 15;
    rest.end = Date.now() + left * 1000;
    rest.total = Math.max(rest.total, left);
    stopAll(restBeeps);
    restBeeps.push(...beepsAt(left));
  } else startRest(restLen(store.data) + 15);
}
export function setRestLen(s) {
  store.data.settings.rest = s;
  save();
  if (rest.end > Date.now()) startRest();
}
function checkRest() {
  if (rest.end > 0 && Date.now() >= rest.end) {
    rest.end = 0;
    restBeeps.length = 0;
    navigator.vibrate?.([220, 120, 220]);
    rest.rang = true;
    clearTimeout(rangTimer);
    rangTimer = setTimeout(() => { rest.rang = false; }, 2600);
  }
}

// ---------- cardio timer ----------
const cBeeps = [];
export const cardioElapsed = () => { const s = cardio.s; return s ? s.acc + (s.running ? (live.now - s.startedAt) / 1000 : 0) : 0; };

// The session the cardio sheet shows for the current day (a running one from another day stays).
export function cardioSession() {
  const s = cardio.s;
  if (s && (s.date === ui.date || cardioElapsed() > 0)) return s;
  cardio.s = newCardio(store.data, ui.date);
  return cardio.s;
}
export function toggleCardio() {
  const s = cardio.s;
  if (!s) return;
  live.now = Date.now();
  if (s.running) { s.acc = cardioElapsed(); s.running = false; stopAll(cBeeps); }
  else {
    s.running = true; s.startedAt = Date.now();
    stopAll(cBeeps);
    if (s.goal - s.acc > 0) cBeeps.push(...beepsAt(s.goal - s.acc));
    wake();
  }
}
export function resetCardio() { stopAll(cBeeps); cardio.s = null; }
export function saveCardio(secs) {
  const s = cardio.s;
  if (!s) return;
  const at = clock();
  const prev = dayStats(store.data, s.date, at).pct || 0;
  const log = saveCardioLog(store.data, s, secs);
  stopAll(cBeeps);
  cardio.s = null;
  save();
  const full = log.status === 'done';
  say(full ? `Cardio done: ${log.name} ${mmss(log.secs)}` : `Saved ${mmss(log.secs)} of ${mmss(log.goal)}`);
  if (ui.gym === 'cardio') closeGym();
  if (full && dayStats(store.data, s.date, at).pct === 100 && prev < 100) confetti();
}
function checkCardio() {
  const s = cardio.s;
  if (!s || s.rang) return;
  const el = cardioElapsed();
  if (el >= s.goal) {
    s.rang = true;
    navigator.vibrate?.([300, 120, 300, 120, 300]);
    if (machineOf(store.data, s.machine)?.mode === 'down') saveCardio(s.goal); // a countdown ends itself
  }
}

// ---------- the sheet ----------
export function openGym(id) {
  if (id === 'cardio') cardioSession();
  ui.gym = id;
  sheet.openEx = null;
  sheet.pack = false;
  document.body.classList.add('locked');
  try { history.pushState({ gym: true }, ''); } catch (e) { /* some browsers refuse on file:// */ }
  wake();
}
// From inside a workout: open cardio, and come back to the workout when it closes.
export function openCardioFrom(id) {
  sheet.backTo = id;
  cardioSession();
  ui.gym = 'cardio';
}
export function closeGym(fromBack = false) {
  if (ui.gym === 'cardio' && sheet.backTo) {
    if (cardio.s && cardioElapsed() === 0) cardio.s = null;
    ui.gym = sheet.backTo; sheet.backTo = null; return;
  }
  if (!ui.gym || sheet.closing) return;
  sheet.closing = true;
  if (ui.gym === 'cardio' && cardio.s && cardioElapsed() === 0) cardio.s = null; // nothing started: forget the choices
  if (!fromBack && history.state?.gym) { try { history.back(); } catch (e) { /* ignore */ } }
  stopRest();
  document.body.classList.remove('locked');
  setTimeout(() => { ui.gym = null; sheet.closing = false; sheet.pack = false; }, reduced() ? 0 : 280);
}

// "Mark gym done": mark the block, close, then let Today play the mark effects.
export function finishGym(id, dIso) {
  const at = clock();
  const prev = dayStats(store.data, dIso, at).pct || 0;
  if (store.data.logs[dIso]?.marks?.[id] !== 'done') { setMark(store.data, dIso, id, 'done'); save(); }
  closeGym();
  setTimeout(() => bus.dispatchEvent(new CustomEvent('marked', { detail: { id, status: 'done', prev } })), reduced() ? 0 : 320);
}
