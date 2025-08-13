<script lang="ts">
  import { derived } from 'svelte/store';
  import { reasoningPanels, reasoningSSEEvents, type ReasoningPanel } from '../stores/reasoningStore';
  import { chosenConversationId } from '../stores/stores';

  // Panels scoped to current conversation (or global panels without convId)
  const panelsForCurrent = derived(
    [reasoningPanels, chosenConversationId],
    ([$reasoningPanels, $chosenConversationId]) =>
      ($reasoningPanels as ReasoningPanel[]).filter(
        (p) => p.convId === $chosenConversationId || p.convId === undefined
      )
  );

  // All SSE event entries for current conversation (compact badges)
  const sseEventsForCurrent = derived(
    [reasoningSSEEvents, chosenConversationId],
    ([$events, $chosenConversationId]) =>
      $events.filter((e) => e.convId === $chosenConversationId || e.convId === undefined)
  );

  // Only show the collapsible if there is any reasoning content:
  // - at least one reasoning panel, or
  // - at least one SSE event whose type starts with "response.reasoning"
  const hasReasoningUI = derived(
    [panelsForCurrent, sseEventsForCurrent],
    ([$panels, $events]) =>
      $panels.length > 0 || $events.some((e) => e.type.startsWith('response.reasoning'))
  );

  function shortType(t: string): string {
    // Compact representation for badges
    return t
      .replace(/^response\./, 'r.')
      .replace(/_summary/g, '.summary')
      .replace(/_text/g, '.text');
  }
</script>

{#if $hasReasoningUI}
  <details class="my-3 rounded border border-gray-300 bg-white shadow-sm open:shadow-md" open>
    <summary class="cursor-pointer select-none px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-t">
      Reasoning
      <span class="ml-2 text-xs text-gray-500">{$panelsForCurrent.length} message{$panelsForCurrent.length === 1 ? '' : 's'}</span>
    </summary>

    {#if $sseEventsForCurrent.length > 0}
      <div class="px-3 py-2 text-xs text-gray-600">
        Events:
        <div class="mt-1 flex flex-wrap gap-1">
          {#each $sseEventsForCurrent as e, i}
            <span class="rounded bg-gray-100 px-1.5 py-0.5 border border-gray-200 font-mono">{i + 1}:{shortType(e.type)}</span>
          {/each}
        </div>
      </div>
    {/if}

    <div class="p-3 space-y-3">
      {#each $panelsForCurrent as p (p.id)}
        <div class="rounded border border-gray-200">
          <div class="flex items-center justify-between px-3 py-2 bg-gray-50">
            <div class="text-sm font-semibold text-gray-700">
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
            <pre class="whitespace-pre-wrap break-words text-sm text-gray-800">{p.text}</pre>
          </div>
        </div>
      {/each}
    </div>
  </details>
{/if}
