<script>
  import { untrack } from 'svelte';
  import { DAYS, DAY_NAMES } from '../lib/constants.js';
  import { hours, fmtH } from '../lib/dates.js';
  import { blocksFor, isTracked, addBlock, deleteBlock, copyDay, clashOf } from '../lib/model.js';
  import { dayColor } from '../lib/theme.svelte.js';
  import { store, ui, save, say } from '../lib/store.svelte.js';

  const s = $derived(store.data);
  const key = $derived(ui.editDay);
  const clash = $derived(clashOf(s, key));
  const planned = $derived(blocksFor(s, key).filter((b) => isTracked(s, b)).reduce((a, b) => a + hours(b), 0));

  // Row order only updates when an edit is finished, so a row never jumps away while you type in it.
  let order = $state(untrack(() => blocksFor(store.data, ui.editDay).map((b) => b.id)));
  const resort = () => { order = blocksFor(s, key).map((b) => b.id); };
  const rows = $derived(order.map((id) => s.schedule[key].find((b) => b.id === id)).filter(Boolean));

  let target = $state(untrack(() => DAYS.find((k) => k !== ui.editDay)));

  function pickDay(k) {
    if (k === key) return;
    ui.editDay = k;
    target = DAYS.find((x) => x !== k);
    ui.enter++; // replay the rows folding in
  }

  function add() {
    const b = addBlock(s, key);
    save();
    order = [...order, b.id];
  }

  function del(id) {
    deleteBlock(s, key, id);
    save();
    order = order.filter((x) => x !== id);
  }

  function copy() {
    if (s.schedule[target].length && !confirm(`Replace ${DAY_NAMES[target]}'s blocks?`)) return;
    copyDay(s, key, target);
    save();
    say(`Copied to ${DAY_NAMES[target]}`);
  }
</script>

<h2>Weekly timetable</h2>
<p class="muted small">Your repeating week. Blocks in untracked categories (like "Fixed") show on Today but aren't scored.</p>

<div class="day-tabs">
  {#each DAYS as k}
    <button class="btn" class:active={k === key} onclick={() => pickDay(k)} style:--d={dayColor(k)} aria-pressed={k === key}>{DAY_NAMES[k].slice(0, 3)}</button>
  {/each}
</div>

<div class="row space" style="margin-bottom:8px">
  <strong style:color={dayColor(key)} style="font-size:20px">{DAY_NAMES[key]}</strong>
  <span class="muted small">{fmtH(planned)} tracked</span>
</div>

{#each rows as b, i (b.id)}
  <div class="edit-row" class:clash={clash.has(b.id)} style:--i={i}>
    <input type="time" bind:value={b.start} oninput={save} onchange={resort} aria-label="Start" />
    <input type="time" bind:value={b.end} oninput={save} onchange={resort} aria-label="End" />
    <input type="text" class="title-in" bind:value={b.title} oninput={save} placeholder="What are you doing?" aria-label="Title" />
    <select bind:value={b.cat} onchange={() => { save(); resort(); }} aria-label="Category">
      {#each s.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
    </select>
    <button class="btn danger icon" onclick={() => del(b.id)} aria-label="Delete block">✕</button>
  </div>
{:else}
  <div class="empty-state">No blocks yet. Add your first one below.</div>
{/each}

{#if clash.size}
  <p class="warn small">{clash.size} blocks overlap in time on {DAY_NAMES[key]}. Check the start and end times.</p>
{/if}

<div class="row" style="margin-top:10px">
  <button class="btn primary" onclick={add}>+ Add block</button>
  <select class="field" bind:value={target} aria-label="Copy to day">
    {#each DAYS.filter((k) => k !== key) as k}<option value={k}>{DAY_NAMES[k]}</option>{/each}
  </select>
  <button class="btn" onclick={copy}>Copy {DAY_NAMES[key].slice(0, 3)} to…</button>
</div>
