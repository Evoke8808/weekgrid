// Cards lean toward the pointer on laptops. Skipped on touch screens and with reduced motion.
import { reduced, lite } from './motion.js';
import { ui } from './store.svelte.js';

const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;

export function installTilt() {
  if (reduced() || !mq('(hover: hover) and (pointer: fine)')) return () => {};
  const SEL = '.block:not(.fixed), .extra-card, .tile, .panel, .fig, .mach';
  let cur = null;
  const reset = () => { if (!cur) return; cur.classList.remove('leaning'); cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); cur.style.removeProperty('--tz'); };
  const move = (e) => {
    const el = e.target.closest?.(SEL);
    if (cur && cur !== el) reset();
    cur = el;
    if (!el) return;
    el.classList.add('tilt', 'leaning');
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    const k = r.width > 400 ? 3 : 9; // big panels lean less
    el.style.setProperty('--ry', `${x * k}deg`);
    el.style.setProperty('--rx', `${-y * k}deg`);
    el.style.setProperty('--tz', '8px');
  };
  const leave = () => { reset(); cur = null; };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerleave', leave);
  return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
}

// Phone: the page leans a little as the phone tilts. Off with reduced motion and while typing.
export function installGyro(main) {
  if (reduced() || lite() || mq('(hover: hover) and (pointer: fine)') || !('DeviceOrientationEvent' in window)) return () => {};
  let base = null, raf = 0, gx = 0, gy = 0;
  const on = (e) => {
    if (e.beta === null || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || ui.gym) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    base.b += (e.beta - base.b) * 0.02; base.g += (e.gamma - base.g) * 0.02; // slowly re-centre on how it is held
    gx = Math.max(-4, Math.min(4, -(e.beta - base.b) * 0.25));
    gy = Math.max(-4, Math.min(4, (e.gamma - base.g) * 0.25));
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; main.classList.add('gyro'); main.style.setProperty('--gx', `${gx}deg`); main.style.setProperty('--gy', `${gy}deg`); });
  };
  addEventListener('deviceorientation', on);
  return () => removeEventListener('deviceorientation', on);
}
