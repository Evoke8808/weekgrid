<script>
  // Cardio timer: machines that count down end by themselves; count-up machines run toward a goal.
  import { tick } from 'svelte';
  import { fromIso, fmtDate } from '../lib/dates.js';
  import { logFor } from '../lib/model.js';
  import { cardioPlan, machineOf, mmss } from '../lib/gym.js';
  import { store } from '../lib/store.svelte.js';
  import { cardio, cardioElapsed, cardioSession, toggleCardio, saveCardio, resetCardio, closeGym } from '../lib/gymui.svelte.js';
  import { cardioColor } from '../lib/theme.svelte.js';

  const st = $derived(store.data);
  const s = $derived(cardio.s);
  const m = $derived(s ? machineOf(st, s.machine) : null);
  const rec = $derived(s ? cardioPlan(st, s.date) : null);
  const saved = $derived(s ? logFor(st, s.date).cardio : null);
  const elapsed = $derived(cardioElapsed());
  const started = $derived(elapsed > 0);
  const minutes = $derived(s ? s.goal / 60 : 10);
  const custom = $derived(s ? s.custom || ![10, 15].includes(minutes) : false);

  async function pickCustom() {
    s.custom = true;
    await tick();
    const i = document.getElementById('c-custom');
    i?.focus(); i?.select();
  }
  function customInput(e) {
    const v = Math.min(180, Math.max(0, Number(e.currentTarget.value) || 0));
    if (v > 0) { s.goal = Math.round(v * 60); s.custom = true; }
  }
  function reset() {
    if (!confirm('Reset the timer? The time so far is not saved.')) return;
    resetCardio();
    cardioSession();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="sheet-back" onclick={() => closeGym()}></div>
{#if !st.cardio.machines.length || !s}
  <div class="sheet-card" style:--c={cardioColor()}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="grab" onclick={() => closeGym()}></div>
    <div class="sheet-title">Cardio</div>
    <div class="empty-state" style="margin-top:14px">No cardio machines yet. Add yours in Settings.</div>
  </div>
{:else}
  <div class="sheet-card" role="dialog" aria-modal="true" aria-label="Cardio" style:--c={cardioColor()}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="grab" onclick={() => closeGym()}></div>
    <div class="sheet-top">
      <div><div class="sheet-title">Cardio</div><div class="muted small">{fmtDate(fromIso(s.date))}</div></div>
      <button class="nav-btn" onclick={() => closeGym()} aria-label="Close">✕</button>
    </div>
    {#if saved}
      <div class="c-saved">Saved today: {saved.name}, {mmss(saved.secs)} of {mmss(saved.goal)}{saved.status === 'done' ? ' ✓' : ''}. Saving again replaces it.</div>
    {/if}

    <div class="c-label">Machine</div>
    <div class="machs">
      {#each st.cardio.machines as x (x.id)}
        <button class="mach" class:sel={x.id === s.machine} disabled={started} onclick={() => (s.machine = x.id)}>
          <span class="mach-name">{x.name}{#if rec?.machine === x.id}&nbsp;<em>(recommended for you)</em>{/if}</span>
          <span class="mach-mode">{x.mode === 'down' ? 'counts down' : 'counts up'}</span>
        </button>
      {/each}
    </div>

    <div class="c-label">Time</div>
    <div class="rest-row">
      {#each [10, 15] as n}
        <button class="chip-btn" class:sel={!s.custom && minutes === n} disabled={started} onclick={() => { s.goal = n * 60; s.custom = false; }}>{n} min</button>
      {/each}
      <button class="chip-btn" class:sel={custom} disabled={started} onclick={pickCustom}>Custom</button>
      {#if custom}
        <label class="set-in c-custom"><input type="number" inputmode="numeric" min="1" max="180" id="c-custom" value={+minutes.toFixed(1)} disabled={started} oninput={customInput} aria-label="Minutes" /><span>min</span></label>
      {/if}
    </div>

    <div class="c-clock">
      <div class="c-time" class:past={elapsed >= s.goal} id="c-time">{m?.mode === 'down' ? mmss(Math.ceil(Math.max(0, s.goal - elapsed))) : mmss(Math.floor(elapsed))}</div>
      <div class="muted small">{m?.mode === 'down' ? `Counting down from ${mmss(s.goal)}` : `Stopwatch, goal ${mmss(s.goal)}`}</div>
      <div class="rest-track"><div id="c-fill" style:width="{Math.min(100, (elapsed / s.goal) * 100)}%"></div></div>
    </div>

    <div class="c-actions">
      <button class="btn primary" onclick={toggleCardio}>{s.running ? 'Pause' : started ? 'Resume' : 'Start'}</button>
      {#if started}
        <button class="btn" onclick={() => saveCardio(cardioElapsed())}>Finish and save</button>
        <button class="btn danger" onclick={reset}>Reset</button>
      {:else}
        <button class="btn" onclick={() => saveCardio(s.goal)}>I did it without the timer</button>
      {/if}
    </div>
  </div>
{/if}
