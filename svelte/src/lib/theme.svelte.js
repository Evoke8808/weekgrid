// Colour themes. Only colours change between themes; motion is identical.
// 'color' = the original soft palette. 'mono' = black, white, grey, with red as the one accent.
import { DAY_COLORS, PALETTE, VIEWS } from './constants.js';
import { flushSync } from 'svelte';
import { tone, CARDIO_COLOR } from './colors.js';

const KEY = 'weekgrid:theme';
const RED = '#e5484d';
export const THEMES = [{ id: 'color', label: 'Colour' }, { id: 'mono', label: 'Mono' }];

const read = () => { try { return localStorage.getItem(KEY) === 'mono' ? 'mono' : 'color'; } catch (e) { return 'color'; } };
export const theme = $state({ name: read() });

const apply = () => { if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.name; };
apply();

export function setTheme(name) {
  theme.name = name === 'mono' ? 'mono' : 'color';
  try { localStorage.setItem(KEY, theme.name); } catch (e) { /* storage blocked */ }
  apply();
}

const mono = () => theme.name === 'mono';
const MONO_DAYS = { mon: '#f0f0f0', tue: '#c4c4c4', wed: '#f0f0f0', thu: '#c4c4c4', fri: '#f0f0f0', sat: '#c4c4c4', sun: '#f0f0f0' };

// Grey with the same lightness as the original colour, so categories stay tellable apart.
function grey(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#9a9a9a';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  const v = Math.round(110 + lum * 130); // 110..240: never too dark on black
  return `rgb(${v}, ${v}, ${v})`;
}

export const dayColor = (k) => (mono() ? MONO_DAYS[k] : DAY_COLORS[k]);
export const catColor = (hex) => (mono() ? grey(hex) : tone(hex));
export const inkColor = (view) => (mono() ? RED : VIEWS.find((v) => v.id === view)?.ink);
export const cardioColor = () => (mono() ? '#d6d6d6' : CARDIO_COLOR);
export const palette = () => (mono() ? ['#ffffff', '#bdbdbd', RED, '#8a8a8a', '#ffffff', RED, '#d6d6d6'] : PALETTE);

// Theme switch that spreads out from the button: the new colours are revealed inside a circle
// that grows from the button to the farthest corner, with a glowing line riding its edge.
export async function revealTheme(name, button, { reduced = false, after } = {}) {
  const r0 = button?.getBoundingClientRect();
  const x = r0 ? r0.left + r0.width / 2 : innerWidth - 40;
  const y = r0 ? r0.top + r0.height / 2 : 40;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const ms = 750;
  const easing = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const lineColor = name === 'mono' ? RED : '#86cfb0';
  const go = () => { setTheme(name); after?.(); };

  if (reduced) { go(); return; }

  // The edge line: a ring sized to the final circle, scaled from 0 in step with the reveal.
  const ring = document.createElement('div');
  ring.className = 'theme-ring';
  ring.style.cssText = `left:${x - R}px;top:${y - R}px;width:${2 * R}px;height:${2 * R}px;--ring:${lineColor}`;

  if (!document.startViewTransition) {
    // Older browsers: switch straight away, the line still sweeps out from the button.
    go();
    if (!ring.animate) return;
    document.body.appendChild(ring);
    ring.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms, easing }).finished
      .finally(() => ring.remove());
    return;
  }

  const vt = document.startViewTransition(() => {
    go();
    flushSync(); // the "after" snapshot must already show the new colours
    document.body.appendChild(ring); // exists only in the new state: its own layer above the page
  });
  await vt.ready;
  const opts = { duration: ms, easing, fill: 'both' };
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
    { ...opts, pseudoElement: '::view-transition-new(root)' }
  );
  document.documentElement.animate(
    { transform: ['scale(0)', 'scale(1)'] },
    { ...opts, pseudoElement: '::view-transition-new(theme-ring)' }
  );
  await vt.finished.catch(() => {});
  ring.remove();
}
