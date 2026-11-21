// Merging this device's data with the synced copy (pure, no storage or network).
// The timetable side (categories, schedule, workouts, settings, cardio) and each day's log carry a
// "last changed" time (metaT, log.t); the newer side wins, one day at a time.
import { normalize, clone } from './model.js';

const META = ['categories', 'schedule', 'workouts', 'settings', 'cardio'];
const metaOf = (s) => JSON.stringify(META.map((k) => s[k]));
const bare = (log) => { const { t, ...rest } = log; return JSON.stringify(rest); };

// What gets uploaded: everything except device-only bits.
export function payload(state) {
  const { presetVersion, ...rest } = state;
  return clone(rest);
}

// Returns { state, pull, push }: the merged state, whether anything came from the synced copy,
// and whether this device has something the synced copy lacks.
// `first` = this device is joining: take the synced timetable and combine both histories.
export function merge(localState, remoteState, { first = false } = {}) {
  const out = clone(localState);
  const r = normalize(clone(remoteState));
  let pull = false, push = false;

  const lm = out.metaT || 0, rm = r.metaT || 0;
  if (first || rm > lm) {
    if (metaOf(out) !== metaOf(r) || lm !== rm) {
      for (const k of META) out[k] = r[k];
      out.metaT = rm || Date.now();
      pull = true;
    }
  } else if (lm > rm) push = true;

  for (const d of new Set([...Object.keys(out.logs), ...Object.keys(r.logs)])) {
    const l = out.logs[d], x = r.logs[d];
    if (!l) { out.logs[d] = x; pull = true; continue; }
    if (!x) { push = true; continue; }
    if (bare(l) === bare(x)) continue;
    const lt = l.t || 0, xt = x.t || 0;
    if (first) {
      // Two devices meeting for the first time: keep marks, sets and notes from both
      out.logs[d] = {
        ...l, ...x,
        marks: { ...l.marks, ...x.marks },
        ...(l.gym || x.gym ? { gym: { ...l.gym, ...x.gym } } : {}),
        note: x.note || l.note || '',
        t: Date.now()
      };
      pull = true; push = true;
    } else if (xt > lt) { out.logs[d] = x; pull = true; }
    else if (lt > xt) push = true;
    else { out.logs[d] = x; pull = true; } // same time, different content: settle on the synced copy
  }
  return { state: out, pull, push };
}

// Give older data a stamp so it can take part in merging.
export function stampAll(state) {
  if (!state.metaT) state.metaT = Date.now();
  for (const log of Object.values(state.logs)) if (!log.t) log.t = 1;
}
