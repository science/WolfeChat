<script lang="ts">
  import { selectedModel } from '../stores/stores';
  import { modelsStore } from '../stores/modelStore';
  import { recentModelsStore } from '../stores/recentModelsStore';
  import { reasoningEffort, verbosity, summary } from '../stores/reasoningSettings';
  import { supportsReasoning } from '../services/openaiService';

  let open = false;
  function toggle() { open = !open; }
  $: isReasoningModel = supportsReasoning($selectedModel || '');
</script>

<div class="w-full">
  <button
    class="w-full text-left bg-secondary/60 hover:bg-secondary px-4 py-2 rounded-md border border-gray-600 flex justify-between items-center"
    on:click={toggle}
    aria-expanded={open}
    aria-controls="quick-settings-body"
    type="button"
  >
    <span class="font-bold">Quick Settings M: {$selectedModel || '—'}, V: {isReasoningModel ? $verbosity : '—'} | R: {isReasoningModel ? $reasoningEffort : '—'} | S: {isReasoningModel ? $summary : '—'}</span>
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
          bind:value={$selectedModel}
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
          <select id="reasoning-effort" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$reasoningEffort}>
            <option value="minimal">minimal</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div>
          <label for="verbosity" class="mr-2">Verbosity:</label>
          <select id="verbosity" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$verbosity}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div>
          <label for="summary" class="mr-2">Summary:</label>
          <select id="summary" class="bg-primary text-white/80 p-1 rounded border border-gray-500" bind:value={$summary}>
            <option value="auto">auto</option>
            <option value="detailed">detailed</option>
            <option value="null">null</option>
          </select>
        </div>
      </div>
      {/if}

      <slot />
    </div>
  {/if}
</div>
