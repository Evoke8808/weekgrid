<script>
  import { todayIso } from '../lib/dates.js';
  import { addCategory, categoryUsed, deleteCategory, loadSample, clearedState, importInto, isExport, hasHistory } from '../lib/model.js';
  import { store, save, replace, say } from '../lib/store.svelte.js';
  import { theme, THEMES, revealTheme } from '../lib/theme.svelte.js';
  import { motion, setMotion, reduced } from '../lib/motion.js';
  import { refreshScene } from '../lib/scene.js';
  import { DAYS, DAY_NAMES } from '../lib/constants.js';
  import { dayColor } from '../lib/theme.svelte.js';
  import { packList, addMachine, deleteMachine, setPlanMachine, setPlanMinutes, addWorkout } from '../lib/gym.js';
  import { pwa, install, checkForUpdate, updateNow, isIos, VERSION } from '../lib/pwa.svelte.js';

  const s = $derived(store.data);
  let fileInput;

  function delCat(id) {
    if (categoryUsed(s, id) && !confirm('Blocks use this category. Delete anyway?')) return;
    deleteCategory(s, id);
    save();
  }

  function setPack(e) {
    s.settings.pack = e.currentTarget.value.split('\n').map((x) => x.trim()).filter(Boolean);
    save();
  }

  function delWorkout(w) {
    if (!confirm(`Delete ${w.name}? Logged sets are kept.`)) return;
    s.workouts = s.workouts.filter((x) => x !== w);
    save();
  }

  function setThreshold(e) {
    s.settings.threshold = Math.min(100, Math.max(1, Number(e.currentTarget.value) || 70));
    save();
  }

  function pickTheme(id, e) {
    if (id === theme.name) return;
    revealTheme(id, e.currentTarget, { reduced: reduced(), after: () => refreshScene() });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weekgrid-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importJson(e) {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isExport(data)) throw new Error('bad file');
      const replaceHistory = !(hasHistory(data) && Object.keys(s.logs).length) ||
        confirm('This file contains its own history. Replace the history on this device with it?');
      replace(importInto(s, data, { replaceHistory }));
      refreshScene();
      say('Timetable imported');
    } catch (err) {
      say('That file is not a WeekGrid export');
    }
  }

  function sample() {
    if (!confirm('Replace your timetable and categories with the sample week? Your logs are kept.')) return;
    loadSample(s);
    save();
    say('Sample week loaded');
  }

  function reset() {
    if (!confirm('Delete all data? Export first if you want a backup.')) return;
    replace(clearedState(s));
    refreshScene();
    say('Everything cleared');
  }
</script>

<h2>Settings</h2>

<h3>Categories</h3>
<p class="muted small">Set a weekly target in hours. Untick "Tracked" for things like classes or travel.</p>
{#each s.categories as c, i (c.id)}
  <div class="edit-row cat-edit" style:--i={i}>
    <input type="text" bind:value={c.name} oninput={save} aria-label="Category name" />
    <input type="color" bind:value={c.color} oninput={save} aria-label="Colour" />
    <label><input type="number" min="0" step="0.5" class="field" style="width:56px"
      value={c.target} oninput={(e) => { c.target = Number(e.currentTarget.value) || 0; save(); }} />h/wk</label>
    <label><input type="checkbox" checked={c.tracked !== false} onchange={(e) => { c.tracked = e.currentTarget.checked; save(); }} />Tracked</label>
    <button class="btn danger icon" onclick={() => delCat(c.id)} aria-label="Delete category">✕</button>
  </div>
{:else}
  <div class="muted">No categories.</div>
{/each}
<button class="btn primary" style="margin-top:6px" onclick={() => { addCategory(s); save(); }}>+ Add category</button>

<h3>Cardio</h3>
<label class="row small" style="margin-bottom:10px">
  <input type="checkbox" checked={s.cardio.daily} onchange={(e) => { s.cardio.daily = e.currentTarget.checked; save(); }} />
  Cardio every day counts toward my daily score
</label>
{#each s.cardio.machines as m, i (m.id)}
  <div class="edit-row k-mach">
    <input type="text" bind:value={m.name} oninput={save} aria-label="Machine name" />
    <select bind:value={m.mode} onchange={save} aria-label="Timer type">
      <option value="up">Counts up</option><option value="down">Counts down</option>
    </select>
    <button class="btn danger icon" onclick={() => { deleteMachine(s, i); save(); }} aria-label="Delete machine">✕</button>
  </div>
{/each}
<button class="btn" onclick={() => { addMachine(s); save(); }}>+ Add machine</button>
<p class="muted small" style="margin:14px 0 8px">Recommended machine for each day. It is shown as "recommended for you" when you start cardio.</p>
{#each DAYS as k}
  <div class="edit-row k-plan">
    <strong style:color={dayColor(k)} style="align-self:center">{DAY_NAMES[k].slice(0, 3)}</strong>
    <select value={s.cardio.plan[k]?.machine || ''} onchange={(e) => { setPlanMachine(s, k, e.currentTarget.value); save(); }} aria-label="{DAY_NAMES[k]} machine">
      <option value="">None</option>
      {#each s.cardio.machines as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
    </select>
    <label class="row small muted"><input type="number" min="1" max="180" class="field" style="width:64px" value={s.cardio.plan[k]?.min ?? 10}
      oninput={(e) => { setPlanMinutes(s, k, e.currentTarget.value); save(); }} aria-label="{DAY_NAMES[k]} minutes" />min</label>
  </div>
{/each}

<h3>Before you leave the gym</h3>
<p class="muted small">Shown when you tap Mark gym done. One item per line.</p>
<textarea id="pack-list" rows="5" placeholder="Water bottle" value={packList(s).join('\n')} oninput={setPack}></textarea>

<h3>Workouts</h3>
<p class="muted small">A gym block opens the workout whose name appears in its title, like "Gym: Push A". Targets stay fixed while you log what you actually did.</p>
{#each s.workouts as w, wi (w.id)}
  <div class="panel wo" style:--i={wi}>
    <div class="row space">
      <input type="text" class="field wo-name" bind:value={w.name} oninput={save} aria-label="Workout name" />
      <button class="btn danger icon" onclick={() => delWorkout(w)} aria-label="Delete workout">✕</button>
    </div>
    {#each w.exercises as ex, xi}
      <div class="edit-row wo-ex">
        <input type="text" bind:value={ex.name} oninput={save} placeholder="Exercise" aria-label="Exercise" />
        <input type="number" min="1" value={ex.sets} oninput={(e) => { ex.sets = Math.max(1, Number(e.currentTarget.value) || 1); save(); }} aria-label="Sets" />
        <input type="text" bind:value={ex.reps} oninput={save} placeholder="8-10" aria-label="Target reps" />
        <button class="btn danger icon" onclick={() => { w.exercises.splice(xi, 1); save(); }} aria-label="Delete exercise">✕</button>
      </div>
    {/each}
    <button class="btn" onclick={() => { w.exercises.push({ name: '', sets: 3, reps: '10' }); save(); }}>+ Add exercise</button>
  </div>
{/each}
<button class="btn primary" style="margin-top:6px" onclick={() => { addWorkout(s); save(); }}>+ Add workout</button>

<h3>Theme</h3>
<p class="muted small">Saved on this device only. Mono is black, white and grey with red as the one accent.</p>
<div class="rest-row" style="--c: var(--cyan)">
  {#each THEMES as t}
    <button class="chip-btn" class:sel={theme.name === t.id} aria-pressed={theme.name === t.id} onclick={(e) => pickTheme(t.id, e)}>{t.label}</button>
  {/each}
</div>

<h3>Animations</h3>
<p class="muted small">Saved on this device only. Lite keeps the look but drops the heavy effects, which is easier on a phone's battery.</p>
<div class="rest-row" style="--c: var(--cyan)">
  {#each [['full', 'Full'], ['lite', 'Lite'], ['off', 'Off']] as [k, l]}
    <button class="chip-btn" class:sel={motion === k} aria-pressed={motion === k} onclick={() => setMotion(k)}>{l}</button>
  {/each}
</div>

<h3>Streak</h3>
<div class="row">
  <span>A day counts toward your streak at</span>
  <input type="number" class="field" id="threshold" min="1" max="100" value={s.settings.threshold} oninput={setThreshold} style="width:70px" />%
</div>

<h3>App</h3>
<div class="panel app-info">
  <div class="app-row"><span>Version</span><strong>{VERSION}</strong></div>
  <div class="app-row"><span>Works offline</span>
    <strong class:ok={pwa.offline}>{pwa.offline ? 'Yes' : pwa.supported ? 'After the first visit' : 'Not in this browser'}</strong></div>
  <div class="app-row"><span>Storage</span>
    <strong class:ok={pwa.persisted}>{pwa.persisted ? 'Protected' : pwa.persisted === false ? 'Not protected' : 'Unknown'}</strong></div>
  <div class="app-row"><span>Connection</span><strong class:ok={pwa.online}>{pwa.online ? 'Online' : 'Offline, still saving here'}</strong></div>
  <div class="app-row"><span>Installed</span>
    {#if pwa.installed}<strong class="ok">Yes</strong>
    {:else if pwa.installable}<button class="btn primary" onclick={install}>Install WeekGrid</button>
    {:else if isIos()}<span class="muted small">Safari: Share → Add to Home Screen</span>
    {:else}<span class="muted small">Use your browser's Install option (address bar or menu)</span>{/if}
  </div>
</div>
<div class="row" style="margin-top:8px">
  {#if pwa.update}<button class="btn primary" onclick={updateNow}>Update now</button>
  {:else}<button class="btn" onclick={checkForUpdate} disabled={pwa.checking}>{pwa.checking ? 'Checking…' : 'Check for updates'}</button>{/if}
</div>

<h3>Sync across devices</h3>
<p class="muted small">Arrives in Part 8 with an easy pairing code. The original app still has GitHub sync in the meantime.</p>

<h3>Data</h3>
<p class="muted small">Data stays on this device only, and works without internet. Export regularly to back it up or move it to another device.</p>
<div class="row">
  <button class="btn" onclick={exportJson}>Export JSON</button>
  <button class="btn" onclick={() => fileInput.click()}>Import JSON</button>
  <button class="btn" onclick={sample}>Load sample week</button>
  <button class="btn danger" onclick={reset}>Clear everything</button>
</div>
<input type="file" accept="application/json,.json" hidden bind:this={fileInput} onchange={importJson} />
