<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { selectedModel, conversations, chosenConversationId } from '../stores/stores.js';
  import { modelsStore } from '../stores/modelStore.js';
  import { recentModelsStore } from '../stores/recentModelsStore.js';
  import { reasoningEffort, verbosity, summary } from '../stores/reasoningSettings.js';
  import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore';
  import { supportsReasoning } from '../services/openaiService.js';

  const dispatch = createEventDispatcher();

  let open = false;
  function toggle() { open = !open; }
  const currentCQ = conversationQuickSettings.currentSettingsWritable(chosenConversationId, (id) => {
    const idx = id as number | null | undefined;
    if (idx == null) return null;
    const conv = $conversations?.[idx];
    return conv?.id ?? null;
  });
  $: effectiveModel = $currentCQ.model || $selectedModel || '';
  $: isReasoningModel = supportsReasoning(effectiveModel);

   async function clearConversation() {
     try {
       const idx = get(chosenConversationId);
       const convs = get(conversations);
       const oldConv = convs[idx];
       // Create a new empty chat at end and select it
       const newConv = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, history: [], conversationTokens: 0, assistantRole: convs[idx]?.assistantRole ?? "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.", title: '' };
       conversations.update((arr) => [...arr, newConv]);
       chosenConversationId.set(get(conversations).length - 1);
       // Delete the old conversation by index
       conversations.update((arr) => arr.filter((_, i) => i !== idx));
       dispatch('input-cleared');
     } catch (e) {
       console.error('Failed to clear conversation', e);
     }
   }

   function getChatContainer(): HTMLElement | null {
    const root = document.querySelector('.main-content-area') as HTMLElement | null;
    if (!root) return null;
    return root.querySelector('.overflow-y-auto') as HTMLElement | null;
  }

  function getAnchors(container: HTMLElement): number[] {
    const msgEls = Array.from(container.querySelectorAll('.message')) as HTMLElement[];
    const cRect = container.getBoundingClientRect();
    return msgEls.map((el) => {
      const r = el.getBoundingClientRect();
      return (r.top - cRect.top) + container.scrollTop;
    });
  }

  import ClearChat from '../assets/ClearChat.svg';
  import { get } from 'svelte/store';

  function navigateAnchors(direction: 'up' | 'down') {
    const container = getChatContainer();
    if (!container) return;

    const anchors = getAnchors(container);
    if (!anchors.length) return;

    const tol = 10;
    const st = container.scrollTop;

    const nearIdx = anchors.findIndex((a) => Math.abs(a - st) <= tol);
    let floorIdx = -1;
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i] <= st) floorIdx = i;
      else break;
    }

    if (direction === 'up') {
      // Deterministic behavior:
      // - If at/near an anchor i:
      //   - if i > 0, go to anchors[i-1]
      //   - if i === 0, go to top (0)
      // - If between anchors: snap to anchors[floorIdx] (current turn start), or 0 if none
      (window as any).__chatNavLockUntil = performance.now() + 250;
      if (nearIdx >= 0) {
        if (nearIdx > 0) {
          container.scrollTop = anchors[nearIdx - 1];
        } else {
          container.scrollTop = 0;
        }
        return;
      }
      if (floorIdx >= 0) {
        container.scrollTop = anchors[floorIdx];
      } else {
        container.scrollTop = 0;
      }
      return;
    }

    // direction === 'down'
    let targetIdx = (nearIdx >= 0) ? (nearIdx + 1) : (floorIdx + 1);
    (window as any).__chatNavLockUntil = performance.now() + 250;
    if (targetIdx >= anchors.length) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    } else {
      container.scrollTop = anchors[targetIdx];
    }
  }
</script>

<div class="w-full">
  <button
    class="w-full text-left bg-secondary/60 hover:bg-secondary px-4 py-2 rounded-md border border-gray-600 flex justify-between items-center"
    on:click={toggle}
    aria-expanded={open}
    aria-controls="quick-settings-body"
    type="button"
  >
     <span class="font-bold">Quick Settings M: {effectiveModel || '—'}, V: {isReasoningModel ? ($currentCQ.verbosity || 'low') : '—'} | R: {isReasoningModel ? ($currentCQ.reasoningEffort || 'minimal') : '—'} | S: {isReasoningModel ? ($currentCQ.summary || 'auto') : '—'}</span>
    <span class="ml-2 text-sm">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <div id="quick-settings-body" class="mt-3 bg-secondary/40 rounded-md p-3 border border-gray-700">
      <!-- API Model selector -->
      <div class="font-bold text-l mb-2">
        <label for="current-model-select" class="mr-2">API Model</label>
        <select
           id="current-model-select"
           class="bg-primary text-white/80 p-1 rounded border border-gray-500"
           data-testid="model-select"
           aria-label="Model"
           bind:value={$currentCQ.model}
         >
          {#if $modelsStore && $modelsStore.length > 0}
            {#if $recentModelsStore && $recentModelsStore.length > 0}
              <optgroup label="Recently used">
                {#each $recentModelsStore as r}
                  <option value={r.id}>{r.id}</option>
                {/each}
              </optgroup>
            {/if}
            <optgroup label="All models">
              {#each $modelsStore as model}
                {#if !$recentModelsStore || !$recentModelsStore.find(r => r.id === model.id)}
                  <option value={model.id}>{model.id}</option>
                {/if}
              {/each}
            </optgroup>
          {:else}
            <option disabled selected>No models loaded</option>
          {/if}
        </select>
      </div>

      {#if isReasoningModel}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div>
          <label for="reasoning-effort" class="mr-2">Reasoning:</label>
           <select id="reasoning-effort" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$currentCQ.reasoningEffort}>
            <option value="minimal">minimal</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div>
          <label for="verbosity" class="mr-2">Verbosity:</label>
           <select id="verbosity" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$currentCQ.verbosity}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div>
          <label for="summary" class="mr-2">Summary:</label>
           <select id="summary" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$currentCQ.summary}>
            <option value="auto">auto</option>
            <option value="detailed">detailed</option>
            <option value="null">null</option>
          </select>
        </div>
      </div>
      {/if}

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="bg-primary text-white/80 px-3 py-1 rounded border border-gray-600 hover:bg-secondary"
          title="Go to previous turn"
          aria-label="Go to previous turn"
          on:click={() => navigateAnchors('up')}
        >▲ Up</button>

        <button
          type="button"
          class="bg-primary text-white/80 px-3 py-1 rounded border border-gray-600 hover:bg-secondary"
          title="Go to next turn"
          aria-label="Go to next turn"
          on:click={() => navigateAnchors('down')}
        >▼ Down</button>

        <button
          type="button"
          class="bg-primary text-white/80 px-3 py-1 rounded border border-gray-600 hover:bg-secondary flex items-center justify-center"
          title="Clear Conversation"
          aria-label="Clear Conversation"
          on:click={clearConversation}
        >
          <img src={ClearChat} alt="Clear Conversation" class="w-5 h-5" />
        </button>
      </div>

      <slot />
    </div>
  {/if}
</div>
