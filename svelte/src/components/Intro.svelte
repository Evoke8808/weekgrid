<script>
  // Welcome sequence on open: the grid assembles, the name lands, then the curtain lifts.
  import { DAYS } from '../lib/constants.js';
  import { dayColor } from '../lib/theme.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { dayStats, clock } from '../lib/stats.js';
  import { store, ui } from '../lib/store.svelte.js';

  let { ondone } = $props();

  const now = new Date();
  const h = now.getHours();
  const hi = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const at = clock();
  const st = dayStats(store.data, at.today, at);
  const left = st.count - st.marked;
  const sub = st.count === 0 ? 'Nothing on the grid today' : left === 0 ? 'Every block is marked' : `${left} ${left === 1 ? 'block' : 'blocks'} waiting on the grid`;

  const cells = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    const dist = Math.hypot(c - 3, r - 2);
    cells.push({ d: dayColor(DAYS[c]), dl: Math.round(dist * 90), o: (0.25 + ((c * 7 + r * 13) % 10) / 13).toFixed(2) });
  }

  let out = $state(false);
  ui.wipe = 'wipe-hold';
  ui.busy = true;

  function leave() {
    if (out) return;
    out = true;
    ui.enter++;
    ui.wipe = 'wipe-out';
    setTimeout(() => { ui.wipe = ''; ui.busy = false; ondone(); }, 900);
  }

  $effect(() => {
    const t = setTimeout(leave, 3300);
    return () => clearTimeout(t);
  });
</script>

<svelte:document onkeydown={leave} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="intro" class:out onclick={leave}>
  <div class="i-grid">
    {#each cells as c}<i style:--d={c.d} style:--dl="{c.dl}ms" style:--o={c.o}></i>{/each}
  </div>
  <div class="i-word">{#each 'WeekGrid' as ch, i}<span style:--i={i}>{ch}</span>{/each}</div>
  <div class="i-hi">{hi}</div>
  <div class="i-sub">{fmtDate(now)}. {sub}.</div>
</div>
