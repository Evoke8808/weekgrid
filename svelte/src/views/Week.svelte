<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { DAYS, DAY_NAMES } from '../lib/constants.js';
  import { dayColor, catColor } from '../lib/theme.svelte.js';
  import { iso, fromIso, addDays, dayKey, mondayOf, fmtH, shortDate } from '../lib/dates.js';
  import { logFor } from '../lib/model.js';
  import { dayStats, weekStats, streak, counts, clock } from '../lib/stats.js';
  import { store, ui } from '../lib/store.svelte.js';
  import { slide, goTo } from '../lib/transitions.js';
  import { reduced } from '../lib/motion.js';

  const s = $derived(store.data);
  const at = $derived(clock());
  const start = $derived(fromIso(ui.week));
  const ws = $derived(weekStats(s, ui.week, at));
  const run = $derived(streak(s, at));
  const bestKey = $derived(ws.best ? dayKey(fromIso(ws.best.dIso)) : null);

  const opts = { duration: reduced() ? 0 : 650, easing: cubicOut };
  const avg = new Tween(0, opts);
  const runN = new Tween(0, opts);
  $effect(() => { avg.target = ws.avg; runN.target = run; });

  // Last 8 weeks, oldest at the top, one cell per day.
  const heat = $derived.by(() => {
    const cur = mondayOf(new Date());
    const rows = [];
    let ci = 0;
    for (let w = 7; w >= 0; w--) {
      const wk = addDays(cur, -7 * w);
      rows.push({
        label: shortDate(wk), cur: w === 0,
        cells: DAYS.map((k, i) => {
          const dIso = iso(addDays(wk, i));
          const ds = dayStats(s, dIso, at);
          const none = !counts(s, dIso, at) || ds.pct === null;
          return { k, dIso, none, pct: ds.pct, a: ds.pct ? Math.round(14 + ds.pct * 0.86) : 0, i: ci++ };
        })
      });
    }
    return rows;
  });

  const cats = $derived(s.categories.filter((c) => c.tracked !== false).map((c) => {
    const v = ws.byCat[c.id] || { done: 0, planned: 0 };
    const goal = Number(c.target) || v.planned;
    return { c, v, goal, pct: goal ? Math.min(100, Math.round((v.done / goal) * 100)) : 0 };
  }));

  const notes = $derived(ws.days.filter((d) => logFor(s, d.dIso).note.trim()).map((d) => ({ k: dayKey(fromIso(d.dIso)), text: logFor(s, d.dIso).note })));

  const step = (n) => slide(n, () => { ui.week = iso(addDays(start, 7 * n)); });
  const openDay = (dIso) => goTo('today', () => { ui.date = dIso; });

  function onKey(e) {
    if (ui.busy || ui.gym || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }
</script>

<svelte:document onkeydown={onKey} />

<div class="row space">
  <button class="nav-btn" onclick={() => step(-1)} aria-label="Previous week">‹</button>
  <h2>{shortDate(start)} to {shortDate(addDays(start, 6))}</h2>
  <button class="nav-btn" onclick={() => step(1)} aria-label="Next week">›</button>
</div>

<div class="figs">
  <div class="fig" style:--i="0"><div class="num"><span id="avg-num">{Math.round(avg.current)}</span>%</div><div class="label">average completion</div></div>
  <div class="fig" style:--i="1"><div class="num"><span id="streak-num">{Math.round(runN.current)}</span> 🔥</div><div class="label">day streak</div></div>
  <div class="fig" style:--i="2"><div class="num" style:color={bestKey ? dayColor(bestKey) : 'var(--dim)'}>{bestKey ? DAY_NAMES[bestKey].slice(0, 3) : 'None'}</div><div class="label">best day</div></div>
</div>

<h3>Day by day</h3>
<div class="panel" style:--i="3">
  <div class="bars">
    {#each ws.days as d, i (d.dIso)}
      {@const on = counts(s, d.dIso, at)}
      <button class="bar-col" class:today={d.dIso === at.today} onclick={() => openDay(d.dIso)} style:--d={dayColor(DAYS[i])} aria-label="Open {DAY_NAMES[DAYS[i]]}">
        <span class="pc">{d.pct === null || !on ? '' : `${d.pct}%`}</span>
        <span class="bar-track"><span class="bar" style:--h="{on ? d.pct || 0 : 0}%" style:--i={i}></span></span>
        <span class="lb">{DAY_NAMES[DAYS[i]].slice(0, 3)}</span>
      </button>
    {/each}
  </div>
</div>

<h3>Hours against your targets</h3>
<div class="panel" style:--i="4">
  {#each cats as { c, v, goal, pct }, i (c.id)}
    <div class="cat-row" style:--c={catColor(c.color)}>
      <div class="row space"><span class="cat-name">{c.name}</span><span class="cat-num"><b>{fmtH(v.done)}</b> of {fmtH(goal)}</span></div>
      <div class="cat-track"><div class="cat-fill" style:--w="{pct}%" style:--i={i}></div></div>
    </div>
  {:else}
    <div class="muted">No tracked categories yet. Add one in Settings.</div>
  {/each}
</div>

<h3>Last 8 weeks</h3>
<div class="panel" style:--i="5">
  <div class="heat">
    <span></span>
    {#each DAYS as k}<span class="hd" style:--d={dayColor(k)}>{DAY_NAMES[k][0]}</span>{/each}
    {#each heat as row (row.label)}
      <span class="wk" class:cur={row.cur}>{row.label}</span>
      {#each row.cells as c (c.dIso)}
        <button class="cell" class:none={c.none} class:is-today={c.dIso === at.today} onclick={() => openDay(c.dIso)}
          style:--d={dayColor(c.k)} style:--a={c.a} style:--i={c.i}
          title="{shortDate(fromIso(c.dIso))}{c.none ? '' : `: ${c.pct}%`}" aria-label="{shortDate(fromIso(c.dIso))}{c.none ? '' : `: ${c.pct}%`}"></button>
      {/each}
    {/each}
  </div>
</div>

<h3>Notes this week</h3>
<div class="panel" style:--i="6">
  {#each notes as n}
    <div class="note-line"><b style:--d={dayColor(n.k)}>{DAY_NAMES[n.k].slice(0, 3)}</b>{n.text}</div>
  {:else}
    <div class="muted small">No notes yet. Write one on the Today tab.</div>
  {/each}
</div>

<p class="muted small">A day counts toward the streak at {s.settings.threshold}% or more. A partial block earns half credit.</p>
