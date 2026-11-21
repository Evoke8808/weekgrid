<script>
  import { store } from '../lib/store.svelte.js';
  import { logFor } from '../lib/model.js';
  import { cardioPlan, machineOf, mmss } from '../lib/gym.js';
  import { cardio, cardioElapsed } from '../lib/gymui.svelte.js';
  import { cardioColor } from '../lib/theme.svelte.js';

  let { dIso, onopen } = $props();
  const s = $derived(store.data);
  const saved = $derived(logFor(s, dIso).cardio);
  const plan = $derived(cardioPlan(s, dIso));
  const sub = $derived.by(() => {
    if (cardio.s && cardio.s.date === dIso && cardioElapsed() > 0) return 'Timer in progress';
    if (saved) return `${saved.name}, ${mmss(saved.secs)}${saved.status === 'done' ? ' done' : ` of ${mmss(saved.goal)}`}`;
    const m = plan && machineOf(s, plan.machine);
    return m ? `${m.name}, ${plan.min || 10} min` : 'Pick a machine and a time';
  });
</script>

{#if s.cardio.machines.length}
  <button class="extra-card st-{saved?.status || 'none'}" style:--c={cardioColor()} onclick={onopen}>
    <span class="xc-title">Cardio{saved?.status === 'done' ? ' ✓' : ''}</span><span class="xc-sub">{sub}</span>
  </button>
{/if}
