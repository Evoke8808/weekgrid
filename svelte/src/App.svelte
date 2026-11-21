<script>
  import { untrack } from 'svelte';
  import Header from './components/Header.svelte';
  import Toast from './components/Toast.svelte';
  import Intro from './components/Intro.svelte';
  import Scene from './components/Scene.svelte';
  import Sheet from './components/Sheet.svelte';
  import Today from './views/Today.svelte';
  import Week from './views/Week.svelte';
  import Timetable from './views/Timetable.svelte';
  import Settings from './views/Settings.svelte';
  import { ui, rollover } from './lib/store.svelte.js';
  import { refreshScene } from './lib/scene.js';
  import { installTilt, installGyro } from './lib/tilt.js';
  import { reduced } from './lib/motion.js';

  let intro = $state(!reduced());

  // New day while the app stays open: move "today" along.
  function tick() { if (!ui.busy && rollover()) { ui.enter++; refreshScene(); } }
  let main;
  $effect(() => installTilt());
  $effect(() => installGyro(main));
  $effect(() => { ui.view; untrack(() => refreshScene()); });
  $effect(() => {
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  });
</script>

<svelte:document onvisibilitychange={() => { if (!document.hidden) tick(); }} />

<Scene />
<Header />

<main bind:this={main}>
  {#key ui.enter}
    <section class="view active {ui.slide}" class:enter={ui.enter > 0 && !reduced()} id="view-{ui.view}">
      {#if ui.view === 'today'}<Today />
      {:else if ui.view === 'week'}<Week />
      {:else if ui.view === 'timetable'}<Timetable />
      {:else}<Settings />{/if}
    </section>
  {/key}
</main>

<div id="fx" aria-hidden="true"></div>
<Sheet />
<Toast />
{#if intro}<Intro ondone={() => (intro = false)} />{/if}
