<script>
  import { tick } from 'svelte';
  import { fromIso, dayKey, fmtDate, shortDate } from '../lib/dates.js';
  import { catOf, logFor } from '../lib/model.js';
  import { clock } from '../lib/stats.js';
  import {
    sheetCtx, exKey, parseReps, planned, setsFor, filled, lastSession, suggestion, exStatus, progress,
    gymWrite, deleteSet, addExtra, removeExtra, knownExercises, gaps, restLen, packList, fmtKg, mmss, SLACK
  } from '../lib/gym.js';
  import { store, ui, save, say } from '../lib/store.svelte.js';
  import { sheet, closeGym, finishGym, startRest, openCardioFrom } from '../lib/gymui.svelte.js';
  import { catColor, dayColor } from '../lib/theme.svelte.js';
  import Pace from './Pace.svelte';
  import RestBar from './RestBar.svelte';
  import CardioCard from './CardioCard.svelte';

  const s = $derived(store.data);
  const at = $derived(clock());
  const sesKey = $derived(ui.gym || 'free');
  const ctx = $derived(sheetCtx(s, ui.date, ui.gym, at.today));
  const b = $derived(ctx?.b);
  const c = $derived(b ? catColor(catOf(s, b.cat)?.color) : dayColor(dayKey(fromIso(ui.date))));
  const prog = $derived(ctx ? progress(s, ui.date, ctx) : { done: 0, total: 0 });
  const timing = $derived(ctx ? gaps(s, ui.date, ctx, sesKey) : { tl: [], m: {} });
  const firstSet = $derived(timing.tl[0] ? `${timing.tl[0].key}|${timing.tl[0].j}` : '');
  const isDone = $derived(Boolean(b && logFor(s, ui.date).marks?.[b.id] === 'done'));
  const known = $derived(knownExercises(s));

  // Everything one exercise row needs.
  function view(ex) {
    const key = exKey(ex.name);
    const { target, unit } = parseReps(ex.reps);
    const last = lastSession(s, key, ui.date);
    const tip = suggestion(ex, last);
    return {
      key, target, unit, last, tip,
      st: exStatus(s, ui.date, ex),
      sugKg: (tip && /^Try ([\d.]+) kg/.exec(tip)?.[1]) || '',
      lastKg: last ? Math.max(0, ...last.sets.map((x) => Number(x.kg) || 0)) : 0,
      sets: setsFor(s, ui.date, key, planned(ex))
    };
  }
  const hint = (v, j) => String((j && v.sets[j - 1].kg) || v.sugKg || v.lastKg || '');

  function kg(key, j, e) {
    if (Number(e.currentTarget.value) < 0) e.currentTarget.value = '';
    gymWrite(s, ui.date, key, j, 'kg', e.currentTarget.value);
    save();
  }
  function reps(v, j, e) {
    const el = e.currentTarget;
    if (Number(el.value) < 0) el.value = '';
    gymWrite(s, ui.date, v.key, j, 'reps', el.value, { sesKey });
    // Typing reps with the weight left blank uses the weight suggested in the box
    const kgNow = s.logs[ui.date]?.gym?.[v.key]?.[j]?.kg;
    if (el.value !== '' && (kgNow === undefined || kgNow === '') && hint(v, j)) gymWrite(s, ui.date, v.key, j, 'kg', hint(v, j));
    save();
  }

  async function addSet(v) {
    gymWrite(s, ui.date, v.key, v.sets.length, 'reps', '');
    save();
    await tick();
    document.querySelector(`.ex[data-ex="${CSS.escape(v.key)}"] .set:last-child input`)?.focus();
  }

  let nName = $state(''), nSets = $state(3), nReps = $state('10');
  function addEx() {
    const name = nName.trim();
    if (!name) { say('Type the exercise name first'); document.getElementById('new-ex')?.focus(); return; }
    if (ctx.exercises.some((x) => exKey(x.name) === exKey(name))) { say('That exercise is already in this workout'); return; }
    addExtra(s, ui.date, name, nSets, nReps);
    save();
    sheet.openEx = exKey(name);
    nName = '';
  }
  function delEx(key) {
    if (!confirm('Remove this exercise and its logged sets from today?')) return;
    removeExtra(s, ui.date, key);
    save();
  }

  // Leaving the gym: a checklist first, so nothing gets left behind.
  let packed = $state([]);
  const items = $derived(packList(s));
  const leftToPack = $derived(items.length - packed.filter(Boolean).length);
  function finish() {
    if (items.length && !sheet.pack) { packed = items.map(() => false); sheet.pack = true; return; }
    finishGym(b.id, ui.date);
  }
  $effect(() => { if (sheet.pack && leftToPack === 0) navigator.vibrate?.(40); });
</script>

{#if ctx}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="sheet-back" onclick={() => closeGym()}></div>
  <div class="sheet-card" role="dialog" aria-modal="true" aria-label={ctx.name} style:--c={c}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="grab" onclick={() => closeGym()}></div>
    <div class="sheet-top">
      <div><div class="sheet-title">{ctx.name}</div><div class="muted small">{fmtDate(fromIso(ui.date))}</div></div>
      <button class="nav-btn" onclick={() => closeGym()} aria-label="Close">✕</button>
    </div>

    <Pace {ctx} {sesKey} />

    <div class="sheet-prog"><span id="gym-done">{prog.done}</span> of {prog.total} sets logged
      <div class="cat-track"><div class="cat-fill" id="gym-fill" style:--w="{prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%" style:--c={c}></div></div>
    </div>

    <div class="exs">
      {#each ctx.exercises as ex, i (exKey(ex.name))}
        {@const v = view(ex)}
        {@const open = sheet.openEx === v.key}
        <div class="ex" class:open class:complete={v.st.done >= planned(ex)} data-ex={v.key} style:--i={i}>
          <button class="ex-head" onclick={() => (sheet.openEx = open ? null : v.key)} aria-expanded={open}>
            <span class="ex-name">{ex.name}</span>
            <span class="ex-plan">{ex.sets} × {ex.reps}</span>
            <span class="ex-count"><b>{v.st.done}</b>/{v.st.total}</span>
          </button>
          <div class="ex-body"><div class="ex-in">
            {#if v.last}
              <div class="last">Last time, {shortDate(fromIso(v.last.date))}: {v.last.sets.map((x) => `${fmtKg(x.kg)} × ${x.reps}`).join(', ')}</div>
            {:else}
              <div class="last">First time logging this one.</div>
            {/if}
            {#if v.tip}<div class="tip">{v.tip}</div>{/if}
            <div class="sets">
              {#each v.sets as set, j}
                {@const extraSet = j >= planned(ex)}
                {@const gap = timing.m[`${v.key}|${j}`]}
                <div class="set" class:logged={filled(set)} class:hit={filled(set) && v.target && Number(set.reps) >= v.target} data-set={j} style:--n={j}>
                  <span class="set-n">{extraSet ? '+' : ''}{j + 1}<i class="set-gap" class:slow={gap !== undefined && gap > restLen(s) + SLACK && firstSet !== `${v.key}|${j}`}>{gap === undefined ? '' : `+${mmss(Math.round(gap))}`}</i></span>
                  <label class="set-in"><input type="number" inputmode="decimal" step="0.5" min="0" value={set.kg ?? ''} placeholder={hint(v, j)}
                    oninput={(e) => kg(v.key, j, e)} aria-label="Set {j + 1} weight" /><span>kg</span></label>
                  <label class="set-in reps"><input type="number" inputmode="numeric" min="0" value={set.reps ?? ''} placeholder={v.target ?? ''}
                    oninput={(e) => reps(v, j, e)} onchange={(e) => { if (e.currentTarget.value !== '') startRest(); }}
                    aria-label="Set {j + 1} {v.unit}" /><span>/ {v.target ?? '?'}{v.unit === 's' ? ' s' : ''}</span></label>
                  {#if extraSet}
                    <button class="set-x" onclick={() => { deleteSet(s, ui.date, v.key, j); save(); }} aria-label="Remove set {j + 1}">✕</button>
                  {:else}<span></span>{/if}
                </div>
              {/each}
            </div>
            <button class="btn add-set" onclick={() => addSet(v)}>+ Add a set</button>
            {#if ex.extra}<button class="btn danger del-ex" onclick={() => delEx(v.key)}>Remove this exercise</button>{/if}
          </div></div>
        </div>
      {:else}
        <div class="empty-state">Nothing here yet. Add your first exercise below.</div>
      {/each}
    </div>

    {#if b && s.cardio.machines.length}
      <div class="c-label">Cardio</div>
      <div class="extras" style="grid-template-columns:1fr;margin:0"><CardioCard dIso={ui.date} onopen={() => openCardioFrom(b.id)} /></div>
    {/if}

    <div class="add-ex">
      <div class="c-label">Add an exercise for today</div>
      <div class="add-ex-row">
        <input class="field" id="new-ex" list="ex-names" placeholder="Name, like Dips" autocomplete="off" aria-label="Exercise name" bind:value={nName}
          onkeydown={(e) => { if (e.key === 'Enter') addEx(); }} />
        <input class="field" id="new-sets" type="number" inputmode="numeric" min="1" bind:value={nSets} aria-label="Sets" />
        <input class="field" id="new-reps" bind:value={nReps} aria-label="Target reps" />
        <button class="btn" onclick={addEx}>Add</button>
      </div>
      <div class="muted small">Sets, then target reps. Only added to this day.</div>
      <datalist id="ex-names">{#each known as n}<option value={n}></option>{/each}</datalist>
    </div>

    <RestBar />

    {#if b}
      <button class="btn primary finish" disabled={isDone} onclick={finish}>{isDone ? 'Gym marked done' : 'Mark gym done'}</button>
    {:else}
      <button class="btn primary finish" onclick={() => closeGym()}>Done</button>
    {/if}

    {#if sheet.pack}
      <div class="pack">
        <div class="pack-card" role="dialog" aria-modal="true" aria-label="Before you leave">
          <div class="sheet-title" style="font-size:24px">Don't forget your things</div>
          <div class="muted small">Tick each one as you pack it.</div>
          <div class="pack-items">
            {#each items as t, i}
              <label class="pack-item" style:--i={i}><input type="checkbox" bind:checked={packed[i]} /><span>{t}</span></label>
            {/each}
          </div>
          <div class="c-actions">
            <button class="btn" onclick={() => (sheet.pack = false)}>Back</button>
            <button class="btn primary" disabled={leftToPack > 0} onclick={finish}>{leftToPack ? `${leftToPack} still to pack` : 'All packed, mark gym done'}</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
