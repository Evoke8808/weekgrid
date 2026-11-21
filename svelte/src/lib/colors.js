// Soften any category colour so saturated picks still sit quietly on black.
export function tone(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#9a9a9a';
  const n = parseInt(m[1], 16);
  const mix = (v) => Math.round(v * 0.62 + 190 * 0.38);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
export const CARDIO_COLOR = '#8fc4d6';
