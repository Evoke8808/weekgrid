// Scoring. `at` = { today: 'YYYY-MM-DD', now: minutes since midnight } so results are testable.
import { DAYS, SCORE } from './constants.js';
import { iso, fromIso, addDays, hours, toMin, todayIso, nowMin } from './dates.js';
import { blocksOn, isTracked, logFor, cardioReq, firstLogOf } from './model.js';

export const clock = () => ({ today: todayIso(), now: nowMin() });

// Days before you started logging (and future days) are left blank, not scored as zero.
export function counts(state, dIso, at = clock()) {
  const first = firstLogOf(state);
  return Boolean(first) && dIso >= first && dIso <= at.today;
}

export function dayStats(state, dIso, at = clock()) {
  const blocks = blocksOn(state, dIso, at.today).filter((b) => isTracked(state, b));
  const log = logFor(state, dIso);
  const marks = log.marks || {};
  let score = 0;
  const byCat = {};
  for (const b of blocks) {
    const s = SCORE[marks[b.id]] ?? 0;
    score += s;
    byCat[b.cat] = byCat[b.cat] || { done: 0, planned: 0 };
    byCat[b.cat].planned += hours(b);
    byCat[b.cat].done += hours(b) * s;
  }
  const cardio = cardioReq(state, dIso, at.today);
  const cs = log.cardio?.status;
  let count = blocks.length, marked = blocks.filter((b) => marks[b.id]).length;
  if (cardio) { count++; score += SCORE[cs] ?? 0; if (cs) marked++; }
  const pct = count ? Math.round((score / count) * 100) : null;
  // "So far" score: today, blocks that have not ended yet are not held against you.
  let soFar = pct;
  if (dIso === at.today) {
    const due = blocks.filter((b) => marks[b.id] || (toMin(b.end) >= toMin(b.start) && toMin(b.end) <= at.now));
    const n = due.length + (cardio && cs ? 1 : 0);
    soFar = n ? Math.round(((due.reduce((a, b) => a + (SCORE[marks[b.id]] ?? 0), 0) + (cardio && cs ? SCORE[cs] : 0)) / n) * 100) : null;
  }
  return { pct, soFar, byCat, count, marked, cardio };
}

export function streak(state, at = clock()) {
  const th = Number(state.settings.threshold) || 70;
  let d = fromIso(at.today);
  let n = 0;
  const today = dayStats(state, iso(d), at);
  if (today.pct === null || today.pct < th) d = addDays(d, -1); // today still in progress
  for (let i = 0; i < 365; i++) {
    const s = dayStats(state, iso(d), at);
    if (s.pct === null) { d = addDays(d, -1); continue; } // nothing tracked that day: skip
    if (s.pct >= th) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}

export function weekStats(state, mondayIso, at = clock()) {
  const start = fromIso(mondayIso);
  const days = DAYS.map((_, i) => { const dIso = iso(addDays(start, i)); return { dIso, ...dayStats(state, dIso, at) }; });
  const byCat = {};
  for (const d of days) {
    for (const [cat, v] of Object.entries(d.byCat)) {
      byCat[cat] = byCat[cat] || { done: 0, planned: 0 };
      byCat[cat].done += v.done;
      byCat[cat].planned += v.planned;
    }
  }
  const scored = days.filter((d) => d.soFar !== null && counts(state, d.dIso, at));
  const avg = scored.length ? Math.round(scored.reduce((a, d) => a + d.soFar, 0) / scored.length) : 0;
  const best = scored.reduce((b, d) => (d.soFar > 0 && (!b || d.soFar > b.soFar) ? d : b), null);
  return { days, byCat, avg, best };
}
