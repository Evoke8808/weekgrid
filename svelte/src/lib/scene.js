// Background: the last eight weeks as a slowly turning 3D bar grid, one bar per day,
// height = that day's score. Ported unchanged from the original canvas code.
import { DAYS } from './constants.js';
import { dayColor } from './theme.svelte.js';
import { iso, addDays, mondayOf, todayIso } from './dates.js';
import { dayStats, counts, clock } from './stats.js';
import { store, ui } from './store.svelte.js';
import { reduced, lite } from './motion.js';

const W = 7, H = 8, GAP = 1.25;
let cv, ctx, cells = [], dpr = 1, w = 0, h = 0, t0 = 0, mx = 0, my = 0, tx = 0, ty = 0, focus = null, pulse = 0, raf = 0, last = 0;
const hex = (c) => { const m = /#?([0-9a-f]{6})/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return [n >> 16, (n >> 8) & 255, n & 255]; };

function data() {
  const at = clock();
  const cur = mondayOf(new Date());
  const prev = cells;
  cells = [];
  for (let r = 0; r < H; r++) {
    const wk = addDays(cur, -7 * (H - 1 - r));
    for (let c = 0; c < W; c++) {
      const dIso = iso(addDays(wk, c));
      const s = counts(store.data, dIso, at) ? dayStats(store.data, dIso, at) : null;
      const v = s && s.pct !== null ? (dIso === at.today ? s.soFar ?? 0 : s.pct) / 100 : -1;
      const old = prev.find((x) => x.dIso === dIso);
      cells.push({ dIso, c, r, v, h: old ? old.h : 0, rgb: hex(dayColor(DAYS[c])) });
    }
  }
}
function size() {
  dpr = lite() ? 1 : Math.min(2, window.devicePixelRatio || 1);
  w = innerWidth; h = innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
}
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || ui.gym || now - (last) < (lite() ? 66 : 31)) return; // 30 fps, 15 on lite; paused under a workout
    last = now;
    const t = (now - t0) / 1000;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    pulse *= 0.94;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const yaw = -0.62 + Math.sin(t * 0.12) * 0.22 + mx * 0.35;
    const pitch = 0.78 + my * 0.12;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = Math.min(w * 0.075, h * 0.06);
    const ox = w * 0.5, oy = h * 0.62;
    const P = (x, y, z) => {
      x -= (W - 1) * GAP / 2; z -= (H - 1) * GAP / 2;
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const f = 9 / (9 + z2);
      return [ox + x1 * scale * f, oy - y1 * scale * f, z2];
    };
    const list = cells.map((k) => {
      const target = k.v < 0 ? 0.06 : 0.12 + k.v * 2.6 + (k.dIso === focus ? pulse * 1.2 : 0);
      k.h += (target - k.h) * 0.06;
      const x = k.c * GAP, z = k.r * GAP;
      return { k, d: P(x + 0.5, 0, z + 0.5)[2] };
    }).sort((a, b) => b.d - a.d);
    const today = todayIso();
    for (const { k } of list) {
      const x = k.c * GAP, z = k.r * GAP, s = 1, y = k.h;
      const v = [P(x, 0, z), P(x + s, 0, z), P(x + s, 0, z + s), P(x, 0, z + s), P(x, y, z), P(x + s, y, z), P(x + s, y, z + s), P(x, y, z + s)];
      const [r, g, b] = k.v < 0 ? [60, 60, 60] : k.rgb;
      const a = k.v < 0 ? 0.35 : 0.35 + k.v * 0.65;
      const face = (idx, light) => {
        ctx.beginPath();
        idx.forEach((i, j) => (j ? ctx.lineTo(v[i][0], v[i][1]) : ctx.moveTo(v[i][0], v[i][1])));
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.round(r * light)},${Math.round(g * light)},${Math.round(b * light)},${a})`;
        ctx.fill();
      };
      // draw the sides facing the camera, then the top
      const sides = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      sides.map((f, i) => ({ f, i, z: (v[f[0]][2] + v[f[1]][2]) / 2 })).sort((p, q) => q.z - p.z).slice(2)
        .forEach(({ f, i }) => face(f, i % 2 ? 0.42 : 0.6));
      face([4, 5, 6, 7], 1);
      if (k.v >= 0.7 || k.dIso === today) {
        ctx.save();
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur = 18 + (k.dIso === focus ? pulse * 40 : 0);
        ctx.strokeStyle = k.dIso === today ? 'rgba(255,255,255,0.85)' : `rgba(${r},${g},${b},0.9)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        [4, 5, 6, 7].forEach((i, j) => (j ? ctx.lineTo(v[i][0], v[i][1]) : ctx.moveTo(v[i][0], v[i][1])));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
const onPointer = (e) => { tx = e.clientX / w - 0.5; ty = e.clientY / h - 0.5; };
const onTilt = (e) => { if (e.gamma !== null) { tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60)); ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90)); } };

// Mount on a canvas; returns a cleanup function.
export function startScene(canvas) {
  cv = canvas;
  ctx = cv.getContext('2d');
  if (!ctx) return () => {};
  t0 = performance.now();
  size(); data();
  addEventListener('resize', size);
  addEventListener('pointermove', onPointer);
  addEventListener('deviceorientation', onTilt);
  if (reduced()) frame(performance.now()), cancelAnimationFrame(raf);
  else raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', size);
    removeEventListener('pointermove', onPointer);
    removeEventListener('deviceorientation', onTilt);
    ctx = null;
  };
}

// Re-read scores; with a date, that day's bar pulses.
export function refreshScene(dIso) {
  if (!ctx) return;
  data();
  if (dIso) { focus = dIso; pulse = 1; }
  if (reduced()) frame(performance.now()), cancelAnimationFrame(raf);
}
