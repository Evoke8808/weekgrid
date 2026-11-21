<script>
  import { toast, toastAction } from '../lib/store.svelte.js';
</script>

<div class="toast" class:show={toast.show} class:has-action={toast.action} role="status" aria-live="polite"><span>{toast.text}</span>{#if toast.action}<button class="toast-act" onclick={toastAction}>{toast.action}</button>{/if}</div>
