<script lang="ts">
  import { reasoningWindows, reasoningPanels, type ReasoningPanel, type ReasoningWindow } from '../stores/reasoningStore.js';
  import { conversations } from '../stores/stores.js';

  export let convId: string;
  export let anchorIndex: number;

  // Get the conversation's unique ID
  let conversationUniqueId: string | undefined;
  $: conversationUniqueId = typeof convId === 'string' ? convId : $conversations[convId]?.id;

  // Windows for this conversation anchored to the given user message index
  let windowsForAnchor: ReasoningWindow[] = [];
  $: windowsForAnchor = ($reasoningWindows ?? []).filter(
    (w) => w.convId === conversationUniqueId && w.anchorIndex === anchorIndex
  );

  // Group panels by responseId for quick lookup per window
  let panelsByResponseId = new Map<string, ReasoningPanel[]>();
  $: {
    const m = new Map<string, ReasoningPanel[]>();
    for (const p of ($reasoningPanels ?? [])) {
      const key = p.responseId ?? '';
      const arr = m.get(key) || [];
      arr.push(p);
      m.set(String(key), arr);
    }
    panelsByResponseId = m;
  }
</script>

{#if windowsForAnchor.length > 0}
  {#each windowsForAnchor as w (w.id)}
    <details class="my-3 rounded border border-gray-500 bg-primary shadow-sm open:shadow-md" open={w.open} role="region" aria-label="Reasoning">
      <summary class="cursor-pointer select-none px-3 py-2 bg-secondary hover:bg-hover2 text-white/80 font-medium rounded-t" aria-expanded={w.open} aria-label="Reasoning window toggle">
        Reasoning
        {#if w.model}<span class="ml-2 text-xs text-white/60">({w.model})</span>{/if}
        <span class="ml-2 text-xs text-white/60">
          {((panelsByResponseId.get(w.id) ?? []).length)} message{((panelsByResponseId.get(w.id) ?? []).length === 1) ? '' : 's'}
        </span>
      </summary>

      {#if (panelsByResponseId.get(w.id) ?? []).length === 0}
        <div class="px-3 py-2 text-xs text-white/60 italic" role="status" aria-live="polite">Waiting for reasoning events...</div>
      {/if}

      <div class="p-3 space-y-3">
        {#each (panelsByResponseId.get(w.id) ?? []) as p (p.id)}
          <div class="rounded border border-gray-500" role="article" aria-label="Reasoning panel">
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
