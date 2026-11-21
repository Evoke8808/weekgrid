<script>
  import { tick } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { DAYS, DAY_NAMES } from '../lib/constants.js';
  import { dayColor, catColor, cardioColor } from '../lib/theme.svelte.js';
  import { iso, fromIso, addDays, dayKey, mondayOf, hours, fmtH } from '../lib/dates.js';
  import { blocksOn, catOf, isTracked, logFor, setMark, setNote, workoutFor } from '../lib/model.js';
  import { dayStats, streak, counts, clock } from '../lib/stats.js';
  import { store, ui, save } from '../lib/store.svelte.js';
  import { slide } from '../lib/transitions.js';
  import { burst, confetti, replay } from '../lib/effects.js';
  import { refreshScene } from '../lib/scene.js';
  import { reduced } from '../lib/motion.js';
  import { openGym, bus } from '../lib/gymui.svelte.js';
  import CardioCard from '../components/CardioCard.svelte';

  const s = $derived(store.data);
  const at = $derived(clock());
  const d = $derived(fromIso(ui.date));
  const key = $derived(dayKey(d));
  const isToday = $derived(ui.date === at.today);
  const blocks = $derived(blocksOn(s, ui.date, at.today));
  const log = $derived(logFor(s, ui.date));
  const st = $derived(dayStats(s, ui.date, at));
  const th = $derived(Number(s.settings.threshold) || 70);
  const run = $derived(streak(s, at));

  const msg = $derived.by(() => {
    if (st.pct === null) return ['Nothing scheduled', ''];
    if (st.pct === 100) return ['Clean sweep', 'win'];
    if (st.pct >= th) return ['Streak day locked in', 'win'];
    if (st.marked === 0) return ['Fresh page', ''];
    if (st.pct >= 50) return ['Past halfway', ''];
    return ['Keep going', ''];
  });

  // The score counts up on arrival and glides between values after each mark.
  const pct = new Tween(0, { duration: reduced() ? 0 : 650, easing: cubicOut });
  $effect(() => { pct.target = st.pct || 0; });

  const strip = $derived.by(() => {
    const mon = mondayOf(d);
    return DAYS.map((k, i) => {
      const dIso = iso(addDays(mon, i));
      const future = !counts(s, dIso, at);
      const ds = future ? null : dayStats(s, dIso, at);
      return { k, dIso, future, pct: ds?.pct ?? null };
    });
  });

  const nudge = $derived.by(() => {
    if (!isToday) return null;
    const y = iso(addDays(d, -1));
    if (!counts(s, y, at)) return null;
    const ys = dayStats(s, y, at);
    const open = ys.count - ys.marked;
    return open > 0 ? { y, open } : null;
  });

  const tracked = $derived(blocks.filter((b) => isTracked(s, b)));

  let root;

  async function mark(b, status) {
    const prev = st.pct || 0;
    setMark(s, ui.date, b.id, status);
    save();
    fx(b.id, status, prev);
  }

  // Feedback after a mark: the block sweeps, its segment pops, sparks for done, confetti at 100%.
  async function fx(id, status, prev) {
    refreshScene(ui.date);
    await tick();
    if (!root || logFor(s, ui.date).marks[id] !== status) return; // view already swapped, or toggled off
    const block = root.querySelector(`[data-bid="${id}"]`);
    const btnBox = block?.querySelector(`.mark[data-status="${status}"]`);
    replay(btnBox, 'pop', 600);
    replay(block, 'just', 900);
    replay(root.querySelector(`[data-seg="${id}"]`), 'just', 700);
    if (status === 'done') burst(btnBox, block?.style.getPropertyValue('--c'));
    if ((st.pct || 0) === 100 && prev < 100) confetti();
  }

  const step = (n) => slide(n, () => { ui.date = iso(addDays(d, n)); });
  const openDay = (dIso) => { if (dIso !== ui.date) slide(dIso > ui.date ? 1 : -1, () => { ui.date = dIso; }); };

  // "Mark gym done" in the workout sheet plays the same effects once the sheet has closed.
  $effect(() => {
    const on = (e) => fx(e.detail.id, e.detail.status, e.detail.prev);
    bus.addEventListener('marked', on);
    return () => bus.removeEventListener('marked', on);
  });

  const extraN = $derived((log.extra || []).length);
  const gymDay = $derived(blocks.some((b) => isTracked(s, b) && workoutFor(s, b)));

  function note(e) { setNote(s, ui.date, e.currentTarget.value); save(); }

  // Arrow keys step through days.
  function onKey(e) {
    if (ui.busy || ui.gym || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }
</script>

<svelte:document onkeydown={onKey} />

<div bind:this={root}>
  <div class="hero" style:--day={dayColor(key)}>
    <div class="hero-glow"></div>
    <div class="hero-top">
      <button class="nav-btn" onclick={() => step(-1)} aria-label="Previous day">‹</button>
      <div class="hero-date">
        <div class="dow">{#each DAY_NAMES[key] as ch, i}<span style:--i={i}>{ch}</span>{/each}</div>
        <div class="dom">{d.getDate()} <span class="mon">{d.toLocaleDateString(undefined, { month: 'long' })}</span>
          {#if isToday}<span class="pill">today</span>
          {:else}<a href="#today" class="jump" onclick={(e) => { e.preventDefault(); openDay(at.today); }}>Back to today</a>{/if}
        </div>
      </div>
      <button class="nav-btn" onclick={() => step(1)} aria-label="Next day">›</button>
    </div>

    <div class="hero-score">
      <div class="pct" style:--p={st.pct || 0}><span id="pct-num">{Math.round(pct.current)}</span><span class="pct-sign">%</span></div>
      <div class="hero-side">
        <div class="hero-msg {msg[1]}">{msg[0]}</div>
        {#if run}<div class="streak"><span class="flame">🔥</span> {run} day streak</div>
        {:else}<div class="muted small">{st.marked} of {st.count} blocks marked</div>{/if}
      </div>
    </div>

    <div class="segs">
      {#each tracked as b, i (b.id)}
        <i class="seg s-{log.marks[b.id] || 'none'}" data-seg={b.id} style:--c={catColor(catOf(s, b.cat)?.color)} style:--i={i} style:flex={hours(b) || 1}></i>
      {/each}
      {#if st.cardio}<i class="seg s-{log.cardio?.status || 'none'}" style:--c={cardioColor()} style:--i={blocks.length} style:flex="0.4"></i>{/if}
    </div>

    <div class="strip">
      {#each strip as t, i (t.dIso)}
        <button class="tile" class:sel={t.dIso === ui.date} class:future={t.future} onclick={() => openDay(t.dIso)}
          style:--d={dayColor(t.k)} style:--h="{t.future ? 0 : t.pct || 0}%" style:--i={i} aria-label={DAY_NAMES[t.k]}>
          <span class="fill"></span><span class="l">{DAY_NAMES[t.k][0]}</span><span class="p">{t.future || t.pct === null ? '' : `${t.pct}%`}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if nudge}
    <button class="nudge" onclick={() => openDay(nudge.y)}>Yesterday still has {nudge.open} unmarked {nudge.open === 1 ? 'block' : 'blocks'}. Finish it</button>
  {/if}

  <div class="blocks">
    {#each blocks as b, i (b.id)}
      {@const c = catOf(s, b.cat)}
      {@const tr = isTracked(s, b)}
      {@const m = log.marks[b.id]}
      {@const w = tr && workoutFor(s, b)}
      <div class="block {tr ? `st-${m || 'none'}` : 'fixed'}" data-bid={b.id} style:--c={catColor(c?.color)} style:--i={i}>
        <div class="time"><span>{b.start}</span> <span class="to">{b.end}</span></div>
        {#snippet inner()}
          <div class="title">{b.title || 'Untitled'}</div>
          {#if tr}<div class="meta"><b>{c?.name || 'No category'}</b>{fmtH(hours(b))}{#if w}<span class="open-wo">{w.exercises.length} exercises ›</span>{/if}</div>{/if}
        {/snippet}
        {#if w}
          <button class="block-main" onclick={() => openGym(b.id)} aria-label="Open {w.name} workout">{@render inner()}</button>
        {:else}
          <div>{@render inner()}</div>
        {/if}
        {#if tr}
          <div class="marks">
            {#each [['done', '✓', 'Done'], ['partial', '½', 'Partial'], ['missed', '✕', 'Missed']] as [status, label, title]}
              <button class="mark" class:on={m === status} data-status={status} {title} aria-label={title} aria-pressed={m === status}
                onclick={() => mark(b, status)}>{label}</button>
            {/each}
          </div>
        {:else}<div></div>{/if}
      </div>
    {:else}
      <div class="empty-state">No blocks on {DAY_NAMES[key]} yet. Add some in Timetable.</div>
    {/each}
  </div>

  <div class="extras">
    {#if !gymDay}<CardioCard dIso={ui.date} onopen={() => openGym('cardio')} />{/if}
    <button class="extra-card" style:--c={dayColor(key)} onclick={() => openGym('free')}>
      <span class="xc-title">{extraN ? 'Extra workout' : '+ Extra workout'}</span>
      <span class="xc-sub">{extraN ? `${extraN} ${extraN === 1 ? 'exercise' : 'exercises'} added` : 'Add any exercise by name'}</span>
    </button>
  </div>

  <h3>What slipped, and why?</h3>
  {#key ui.date}
    <textarea id="day-note" placeholder="One honest line is enough." value={log.note} oninput={note}></textarea>
  {/key}
</div>
