<script>
  // Session timer: when the workout started, time per set, extra rest, and whether you'll finish in the block's slot.
  import { store, ui, save } from '../lib/store.svelte.js';
  import { sessionOf, startSession, paceInfo, paceStatus, mins, mmss } from '../lib/gym.js';
  import { live } from '../lib/gymui.svelte.js';

  let { ctx, sesKey } = $props();
  const s = $derived(store.data);
  const ses = $derived(sessionOf(s, ui.date, sesKey));
  const p = $derived(ses ? paceInfo(s, ui.date, ctx, sesKey, live.now) : null);
  const st = $derived(p ? paceStatus(p) : null);

  const start = () => { startSession(s, ui.date, sesKey); save(); };
  const end = () => { s.logs[ui.date].sessions[sesKey].end = Date.now(); save(); };
  const resume = () => { delete s.logs[ui.date].sessions[sesKey].end; save(); };
</script>

{#if !p}
  <div class="pace idle">
    <div><b>Session timer</b><div class="muted small">Starts by itself when you log your first set.</div></div>
    <button class="chip-btn go" onclick={start}>Start now</button>
  </div>
{:else}
  <div class="pace {st.cls}">
    <div class="pace-figs">
      <div><span class="pf" id="ses-elapsed">{mins(p.elapsed)}</span><span class="pl">{p.allotted ? `of ${mins(p.allotted)}` : 'elapsed'}</span></div>
      <div><span class="pf">{p.done ? mmss(Math.round(p.avg)) : '–'}</span><span class="pl">per set</span></div>
      <div><span class="pf" class:bad={p.wasted > 0}>{p.wasted > 0 ? mins(p.wasted) : '0:00'}</span><span class="pl">extra rest{p.slowN ? `, ${p.slowN} slow` : ''}</span></div>
    </div>
    {#if p.allotted}<div class="rest-track"><div class="pace-fill" id="ses-fill" style:width="{Math.min(100, (p.elapsed / p.allotted) * 100)}%"></div></div>{/if}
    <div class="pace-row">
      <span class="pace-msg">{st.text}</span>
      {#if p.ended}<button class="chip-btn" onclick={resume}>Resume</button>{:else}<button class="chip-btn" onclick={end}>End session</button>{/if}
    </div>
  </div>
{/if}
