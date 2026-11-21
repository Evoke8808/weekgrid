import { DAYS } from './constants.js';

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dayKey = (d) => DAYS[(d.getDay() + 6) % 7];
export const dayKeyOf = (dIso) => dayKey(fromIso(dIso));
export const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const todayIso = () => iso(new Date());
export const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

export const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
// Block length in hours; a block that ends past midnight wraps around.
export const hours = (b) => { let m = toMin(b.end) - toMin(b.start); if (m < 0) m += 1440; return m / 60; };
export const fmtH = (h) => (Math.round(h * 10) / 10).toString().replace(/\.0$/, '') + 'h';
export const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
export const shortDate = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
