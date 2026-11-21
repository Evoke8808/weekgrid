// Page-level moves.
import { ui } from './store.svelte.js';
import { reduced } from './motion.js';

// Tab change: the page fades out with a slight drop, swaps, and the new page fades up.
export function wipe(swap) {
  if (reduced()) { swap(); ui.enter++; return; }
  if (ui.busy) return;
  ui.busy = true;
  ui.slide = 'fade-out';
  setTimeout(() => {
    swap();
    ui.enter++;
    ui.slide = 'fade-in';
    setTimeout(() => { ui.slide = ''; ui.busy = false; }, 420);
  }, 200);
}

export function goTo(view, change) {
  if (ui.busy || (view === ui.view && !change)) return;
  if (view === ui.view) { change(); ui.enter++; return; }
  wipe(() => { change?.(); ui.view = view; });
}

// Lighter move for stepping between days or weeks: old content leaves one way, new arrives from the other.
let sliding = false;
export function slide(dir, change) {
  if (reduced()) { change(); ui.enter++; return; }
  if (sliding || ui.busy) return;
  sliding = true;
  ui.slide = dir > 0 ? 'leave-l' : 'leave-r';
  setTimeout(() => {
    change();
    ui.enter++;
    ui.slide = dir > 0 ? 'from-r' : 'from-l';
    sliding = false;
    setTimeout(() => { if (!sliding) ui.slide = ''; }, 600);
  }, 180);
}
