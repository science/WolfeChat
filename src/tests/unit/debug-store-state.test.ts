/**
 * Debug Unit Test: Store State Investigation
 *
 * This test simulates the actual store update flow to identify
 * where the disconnect is between successful filtering logic
 * and the E2E test getting 0 models
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'debug-store-flow-simulation',
  name: 'DEBUG: Simulate actual Settings.svelte store update flow',
  fn: () => {
    // Simulate the exact flow that happens in Settings.svelte

    // Step 1: Initial state - no models, no API keys
    let modelsStore = [];
    let openaiApiKey = null;
    let anthropicApiKey = null;

    debugInfo('STEP 1 - Initial state:');
    debugInfo('  modelsStore:', modelsStore.length, 'models');
    debugInfo('  openaiApiKey:', !!openaiApiKey);
    debugInfo('  anthropicApiKey:', !!anthropicApiKey);

    // Step 2: User sets OpenAI API key and clicks "Check API"
    openaiApiKey = 'sk-test123';

    debugInfo('STEP 2 - API key set:');
    debugInfo('  openaiApiKey:', !!openaiApiKey);

    // Step 3: API call succeeds, models are fetched (simulating fetchModels)
    const fetchedModels = [
      { id: 'gpt-4', provider: 'openai', created: 1687882411 },
      { id: 'gpt-4-vision-preview', provider: 'openai', created: 1698894618 },
      { id: 'gpt-3.5-turbo', provider: 'openai', created: 1677610602 },
      { id: 'dall-e-3', provider: 'openai', created: 1698785189 }
    ];

    // Models get stored in modelsStore
    modelsStore = fetchedModels;

    debugInfo('STEP 3 - Models fetched:');
    debugInfo('  modelsStore:', modelsStore.length, 'models');
    debugInfo('  Model IDs:', modelsStore.map(m => m.id));
    debugInfo('  Model providers:', modelsStore.map(m => m.provider));

    // Step 4: updateFilteredModels() is called (GPT mode)
    const mode = "GPT";
    const filteredModels = modelsStore.filter(model => {
      // First check if it's a chat model
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      // Then check provider availability
      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    debugInfo('STEP 4 - Models filtered for GPT mode:');
    debugInfo('  filteredModels:', filteredModels.length, 'models');
    debugInfo('  Filtered IDs:', filteredModels.map(m => m.id));

    // Step 5: Check what would be visible in getVisibleModels()
    // This simulates what the E2E test sees
    const visibleOptions = [
      { text: 'Select a model...' }, // Default option
      ...filteredModels.map(model => ({
        text: model.id // No provider indicators when only one provider
      }))
    ];

    const realOptions = visibleOptions.filter(opt =>
      opt.text && opt.text !== 'Select a model...' && opt.text.trim() !== ''
    );

    debugInfo('STEP 5 - What E2E test would see:');
    debugInfo('  All options:', visibleOptions.map(o => o.text));
    debugInfo('  Real options:', realOptions.map(o => o.text));
    debugInfo('  Real options count:', realOptions.length);

    // ASSERTIONS - This should match the expected E2E behavior
    if (filteredModels.length === 0) {
      throw new Error('ERROR: No models after filtering - this explains the E2E failure!');
    }

    if (realOptions.length === 0) {
      throw new Error('ERROR: No visible options - this explains the E2E failure!');
    }

    // Should have 2 chat models (gpt-4 and gpt-3.5-turbo)
    const expectedChatModels = ['gpt-4', 'gpt-3.5-turbo'].sort();
    const actualChatModels = filteredModels.map(m => m.id).sort();

    if (JSON.stringify(actualChatModels) !== JSON.stringify(expectedChatModels)) {
      throw new Error(`Expected [${expectedChatModels.join(', ')}], got [${actualChatModels.join(', ')}]`);
    }

    debugInfo('✅ DEBUG: Store flow simulation successful - filtering works as expected');
  }
});

registerTest({
  id: 'debug-api-response-structure',
  name: 'DEBUG: Verify OpenAI API response structure assumptions',
  fn: () => {
    // Test what happens if OpenAI API returns models without 'provider' field
    // (this might be what's happening in the real E2E test)

    debugInfo('TESTING: OpenAI models missing provider field');

    const modelsFromOpenAIAPI = [
      { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' }
      // Note: NO 'provider' field - this is what raw OpenAI API returns
    ];

    // Simulate what fetchModels() should do - add provider field
    const processedModels = modelsFromOpenAIAPI.map(model => ({ ...model, provider: 'openai' }));

    debugInfo('Raw API models:', modelsFromOpenAIAPI);
    debugInfo('Processed models:', processedModels);

    // Now test filtering
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;

    const filteredModels = processedModels.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    debugInfo('Filtered processed models:', filteredModels);

    if (filteredModels.length !== 2) {
      throw new Error(`Expected 2 processed models, got ${filteredModels.length}`);
    }

    // Now test what happens if provider field is missing
    const filteredRawModels = modelsFromOpenAIAPI.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    debugInfo('Filtered raw models (no provider field):', filteredRawModels);

    if (filteredRawModels.length === 0) {
      debugInfo('🚨 FOUND POTENTIAL ISSUE: Raw models with no provider field get filtered out!');
      debugInfo('This could explain why E2E test sees 0 models');
    }

    debugInfo('✅ DEBUG: API response structure test completed');
  }
});