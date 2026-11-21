// @vitest-environment jsdom
// Update flow with a fake service worker registration.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';

function fakeSw() {
  const ev = new EventTarget();
  const reg = new EventTarget();
  reg.active = {}; reg.waiting = null; reg.installing = null;
  reg.update = vi.fn(async () => {});
  const sw = Object.assign(ev, { controller: {}, register: vi.fn(async () => reg) });
  return { sw, reg };
}

function newWorker(reg) {
  const w = new EventTarget();
  w.state = 'installing';
  w.postMessage = vi.fn();
  reg.installing = w;
  reg.dispatchEvent(new Event('updatefound'));
  w.state = 'installed'; reg.installing = null; reg.waiting = w;
  w.dispatchEvent(new Event('statechange'));
  return w;
}

let hidden = false;
beforeEach(() => {
  vi.resetModules();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
});

async function start(safe = () => true) {
  const { sw, reg } = fakeSw();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
  const mod = await import('./lib/pwa.svelte.js');
  const store = await import('./lib/store.svelte.js');
  mod.setSafeCheck(safe);
  mod.startPwa({ register: true });
  await Promise.resolve(); await Promise.resolve();
  return { ...mod, ...store, reg };
}

describe('pwa updates', () => {
  it('asks before switching while the app is on screen', async () => {
    const { pwa, toast, reg, toastAction } = await start();
    const w = newWorker(reg);
    flushSync();
    expect(pwa.update).toBe(true);
    expect(toast.action).toBe('Reload');
    expect(w.postMessage).not.toHaveBeenCalled();
    toastAction();
    expect(w.postMessage).toHaveBeenCalledWith('skip');
  });

  it('switches quietly when hidden, but not during a workout or timer', async () => {
    let busy = true;
    const { reg } = await start(() => !busy);
    hidden = true;
    const w = newWorker(reg);
    expect(w.postMessage).not.toHaveBeenCalled(); // timer running
    busy = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(w.postMessage).toHaveBeenCalledWith('skip');
  });

  it('offers the install prompt when the browser allows it', async () => {
    const { pwa, install } = await start();
    const e = new Event('beforeinstallprompt');
    e.prompt = vi.fn(); e.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(e);
    expect(pwa.installable).toBe(true);
    await install();
    expect(e.prompt).toHaveBeenCalled();
    expect(pwa.installable).toBe(false);
  });
});
