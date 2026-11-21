<script>
  import { untrack } from 'svelte';
  import { startScene } from '../lib/scene.js';
  let cv;
  $effect(() => untrack(() => startScene(cv))); // reads the store, but must never restart on data changes
</script>

<canvas id="scene" aria-hidden="true" bind:this={cv}></canvas>
