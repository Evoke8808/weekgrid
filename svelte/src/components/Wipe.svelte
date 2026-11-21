<script>
  import { ui } from '../lib/store.svelte.js';
</script>

<div id="wipe" class={ui.wipe} aria-hidden="true">
  {#each Array(7) as _}<i></i>{/each}
</div>
