<script lang="ts">
  import { derived } from 'svelte/store';
  import { reasoningWindows, reasoningPanels, type ReasoningPanel } from '../stores/reasoningStore';

  export let convId: number;
  export let anchorIndex: number;

  // Windows for this conversation anchored to the given user message index
  const windowsForAnchor = derived(reasoningWindows, ($wins) =>
    $wins.filter(
      (w) =>
        (w.convId === convId || w.convId === undefined) &&
        w.anchorIndex === anchorIndex
    )
  );

  // Group panels by responseId for quick lookup per window
  const panelsByResponseId = derived(reasoningPanels, ($panels) => {
    const m = new Map<string, ReasoningPanel[]>();
    for (const p of $panels) {
      const key = p.responseId ?? '';
      const arr = m.get(key) || [];
      arr.push(p);
      m.set(String(key), arr);
    }
    return m;
  });
</script>

{#if $windowsForAnchor.length > 0}
  {#each $windowsForAnchor as w (w.id)}
    <details class="my-3 rounded border border-gray-500 bg-primary shadow-sm open:shadow-md" open={w.open}>
      <summary class="cursor-pointer select-none px-3 py-2 bg-secondary hover:bg-hover2 text-white/80 font-medium rounded-t">
        Reasoning
        {#if w.model}<span class="ml-2 text-xs text-white/60">({w.model})</span>{/if}
        <span class="ml-2 text-xs text-white/60">
          {(($panelsByResponseId.get(w.id) ?? []).length)} message{(($panelsByResponseId.get(w.id) ?? []).length === 1) ? '' : 's'}
        </span>
      </summary>

      {#if ($panelsByResponseId.get(w.id) ?? []).length === 0}
        <div class="px-3 py-2 text-xs text-white/60 italic">Waiting for reasoning events...</div>
      {/if}

      <div class="p-3 space-y-3">
        {#each ($panelsByResponseId.get(w.id) ?? []) as p (p.id)}
          <div class="rounded border border-gray-500">
            <div class="flex items-center justify-between px-3 py-2 bg-secondary">
              <div class="text-sm font-semibold text-white/80">
                {p.kind === 'summary' ? 'Reasoning summary' : 'Reasoning'}
              </div>
              <div class="text-xs">
                {#if p.done}
                  <span class="text-green-600">done</span>
                {:else}
                  <span class="text-amber-600">in progress</span>
                {/if}
              </div>
            </div>
            <div class="px-3 py-2">
              <pre class="whitespace-pre-wrap break-words text-sm text-white/80">{p.text}</pre>
            </div>
          </div>
        {/each}
      </div>
    </details>
  {/each}
{/if}
