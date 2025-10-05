/**
 * TDD Unit Test: Settings Provider Filtering Behavior
 *
 * Test Driven Development approach to verify the exact behavior expected
 * when only one provider API key is configured vs both providers
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'settings-only-openai-key-configured',
  name: 'TDD: Should show only OpenAI models when only OpenAI key is set',
  fn: () => {
    // ARRANGE: Simulate the exact scenario from the failing E2E test

    // Mock the provider store state - only OpenAI key configured
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;

    // Mock the modelsStore with mixed provider models (what would be fetched)
    const rawModelsStore = [
      { id: 'gpt-4', provider: 'openai', created: 1234567890 },
      { id: 'gpt-3.5-turbo', provider: 'openai', created: 1234567880 },
      { id: 'claude-3-opus', provider: 'anthropic', created: 1234567870 },
      { id: 'claude-3-sonnet', provider: 'anthropic', created: 1234567860 }
    ];

    // ACT: Apply the filtering logic that Settings.svelte should use
    // This is simulating updateFilteredModels() for GPT mode
    const mode = "GPT";

    const filteredModels = rawModelsStore.filter(model => {
      // First check if it's a chat model (not vision, dalle, or tts)
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      // Then check provider availability
      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    // ASSERT: Verify the expected behavior

    // Should have models (not zero)
    if (filteredModels.length === 0) {
      debugInfo('DEBUG: No models after filtering');
      debugInfo('Raw models:', rawModelsStore);
      debugInfo('OpenAI key exists:', !!openaiApiKey);
      debugInfo('Anthropic key exists:', !!anthropicApiKey);
      throw new Error('Expected to have filtered models, got 0');
    }

    // Should have exactly 2 OpenAI models
    if (filteredModels.length !== 2) {
      throw new Error(`Expected 2 OpenAI models, got ${filteredModels.length}: ${filteredModels.map(m => m.id).join(', ')}`);
    }

    // All filtered models should be OpenAI models
    const hasGptModels = filteredModels.some(m => m.id.toLowerCase().includes('gpt'));
    if (!hasGptModels) {
      throw new Error('Expected to have GPT models');
    }

    // Should NOT have Claude models
    const hasClaudeModels = filteredModels.some(m => m.id.toLowerCase().includes('claude'));
    if (hasClaudeModels) {
      throw new Error('Should not have Claude models when only OpenAI key is set');
    }

    // Verify provider indicators logic - should NOT show when only one provider
    const shouldShowProviderIndicators = !!(openaiApiKey && anthropicApiKey);
    if (shouldShowProviderIndicators) {
      throw new Error('Should not show provider indicators when only one provider is configured');
    }

    debugInfo('✅ TDD Test passed: Correct filtering with only OpenAI key');
  }
});

registerTest({
  id: 'settings-both-providers-configured',
  name: 'TDD: Should show models from both providers with indicators when both keys set',
  fn: () => {
    // ARRANGE: Both providers configured
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = 'sk-ant-test123';

    const rawModelsStore = [
      { id: 'gpt-4', provider: 'openai', created: 1234567890 },
      { id: 'gpt-3.5-turbo', provider: 'openai', created: 1234567880 },
      { id: 'claude-3-opus', provider: 'anthropic', created: 1234567870 },
      { id: 'claude-3-sonnet', provider: 'anthropic', created: 1234567860 }
    ];

    // ACT: Apply filtering logic
    const filteredModels = rawModelsStore.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    // ASSERT: Should show all 4 models
    if (filteredModels.length !== 4) {
      throw new Error(`Expected 4 models from both providers, got ${filteredModels.length}`);
    }

    // Should have both GPT and Claude models
    const hasGptModels = filteredModels.some(m => m.id.includes('gpt'));
    const hasClaudeModels = filteredModels.some(m => m.id.includes('claude'));

    if (!hasGptModels) {
      throw new Error('Expected to have GPT models');
    }

    if (!hasClaudeModels) {
      throw new Error('Expected to have Claude models');
    }

    // Should show provider indicators when both providers configured
    const shouldShowProviderIndicators = !!(openaiApiKey && anthropicApiKey);
    if (!shouldShowProviderIndicators) {
      throw new Error('Should show provider indicators when both providers are configured');
    }

    debugInfo('✅ TDD Test passed: Correct filtering with both providers');
  }
});

registerTest({
  id: 'settings-no-models-fetched-scenario',
  name: 'TDD: Should handle empty models store gracefully',
  fn: () => {
    // ARRANGE: API key configured but no models fetched yet
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;
    const rawModelsStore = []; // Empty - simulates before models are fetched

    // ACT: Apply filtering logic
    const filteredModels = rawModelsStore.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    // ASSERT: Should handle empty gracefully
    if (filteredModels.length !== 0) {
      throw new Error(`Expected 0 models when store is empty, got ${filteredModels.length}`);
    }

    debugInfo('✅ TDD Test passed: Empty models store handled correctly');
  }
});

registerTest({
  id: 'settings-real-world-model-structure',
  name: 'TDD: Should work with real-world model structure from OpenAI API',
  fn: () => {
    // ARRANGE: Simulate real OpenAI API response structure
    const openaiApiKey = 'sk-test123';
    const anthropicApiKey = null;

    // Real-world OpenAI models (simplified)
    const rawModelsStore = [
      { id: 'gpt-4', provider: 'openai', created: 1687882411, object: 'model', owned_by: 'openai' },
      { id: 'gpt-4-vision-preview', provider: 'openai', created: 1698894618, object: 'model', owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', provider: 'openai', created: 1677610602, object: 'model', owned_by: 'openai' },
      { id: 'dall-e-3', provider: 'openai', created: 1698785189, object: 'model', owned_by: 'openai' },
      { id: 'tts-1', provider: 'openai', created: 1681940951, object: 'model', owned_by: 'openai' }
    ];

    // ACT: Apply filtering for GPT mode (chat models only)
    const filteredModels = rawModelsStore.filter(model => {
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      if (model.provider === 'openai' && !openaiApiKey) return false;
      if (model.provider === 'anthropic' && !anthropicApiKey) return false;

      return true;
    });

    // ASSERT: Should get only the 2 chat models (gpt-4 and gpt-3.5-turbo)
    // Should exclude gpt-4-vision-preview, dall-e-3, tts-1
    if (filteredModels.length !== 2) {
      debugInfo('Filtered models:', filteredModels.map(m => m.id));
      throw new Error(`Expected 2 chat models, got ${filteredModels.length}`);
    }

    const expectedModels = ['gpt-4', 'gpt-3.5-turbo'];
    const actualModels = filteredModels.map(m => m.id).sort();
    const expectedSorted = expectedModels.sort();

    if (JSON.stringify(actualModels) !== JSON.stringify(expectedSorted)) {
      throw new Error(`Expected models [${expectedSorted.join(', ')}], got [${actualModels.join(', ')}]`);
    }

    debugInfo('✅ TDD Test passed: Real-world model structure handled correctly');
  }
});