// One-off visual effects drawn into the #fx layer.
import { palette } from './theme.svelte.js';
import { reduced, rand } from './motion.js';

const layer = () => document.getElementById('fx');

export function burst(el, color) {
  const fx = layer();
  if (reduced() || !el || !fx) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('i');
    const ang = (Math.PI * 2 * i) / 16 + rand(-0.2, 0.2);
    const dist = rand(34, 90);
    s.className = 'spark';
    s.style.cssText = `left:${r.left + r.width / 2 - 4}px;top:${r.top + r.height / 2 - 4}px;--c:${i % 3 ? color : palette()[i % 7]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px`;
    fx.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

export function confetti() {
  const fx = layer();
  if (reduced() || !fx) return;
  for (let i = 0; i < 110; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.cssText = `left:${rand(0, 100)}vw;--c:${palette()[i % 7]};--dx:${rand(-120, 120)}px;--r:${rand(-900, 900)}deg;--t:${rand(1.6, 3.2)}s;--dl:${rand(0, 0.6)}s`;
    fx.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

// Restart a CSS animation class on an element (remove, reflow, add).
export function replay(el, cls, ms = 900) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
