<script lang="ts">
    import { selectedModel, selectedVoice, selectedMode, showTokens, selectedSize, selectedQuality } from '../stores/stores.js';
    import { selectedProvider, openaiApiKey, anthropicApiKey, currentApiKey } from '../stores/providerStore.js';
    import { modelsStore } from '../stores/modelStore.js';
    import { recentModelsStore } from '../stores/recentModelsStore.js';
    import { reasoningEffort, verbosity, summary } from '../stores/reasoningSettings.js';
    import { reasoningAutoCollapse } from '../stores/reasoningAutoCollapseStore.js';
    import { claudeThinkingEnabled } from '../stores/claudeReasoningSettings.js';
    import { supportsReasoning, usesMinimalReasoning } from '../services/openaiService.js';
    import { supportsAnthropicReasoning } from '../services/anthropicReasoning.js';
    import { fetchAnthropicModels, isAnthropicModel } from '../services/anthropicService.js';
    import { createEventDispatcher } from 'svelte';
    import CloseIcon from "../assets/close.svg";
    import { writable, get, derived } from "svelte/store";
  import { onMount } from 'svelte';
  import { enterBehavior } from '../stores/keyboardSettings.js';

  import {
    apiKey,
    settingsVisible,
    combinedTokens,
    defaultAssistantRole,
    type DefaultAssistantRole,
  } from "../stores/stores.js";

  const dispatch = createEventDispatcher();

  let apiCheckMessage = writable('');
  let showMessage = writable(''); 

  let filteredModels = writable([]); 
  let filteredRecentModels = writable([]); 
  $: $selectedMode, updateFilteredModels();
  $: $modelsStore, updateFilteredModels();
  $: $selectedMode, updateFilteredRecentModels();
  $: $recentModelsStore, updateFilteredRecentModels();

  // Provider-aware API key handling
  let localApiTextField: string = get(currentApiKey) || '';
  $: localApiTextField = $currentApiKey || '';

  let apiTextField = '';
  currentApiKey.subscribe(value => {
    apiTextField = value || '';
    localApiTextField = apiTextField;
  });

  // Handle provider switching
  function handleProviderChange() {
    // Don't trigger during initial load
    if (!get(selectedProvider)) return;

    // Update local field with new provider's API key
    localApiTextField = get(currentApiKey) || '';

    // Check if both API keys are available for combined model list
    const openaiKey = get(openaiApiKey);
    const anthropicKey = get(anthropicApiKey);

    if (openaiKey && anthropicKey) {
      // Both keys available - show combined model list
      fetchAllModels();
    } else if (localApiTextField) {
      // Only current provider's key available
      fetchModels(localApiTextField);
    } else {
      // No key for current provider
      modelsStore.set([]);
    }
  }

  // Helper function to determine when both providers are configured
  function shouldShowProviderIndicators() {
    const openaiKey = get(openaiApiKey);
    const anthropicKey = get(anthropicApiKey);
    return !!(openaiKey && anthropicKey);
  }

  // Watch for provider changes
  $: $selectedProvider && handleProviderChange();

  let assistantRoleField = $defaultAssistantRole.role;
  let assistantRoleTypeField = $defaultAssistantRole.type;

  apiKey.subscribe((value) => {
  localStorage.setItem("api_key", JSON.stringify(value));
});

let showTokensToggle = false;
    showTokens.subscribe(value => {
        showTokensToggle = value;
    });
    
let enterBehaviorLocal: 'newline' | 'send' = 'newline';

onMount(async() => {
   await initializeSettings();
   // Initialize from persisted store
   enterBehaviorLocal = get(enterBehavior) as 'newline' | 'send';
  });
  function handleShowTokensToggleChange() {
        showTokens.set(showTokensToggle);
    }
 function updateFilteredModels() {
        let mode = get(selectedMode);
        let availableModels = get(modelsStore);
        let newFilteredModels = [];

        if (mode === "GPT") {
            // Include chat models from available providers only
            // Use local state AND store state to handle timing issues
            const openaiKey = get(openaiApiKey) || (localApiTextField && $selectedProvider === 'OpenAI' ? localApiTextField : null);
            const anthropicKey = get(anthropicApiKey) || (localApiTextField && $selectedProvider === 'Anthropic' ? localApiTextField : null);

            newFilteredModels = availableModels.filter(model => {
                // First check if it's a chat model (not vision, dalle, or tts)
                const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
                const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

                if (!isGptChat && !isClaudeChat) return false;

                // Then check provider availability
                if (model.provider === 'openai' && !openaiKey) return false;
                if (model.provider === 'anthropic' && !anthropicKey) return false;

                return true;
            });
        } else if (mode === "GPT + Vision") {
            newFilteredModels = availableModels.filter(model => model.id.includes('vision'));
        } else if (mode === "Dall-E") {
            newFilteredModels = availableModels.filter(model => model.id.includes('dall-e'));
        } else if (mode === "TTS") {
            newFilteredModels = availableModels.filter(model => model.id.includes('tts'));
        }

        filteredModels.set(newFilteredModels);

        // Automatically select the first model in the filtered list if the current selection is not in the new list
        if (newFilteredModels.length > 0 && (!get(selectedModel) || !newFilteredModels.some(model => model.id === get(selectedModel)))) {
            selectedModel.set(newFilteredModels[0].id);
        }
    }

    function updateFilteredRecentModels() {
        let mode = get(selectedMode);
        let recent = get(recentModelsStore) || [];
        let newFilteredRecent = [];

        if (mode === "GPT") {
            // Include recent chat models from available providers only
            // Use local state AND store state to handle timing issues
            const openaiKey = get(openaiApiKey) || (localApiTextField && $selectedProvider === 'OpenAI' ? localApiTextField : null);
            const anthropicKey = get(anthropicApiKey) || (localApiTextField && $selectedProvider === 'Anthropic' ? localApiTextField : null);

            newFilteredRecent = recent.filter(model => {
                // First check if it's a chat model (not vision, dalle, or tts)
                const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
                const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

                if (!isGptChat && !isClaudeChat) return false;

                // Then check provider availability
                if (model.provider === 'openai' && !openaiKey) return false;
                if (model.provider === 'anthropic' && !anthropicKey) return false;

                return true;
            });
        } else if (mode === "GPT + Vision") {
            newFilteredRecent = recent.filter(model => model.id.includes('vision'));
        } else if (mode === "Dall-E") {
            newFilteredRecent = recent.filter(model => model.id.includes('dall-e'));
        } else if (mode === "TTS") {
            newFilteredRecent = recent.filter(model => model.id.includes('tts'));
        }

        filteredRecentModels.set(newFilteredRecent);
    }
async function initializeSettings() {
    // Always use GPT mode since we removed mode selection
    selectedMode.set("GPT");

    // Auto-refresh if cache is empty when opening settings
    const cachedModels = get(modelsStore);
    const openaiKey = get(openaiApiKey);
    const anthropicKey = get(anthropicApiKey);

    if ((!cachedModels || cachedModels.length === 0)) {
        if (openaiKey && anthropicKey) {
            // Both keys available - fetch all models
            await fetchAllModels();
        } else if (openaiKey || anthropicKey) {
            // Only one provider available
            const key = get(currentApiKey);
            if (key) {
                await fetchModels(key);
            }
        }
    }

    updateFilteredModels();
    updateFilteredRecentModels();
}

async function checkAPIConnection() {
  if (!localApiTextField) {
    showMessage.set("yellow");
    apiCheckMessage.set("API key is missing.");
    return;
  }

  try {
    if ($selectedProvider === 'Anthropic') {
      // Validate Anthropic API key
      await fetchAnthropicModels(localApiTextField);
      showMessage.set("green");
      apiCheckMessage.set("Anthropic API connection succeeded.");
    } else {
      // Existing OpenAI validation
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localApiTextField}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        showMessage.set("green");
        apiCheckMessage.set("OpenAI API connection succeeded.");
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    // Save the settings and refresh models
    handleSave();

    // Check if both providers have API keys for combined model list
    const openaiKey = get(openaiApiKey);
    const anthropicKey = get(anthropicApiKey);

    if (openaiKey && anthropicKey) {
      await fetchAllModels();
    } else {
      await fetchModels(localApiTextField);
    }
    updateFilteredModels();
  } catch (error) {
    console.error(`${$selectedProvider} API connection failed:`, error);
    showMessage.set("red");
    apiCheckMessage.set(`${$selectedProvider} API connection failed: ${error.message}`);
  }
}



async function fetchModels(apiKey: string, provider?: string) {
  if (!apiKey) {
    showMessage.set("yellow");
    console.log("showMessage", showMessage)
    console.error("API key is missing.");
    return;
  }

  const targetProvider = provider || get(selectedProvider);

  try {
    let models = [];

    if (targetProvider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      models = data.data.map(model => ({ ...model, provider: 'openai' }));
    } else if (targetProvider === 'Anthropic') {
      models = await fetchAnthropicModels(apiKey);
    }

    const sortedModels = models.sort((a, b) => (b.created || 0) - (a.created || 0));
    modelsStore.set(sortedModels);
    // Persistence handled by modelsStore subscriber
  } catch (error) {
    console.error(`Failed to fetch ${targetProvider} models:`, error);
    showMessage.set("red");
    apiCheckMessage.set(`Failed to fetch ${targetProvider} models.`);
  }
}

// Fetch models from all providers when both API keys are available
async function fetchAllModels() {
  const openaiKey = get(openaiApiKey);
  const anthropicKey = get(anthropicApiKey);
  let allModels = [];

  try {
    if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const data = await response.json();
        const openaiModels = data.data.map(model => ({ ...model, provider: 'openai' }));
        allModels.push(...openaiModels);
      }
    }

    if (anthropicKey) {
      try {
        const anthropicModels = await fetchAnthropicModels(anthropicKey);
        allModels.push(...anthropicModels);
      } catch (error) {
        console.log("Anthropic models fetch failed:", error);
      }
    }

    if (allModels.length > 0) {
      const sortedModels = allModels.sort((a, b) => (b.created || 0) - (a.created || 0));
      modelsStore.set(sortedModels);
    }
  } catch (error) {
    console.error("Failed to fetch models from providers:", error);
  }
}

let isRefreshing = false;
async function refreshModels() {
  const openaiKey = get(openaiApiKey);
  const anthropicKey = get(anthropicApiKey);

  if (!openaiKey && !anthropicKey) {
    showMessage.set("yellow");
    apiCheckMessage.set("API key is missing.");
    return;
  }

  try {
    isRefreshing = true;

    if (openaiKey && anthropicKey) {
      // Both keys available - fetch from all providers
      await fetchAllModels();
    } else {
      // Only one provider available
      const key = get(currentApiKey);
      if (key) {
        await fetchModels(key);
      }
    }

    updateFilteredModels();
  } finally {
    isRefreshing = false;
  }
}
  function clearTokens() {
    combinedTokens.set(0);
  }

  function handleSave() {
  defaultAssistantRole.set({ role: assistantRoleField, type: assistantRoleTypeField });

  // Save to the correct provider-specific store
  if ($selectedProvider === 'OpenAI') {
    openaiApiKey.set(localApiTextField);
  } else {
    anthropicApiKey.set(localApiTextField);
  }

  // Ensure both provider stores are populated from localStorage if they exist
  // This handles the case where both providers were configured during this session
  try {
    const storedOpenAI = localStorage.getItem('openai_api_key');
    const storedAnthropic = localStorage.getItem('anthropic_api_key');

    if (storedOpenAI) {
      const parsedOpenAI = JSON.parse(storedOpenAI);
      if (parsedOpenAI && !get(openaiApiKey)) {
        openaiApiKey.set(parsedOpenAI);
      }
    }

    if (storedAnthropic) {
      const parsedAnthropic = JSON.parse(storedAnthropic);
      if (parsedAnthropic && !get(anthropicApiKey)) {
        anthropicApiKey.set(parsedAnthropic);
      }
    }
  } catch (error) {
    console.log('Error syncing provider keys:', error);
  }

  // Keep legacy apiKey for backward compatibility
  apiKey.set(localApiTextField);

  localStorage.setItem('selectedModel', get(selectedModel));
  localStorage.setItem('selectedVoice', get(selectedVoice));
  localStorage.setItem('selectedMode', get(selectedMode));

  dispatch('settings-changed');
  console.log("Settings saved.");
  }





  function handleClose() {
    settingsVisible.set(false);
  }

  function handleSaveAndClose() {
handleSave();
handleClose();
  }

</script>

<!-- Settings.svelte -->
<div class="fixed z-50 inset-0  overflow-y-auto animate-fade-in">
  <div class="flex items-center  justify-center min-h-screen">
    <div class="bg-primary text-white rounded-lg shadow-xl p-8 relative">
      <button
        class="absolute top-0 right-0 mt-2 mr-2 text-gray-500 hover:text-gray-600"
        on:click={handleClose}
      >
        <img class="icon-white w-8" alt="Close" src={CloseIcon} />
      </button>
      <h2 class="text-xl font-bold mb-4">Settings</h2>

    <!-- Provider configuration group -->
    <div class="border border-gray-600 rounded-lg p-4 mb-6">
      <div class="mb-4">
        <label for="provider-selection" class="block font-medium mb-2">Provider</label>
        <select bind:value={$selectedProvider} class="border text-black border-gray-300 p-2 rounded w-full" id="provider-selection">
          <option value="OpenAI">OpenAI</option>
          <option value="Anthropic">Anthropic</option>
        </select>
      </div>

      <div class="mb-4">
    <label for="api-key" class="block font-medium mb-2">{$selectedProvider} API Key</label>
  <div class="flex items-center">
    <input
      type="password"
      id="api-key"
      name="api-key"
      class="border text-black border-gray-300 p-2 rounded w-full"
      bind:value={localApiTextField}
    />
    <button
      class="ml-2 bg-blue-600 hover:bg-blue-400 transition-colors duration-800 text-white p-2 rounded text-xs"
      on:click={checkAPIConnection}
    >Check API</button>
  </div>
  <p
  class="mt-2 text-white rounded-lg p-2 
  {($showMessage === 'yellow' ? 'bg-yellow-600' : '')} 
  {($showMessage === 'red' ? 'bg-red-600' : '')} 
  {($showMessage === 'green' ? 'bg-green-600' : '')}"
  style="display: {showMessage ? 'block' : 'none'};">
  { $apiCheckMessage }
</p>

</div>


      

      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label for="model-selection" class="block font-medium">Model Selection</label>
          <button
            class="ml-2 text-sm bg-gray-700 hover:bg-gray-600 transition-colors duration-200 text-white px-2 py-1 rounded"
            on:click={refreshModels}
            disabled={isRefreshing}
            title="Refresh models"
          >
            ↻
          </button>
        </div>
        <select bind:value={$selectedModel} class="border text-black border-gray-300 p-2 rounded w-full" id="model-selection">
    {#if ($filteredRecentModels && $filteredRecentModels.length) || ($filteredModels && $filteredModels.length)}
      {#if $filteredRecentModels && $filteredRecentModels.length}
        <optgroup label="Recently used">
          {#each $filteredRecentModels as r}
            <option value={r.id}>{r.id}</option>
          {/each}
        </optgroup>
      {/if}

      {#if get(openaiApiKey) && $filteredModels.filter(m => m.provider === 'openai').length > 0}
        <optgroup label="OpenAI">
          {#each $filteredModels.filter(m => m.provider === 'openai').sort((a, b) => a.id.localeCompare(b.id)) as model}
            {#if !$filteredRecentModels.find(r => r.id === model.id)}
              <option value={model.id}>{model.id}</option>
            {/if}
          {/each}
        </optgroup>
      {/if}

      {#if get(anthropicApiKey) && $filteredModels.filter(m => m.provider === 'anthropic').length > 0}
        <optgroup label="Anthropic">
          {#each $filteredModels.filter(m => m.provider === 'anthropic').sort((a, b) => a.id.localeCompare(b.id)) as model}
            {#if !$filteredRecentModels.find(r => r.id === model.id)}
              <option value={model.id}>{model.id}</option>
            {/if}
          {/each}
        </optgroup>
      {/if}
    {:else}
      <option disabled selected>No models available</option>
    {/if}
</select>
        {#if supportsReasoning($selectedModel) && !isAnthropicModel($selectedModel)}
        <!-- OpenAI Reasoning Settings -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label for="settings-reasoning-effort" class="block font-medium mb-1">Reasoning</label>
            <select id="settings-reasoning-effort" bind:value={$reasoningEffort} class="border text-black border-gray-300 p-2 rounded w-full">
              {#if !usesMinimalReasoning($selectedModel)}
                <option value="none">none</option>
              {/if}
              {#if usesMinimalReasoning($selectedModel)}
                <option value="minimal">minimal</option>
              {/if}
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div>
            <label for="settings-verbosity" class="block font-medium mb-1">Verbosity</label>
            <select id="settings-verbosity" bind:value={$verbosity} class="border text-black border-gray-300 p-2 rounded w-full">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div>
            <label for="settings-summary" class="block font-medium mb-1">Summary</label>
            <select id="settings-summary" bind:value={$summary} class="border text-black border-gray-300 p-2 rounded w-full">
              <option value="auto">auto</option>
              <option value="detailed">detailed</option>
              <option value="null">null</option>
            </select>
          </div>
        </div>
        <div class="mt-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="settings-reasoning-auto-collapse"
              bind:checked={$reasoningAutoCollapse}
              class="w-4 h-4"
            />
            <span class="text-sm">Auto-collapse reasoning window when complete</span>
          </label>
        </div>
        {:else if supportsAnthropicReasoning($selectedModel)}
        <!-- Claude Thinking Settings -->
        <div class="mt-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="settings-claude-thinking-enabled"
              bind:checked={$claudeThinkingEnabled}
              class="w-4 h-4"
            />
            <span class="font-medium">Extended Thinking</span>
            <span class="text-sm text-gray-400">(default for Claude reasoning models)</span>
          </label>
        </div>
        <div class="mt-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="settings-reasoning-auto-collapse"
              bind:checked={$reasoningAutoCollapse}
              class="w-4 h-4"
            />
            <span class="text-sm">Auto-collapse reasoning window when complete</span>
          </label>
        </div>
        {/if}
      </div>
    </div>
    <!-- End provider configuration group -->

      {#if $selectedModel.startsWith('tts')}
<div class="mb-4">
  <label for="voice-selection" class="block font-medium mb-2">Voice Selection</label>
  <select bind:value={$selectedVoice} class="border text-black border-gray-300 p-2 rounded w-full" id="voice-selection">
    <option value="alloy">Alloy</option>
    <option value="echo">Echo</option>
    <option value="fable">Fable</option>
    <option value="onyx">Onyx</option>
    <option value="nova">Nova</option>
    <option value="shimmer">Shimmer</option>
  </select>
</div>
{/if}


{#if $selectedModel.startsWith('dall-e')}
<div class="mb-4">
  <label for="size-selection" class="block font-medium mb-2">Image Size</label>
  <select bind:value={$selectedSize} class="border text-black border-gray-300 p-2 rounded w-full" id="size-selection">
    <option value="1024x1024">1024x1024</option>
    <option value="1024x1792">1024x1792</option>
    <option value="1792x1024">1792x1024</option>
  </select>
</div>
<div class="mb-4">
  <label for="quality-selection" class="block font-medium mb-2">Image Quality</label>
  <select bind:value={$selectedQuality} class="border text-black border-gray-300 p-2 rounded w-full" id="quality-selection">
    <option value="standard">standard</option>
    <option value="hd">hd</option>
  </select>

</div>
{/if}


<div class="mb-4">
  <label for="enter-behavior" class="block font-medium mb-2">Enter key behavior</label>
  <select id="enter-behavior" bind:value={enterBehaviorLocal} on:change={() => enterBehavior.set(enterBehaviorLocal)} class="border text-black border-gray-300 p-2 rounded w-full">
    <option value="newline">Insert a new line</option>
    <option value="send">Send message</option>
  </select>
  <p class="text-xs text-gray-400 mt-1">Tip: Shift+Enter always inserts a new line. Ctrl+Enter always sends the message.</p>
</div>

<div class="mb-4">
  <label for="api-key" class="block font-medium mb-2">Default Assistant role</label>
  <input class="border text-black border-gray-300 p-2 rounded w-full" bind:value={assistantRoleField} />
  <div class="flex items-center my-2 space-x-2">
    <select bind:value={assistantRoleTypeField} class="text-black p-2 rounded focus:outline-none focus:bg-white max-w-24">
      <option value="system">System</option>
      <option value="user">User</option>
    </select>
    <a href="https://platform.openai.com/docs/guides/prompt-engineering/tactic-ask-the-model-to-adopt-a-persona" target="_blank" rel="noreferrer" class="text-blue-300 transition underline text-xs hover:text-blue-500">Which should I use?</a>
  </div>
</div>

      <div class="flex justify-between items-start">
        <div class="flex flex-col">
          <p class="font-bold mb-2">
            Estimated Token Usage: {$combinedTokens.toFixed(0)}
          </p>
          <p class="">
            Estimated Cost with GPT-4: ${(
              ($combinedTokens / 1000) *
              0.02
            ).toFixed(2)}</p>
             <p class="text-blue-300 transition underline text-xs hover:text-blue-500 mt-2">
              <a href="https://openai.com/pricing" target="_blank" rel="noreferrer" >See all API pricing</a> </p>

              <div class="mt-4">
                <label for="show-tokens-toggle" class="flex items-center cursor-pointer">
                  <div class="relative">
                    <input type="checkbox" id="show-tokens-toggle" class="sr-only" aria-label="Show estimated tokens in sidebar" bind:checked={showTokensToggle} on:change={handleShowTokensToggleChange}>
                    <div class="block bg-gray-600 w-14 h-8 rounded-full"></div>
                    <div class="dot absolute left-1 top-1 bg-gray-100 w-6 h-6 rounded-full transition"></div>
                  </div>
                  <div class="ml-3 text-gray-200">
                    Show estimated tokens in sidebar
                  </div>
                </label>
              </div>


        </div>
        <button
          on:click={clearTokens}
          class="bg-warning hover:bg-warningHover transition-colors duration-200 text-white ml-10 px-4 py-2 flex align-middle justify-center rounded"
          style="font-size: 1rem"
        >
          <img class="icon-white w-3" alt="Close" src={CloseIcon} />
        </button>
      </div>
      
      <button
        class="bg-good hover:bg-good2 transition-colors duration-200 text-white py-2 px-4 mt-8 rounded"
        on:click={handleSaveAndClose}>Save</button
      >
    </div>
  </div>
</div>

<style>
  @import '../styles/settings.css';
 
</style>
