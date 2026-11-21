<script>
  import { store } from '../lib/store.svelte.js';
  import { REST_CHOICES, restLen, mmss } from '../lib/gym.js';
  import { live, rest, restRunning, startRest, stopRest, moreRest, setRestLen } from '../lib/gymui.svelte.js';

  const on = $derived(rest.end > 0 && live.now < rest.end);
  const left = $derived(on ? Math.max(0, (rest.end - live.now) / 1000) : 0);
  const len = $derived(restLen(store.data));
</script>

<div class="rest" class:on class:rang={rest.rang} id="rest">
  <div class="rest-top"><span class="rest-label">Rest</span><span id="rest-time">{on ? mmss(Math.ceil(left)) : rest.rang ? 'Go' : mmss(len)}</span></div>
  <div class="rest-track"><div id="rest-fill" style:width="{on ? (left / rest.total) * 100 : 0}%"></div></div>
  <div class="rest-row">
    {#each REST_CHOICES as sec}
      <button class="chip-btn" class:sel={len === sec} onclick={() => setRestLen(sec)}>{mmss(sec)}</button>
    {/each}
    <button class="chip-btn" onclick={moreRest}>+15 s</button>
    <button class="chip-btn go" onclick={() => (restRunning() ? stopRest() : startRest())}>{on ? 'Skip' : 'Start rest'}</button>
  </div>
</div>
