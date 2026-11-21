// Offline app + install. Registers the service worker (production builds only),
// tells the page when a new version is waiting, and switches to it at a safe moment:
// straight away if the app is in the background, otherwise when you tap "Reload".
import { say } from './store.svelte.js';

export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const standalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

export const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const pwa = $state({
  supported: false,   // service workers available here
  offline: false,     // app files cached, opens without internet
  update: false,      // a newer version is downloaded and waiting
  checking: false,
  installable: false, // browser offered its install prompt
  installed: false,   // running as an installed app
  persisted: null,    // storage protected from automatic clearing (true/false/null = unknown)
  online: true
});

let reg = null;
let promptEvent = null;
let canSwitch = () => true; // overridden by the app: false while a timer or workout is live
let reloading = false;

export function setSafeCheck(fn) { canSwitch = fn; }

function applyUpdate() {
  const w = reg?.waiting;
  if (!w) return false;
  w.postMessage('skip');
  return true;
}

function announce() {
  pwa.update = true;
  // In the background and nothing running: switch quietly, the reload happens unseen.
  if (document.hidden && canSwitch()) { applyUpdate(); return; }
  say('New version ready', { action: 'Reload', run: updateNow, ms: 8000 });
}

function watch(r) {
  reg = r;
  if (r.waiting && navigator.serviceWorker.controller) announce();
  r.addEventListener('updatefound', () => {
    const w = r.installing;
    w?.addEventListener('statechange', () => {
      if (w.state !== 'installed') return;
      if (navigator.serviceWorker.controller) announce();
      else { pwa.offline = true; say('Ready to work offline'); } // first install
    });
  });
}

export function updateNow() {
  if (!applyUpdate()) location.reload();
}

export async function checkForUpdate() {
  if (!reg) return say('Updates work in the installed or hosted app');
  pwa.checking = true;
  try {
    await reg.update();
    if (!reg.installing && !reg.waiting) say('You have the latest version');
  } catch (e) { say('Could not check (offline?)'); }
  finally { pwa.checking = false; }
}

export async function install() {
  if (!promptEvent) return;
  promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  promptEvent = null;
  pwa.installable = false;
  if (outcome === 'accepted') say('Installed');
}

async function persist() {
  const s = navigator.storage;
  if (!s?.persist) return;
  try { pwa.persisted = (await s.persisted()) || (await s.persist()); } catch (e) { pwa.persisted = false; }
}

export function startPwa({ register = import.meta.env.PROD } = {}) {
  pwa.installed = standalone();
  pwa.online = navigator.onLine !== false;
  addEventListener('online', () => { pwa.online = true; });
  addEventListener('offline', () => { pwa.online = false; });
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptEvent = e; pwa.installable = true; });
  addEventListener('appinstalled', () => { pwa.installed = true; pwa.installable = false; promptEvent = null; });
  persist();

  const sw = navigator.serviceWorker;
  pwa.supported = !!sw && location.protocol.startsWith('http');
  if (!pwa.supported || !register) return;

  sw.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  // A waiting version is applied the next time the app goes to the background, if it is safe then.
  document.addEventListener('visibilitychange', () => { if (document.hidden && pwa.update && canSwitch()) applyUpdate(); });

  sw.register('./sw.js').then((r) => {
    pwa.offline = !!r.active;
    watch(r);
    // Installed apps can stay open for days: look for a new version every hour and on return.
    setInterval(() => r.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); });
  }).catch(() => {});
}
