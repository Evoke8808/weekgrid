<script>
  import { VIEWS } from '../lib/constants.js';
  import { ui } from '../lib/store.svelte.js';
  import { goTo } from '../lib/transitions.js';
  import { theme, revealTheme, inkColor } from '../lib/theme.svelte.js';
  import { reduced } from '../lib/motion.js';
  import { refreshScene } from '../lib/scene.js';

  let tabs = $state([]);
  let ink = $state({ x: 0, w: 40 });

  let themeBtn;
  function flip() {
    if (ui.busy) return;
    revealTheme(theme.name === 'mono' ? 'color' : 'mono', themeBtn, { reduced: reduced(), after: () => { refreshScene(); moveInk(); } });
  }

  // Slide the glowing underline under the active tab.
  function moveInk() {
    const i = VIEWS.findIndex((v) => v.id === ui.view);
    const el = tabs[i];
    if (!el) return;
    ink = { x: el.offsetLeft, w: el.offsetWidth };
  }

  $effect(() => { ui.view; moveInk(); });
  $effect(() => { document.fonts?.ready.then(moveInk); });
</script>

<svelte:window onresize={moveInk} />

<header class="top">
  <div class="top-in">
    <div class="brand">
      <h1 class="wordmark" aria-label="WeekGrid">
        {#each 'WeekGrid' as ch}<span>{ch}</span>{/each}
      </h1>
      <button class="theme-btn" bind:this={themeBtn} onclick={flip} aria-label="Switch to {theme.name === 'mono' ? 'colour' : 'mono'} theme" title="{theme.name === 'mono' ? 'Colour' : 'Mono'} theme">◐</button>
    </div>
    <div class="tabs" role="tablist" aria-label="Views">
      {#each VIEWS as v, i}
        <button
          class="tab"
          class:active={ui.view === v.id}
          data-view={v.id}
          style:--g={inkColor(v.id)}
          role="tab"
          aria-selected={ui.view === v.id}
          bind:this={tabs[i]}
          onclick={() => goTo(v.id)}>{v.label}</button>
      {/each}
      <span class="tab-ink" aria-hidden="true" style:width="{ink.w}px" style:transform="translateX({ink.x}px)" style:--ink={inkColor(ui.view)}></span>
    </div>
  </div>
</header>
