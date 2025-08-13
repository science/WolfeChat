<script lang="ts">
  import { derived } from 'svelte/store';
  import { reasoningPanels, reasoningWindows, type ReasoningPanel } from '../stores/reasoningStore';
  import { chosenConversationId } from '../stores/stores';

  // Reasoning windows scoped to the current conversation
  const windowsForCurrent = derived(
    [reasoningWindows, chosenConversationId],
    ([$reasoningWindows, $chosenConversationId]) =>
      $reasoningWindows.filter((w) => w.convId === $chosenConversationId || w.convId === undefined)
  );
</script>

{#if $windowsForCurrent.length > 0}
  {#each $windowsForCurrent as w (w.id)}
    <details class="my-3 rounded border border-gray-500 bg-primary shadow-sm open:shadow-md" open={w.open}>
      <summary class="cursor-pointer select-none px-3 py-2 bg-secondary hover:bg-hover2 text-white/80 font-medium rounded-t">
        Reasoning
        {#if w.model}<span class="ml-2 text-xs text-white/60">({w.model})</span>{/if}
        <span class="ml-2 text-xs text-white/60">
          {$reasoningPanels.filter((p: ReasoningPanel) => p.responseId === w.id).length} message{$reasoningPanels.filter((p: ReasoningPanel) => p.responseId === w.id).length === 1 ? '' : 's'}
        </span>
      </summary>

      {#if $reasoningPanels.filter((p: ReasoningPanel) => p.responseId === w.id).length === 0}
        <div class="px-3 py-2 text-xs text-white/60 italic">Waiting for reasoning events...</div>
      {/if}

      <div class="p-3 space-y-3">
        {#each $reasoningPanels.filter((p: ReasoningPanel) => p.responseId === w.id) as p (p.id)}
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
