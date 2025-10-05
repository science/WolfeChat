/**
 * Complete Model Flow Simulation
 *
 * Tests the entire flow from API response to DOM-ready models
 * to identify where the E2E disconnect occurs
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'complete-flow-api-to-dom',
  name: 'Simulate complete flow: API response → store → filtering → DOM',
  fn: () => {
    debugInfo('=== Testing Complete Model Flow ===');

    // STEP 1: Simulate OpenAI API response (what fetchModels receives)
    const openaiApiResponse = {
      data: [
        { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
        { id: 'gpt-4-vision-preview', object: 'model', created: 1698894618, owned_by: 'openai' },
        { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' },
        { id: 'dall-e-3', object: 'model', created: 1698785189, owned_by: 'openai' },
        { id: 'tts-1', object: 'model', created: 1681940951, owned_by: 'openai' }
      ]
    };

    debugInfo('Step 1 - Raw API response:');
    debugInfo('  Model count:', openaiApiResponse.data.length);
    debugInfo('  Model IDs:', openaiApiResponse.data.map(m => m.id));

    // STEP 2: Simulate what fetchModels() should do - add provider field
    const processedModels = openaiApiResponse.data.map(model => ({
      ...model,
      provider: 'openai'
    }));

    debugInfo('Step 2 - Processed for store:');
    debugInfo('  Processed count:', processedModels.length);
    debugInfo('  Have provider field:', processedModels.every(m => m.provider === 'openai'));

    // STEP 3: Simulate modelsStore.set(processedModels)
    let modelsStore = processedModels;

    debugInfo('Step 3 - Stored in modelsStore:');
    debugInfo('  Store count:', modelsStore.length);

    // STEP 4: Simulate Settings.svelte reactive state
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;
    const mode = 'GPT'; // or whatever the current mode is

    debugInfo('Step 4 - Component state:');
    debugInfo('  Mode:', mode);
    debugInfo('  OpenAI key exists:', !!openaiApiKey);
    debugInfo('  Anthropic key exists:', !!anthropicApiKey);

    // STEP 5: Simulate updateFilteredModels() being called
    const availableModels = modelsStore.filter(model => {
      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;
      return true;
    });

    debugInfo('Step 5 - Available models (provider filtered):');
    debugInfo('  Available count:', availableModels.length);
    debugInfo('  Available IDs:', availableModels.map(m => m.id));

    // STEP 6: Simulate mode-specific filtering (GPT mode = chat models only)
    const filteredModels = availableModels.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      return true;
    });

    debugInfo('Step 6 - Mode filtered models:');
    debugInfo('  Chat model count:', filteredModels.length);
    debugInfo('  Chat model IDs:', filteredModels.map(m => m.id));

    // STEP 7: Simulate getVisibleModels() - what appears in DOM
    const shouldShowProviderIndicators = !!(openaiApiKey && anthropicApiKey);

    const visibleOptions = [
      { text: 'Select a model...', value: '' }
    ];

    filteredModels.forEach(model => {
      const displayName = shouldShowProviderIndicators
        ? `${model.id} (${model.provider})`
        : model.id;

      visibleOptions.push({
        text: displayName,
        value: model.id
      });
    });

    debugInfo('Step 7 - DOM options:');
    debugInfo('  Total options:', visibleOptions.length);
    debugInfo('  Option texts:', visibleOptions.map(o => o.text));

    // STEP 8: Simulate what E2E test looks for
    const realOptions = visibleOptions.filter(opt =>
      opt.value && opt.value !== '' && opt.text !== 'Select a model...'
    );

    debugInfo('Step 8 - What E2E test sees:');
    debugInfo('  Real options count:', realOptions.length);
    debugInfo('  Real option texts:', realOptions.map(o => o.text));

    // ASSERTIONS: This should match E2E expectations
    if (realOptions.length === 0) {
      throw new Error('❌ FLOW ISSUE: No real options would be visible to E2E test!');
    }

    // Should have 2 chat models (gpt-4 and gpt-3.5-turbo)
    if (realOptions.length !== 2) {
      throw new Error(`❌ FLOW ISSUE: Expected 2 chat models, E2E would see ${realOptions.length}`);
    }

    const expectedModels = ['gpt-4', 'gpt-3.5-turbo'];
    const actualModelTexts = realOptions.map(o => o.text).sort();

    if (JSON.stringify(actualModelTexts) !== JSON.stringify(expectedModels.sort())) {
      throw new Error(`❌ FLOW ISSUE: Expected [${expectedModels.join(', ')}], E2E would see [${actualModelTexts.join(', ')}]`);
    }

    debugInfo('✅ Complete flow simulation successful - E2E should see models');

    // OUTPUT: Critical checkpoints for debugging real flow
    debugInfo('\n🔍 DEBUGGING CHECKPOINTS FOR REAL E2E:');
    debugInfo('1. Check if modelsStore contains models after API call');
    debugInfo('2. Check if provider field is added to models');
    debugInfo('3. Check if API keys are properly detected');
    debugInfo('4. Check if updateFilteredModels() is actually called');
    debugInfo('5. Check if DOM updates after filteredModels changes');
  }
});

registerTest({
  id: 'debug-missing-provider-field',
  name: 'DEBUG: What happens if models lack provider field?',
  fn: () => {
    debugInfo('=== Testing Missing Provider Field Scenario ===');

    // Simulate if fetchModels() fails to add provider field
    const modelsWithoutProvider = [
      { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' }
      // No provider field!
    ];

    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;

    debugInfo('Models in store (no provider field):', modelsWithoutProvider);

    // Test provider filtering with missing provider field
    const availableModels = modelsWithoutProvider.filter(model => {
      debugInfo(`Checking model ${model.id}: provider="${model.provider}"`);

      if (model.provider === 'openai' && !openaiApiKey) {
        debugInfo(`  Filtered out: OpenAI model but no key`);
        return false;
      }
      if (model.provider === 'anthropic' && !anthropicApiKey) {
        debugInfo(`  Filtered out: Anthropic model but no key`);
        return false;
      }

      debugInfo(`  Kept: provider check passed`);
      return true;
    });

    debugInfo('Available after provider filtering:', availableModels.length);

    if (availableModels.length === 0) {
      debugInfo('🚨 FOUND POTENTIAL ROOT CAUSE: Missing provider field causes all models to be filtered out!');
      debugInfo('E2E test would see 0 models because provider filtering fails');
    }

    // Since model.provider is undefined, the conditions:
    // - model.provider === 'openai' && !openaiApiKey  (false && true = false)
    // - model.provider === 'anthropic' && !anthropicApiKey (false && true = false)
    // Both return false, so return true - models should pass through

    if (availableModels.length === modelsWithoutProvider.length) {
      debugInfo('✅ Models without provider field pass provider filtering');
    }

    // Continue with mode filtering
    const chatModels = availableModels.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      return isGptChat;
    });

    debugInfo('Chat models after mode filtering:', chatModels.length);

    if (chatModels.length === 2) {
      debugInfo('✅ Missing provider field is NOT the root cause');
    } else {
      debugInfo('🚨 Missing provider field affects mode filtering somehow');
    }
  }
});

registerTest({
  id: 'debug-api-key-detection',
  name: 'DEBUG: API key detection edge cases',
  fn: () => {
    debugInfo('=== Testing API Key Detection Edge Cases ===');

    // Test various API key states that might occur in E2E
    const testCases = [
      {
        name: 'Key in store only',
        storeKey: 'sk-test123',
        localKey: null,
        selectedProvider: 'OpenAI'
      },
      {
        name: 'Key in local field only',
        storeKey: null,
        localKey: 'sk-local123',
        selectedProvider: 'OpenAI'
      },
      {
        name: 'Key in both places',
        storeKey: 'sk-store123',
        localKey: 'sk-local123',
        selectedProvider: 'OpenAI'
      },
      {
        name: 'No key anywhere',
        storeKey: null,
        localKey: null,
        selectedProvider: 'OpenAI'
      },
      {
        name: 'Wrong provider selected',
        storeKey: 'sk-test123',
        localKey: null,
        selectedProvider: 'Anthropic'
      }
    ];

    testCases.forEach(testCase => {
      debugInfo(`\nTesting: ${testCase.name}`);

      // Simulate the key detection logic from Settings.svelte
      const detectedOpenAIKey = testCase.storeKey ||
        (testCase.localKey && testCase.selectedProvider === 'OpenAI' ? testCase.localKey : null);

      const detectedAnthropicKey = null; // For simplicity, assume no Anthropic key

      debugInfo(`  Store key: ${testCase.storeKey}`);
      debugInfo(`  Local key: ${testCase.localKey}`);
      debugInfo(`  Selected provider: ${testCase.selectedProvider}`);
      debugInfo(`  Detected OpenAI key: ${detectedOpenAIKey}`);

      // Test model filtering with this key detection
      const testModels = [
        { id: 'gpt-4', provider: 'openai' },
        { id: 'claude-3-opus', provider: 'anthropic' }
      ];

      const filteredModels = testModels.filter(model => {
        if (model.provider === 'openai' && !detectedOpenAIKey) return false;
        if (model.provider === 'anthropic' && !detectedAnthropicKey) return false;
        return true;
      });

      debugInfo(`  Filtered models: ${filteredModels.length} (${filteredModels.map(m => m.id).join(', ')})`);

      if (detectedOpenAIKey && filteredModels.length === 0) {
        debugInfo(`  🚨 ISSUE: Have OpenAI key but no models passed filtering`);
      }
    });

    debugInfo('\n✅ API key detection edge cases tested');
  }
});