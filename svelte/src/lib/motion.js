// Motion level, chosen per device: full, lite (phone friendly) or off. Phones start on lite.
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
export const isPhone = mq('(hover: none) and (pointer: coarse)');
export const motion = (() => { try { return localStorage.getItem('weekgrid:motion') || (isPhone ? 'lite' : 'full'); } catch (e) { return 'full'; } })();
export const reduced = () => motion === 'off' || mq('(prefers-reduced-motion: reduce)');
export const lite = () => motion === 'lite';
export const rand = (a, b) => a + Math.random() * (b - a);

export function setMotion(level) {
  if (level === motion) return;
  try { localStorage.setItem('weekgrid:motion', level); } catch (e) { /* storage blocked */ }
  location.reload(); // simplest way to start every effect from the new level
}
