<script>
  import { ui } from '../lib/store.svelte.js';
  import { sheet, closeGym } from '../lib/gymui.svelte.js';
  import GymSheet from './GymSheet.svelte';
  import CardioSheet from './CardioSheet.svelte';
</script>

<svelte:window onpopstate={() => { if (ui.gym) closeGym(true); }} />
<svelte:document onkeydown={(e) => { if (e.key === 'Escape' && ui.gym) closeGym(); }} />

<div id="sheet" class:open={Boolean(ui.gym)} class:closing={sheet.closing}>
  {#if ui.gym === 'cardio'}<CardioSheet />{:else if ui.gym}<GymSheet />{/if}
</div>
