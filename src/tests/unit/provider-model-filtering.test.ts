/**
 * Unit Test: Provider Model Filtering Logic
 *
 * Tests the model filtering and provider indicator logic in isolation
 * to verify correct behavior before fixing the E2E test issues
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

// Test 1: Models should filter by provider when only one API key is set
registerTest({
  id: 'provider-model-filter-single-openai-key',
  name: 'Should show only OpenAI models when only OpenAI key is set',
  fn: () => {
    // Mock the models store with mixed provider models
    const mockModelsStore = [
      { id: 'gpt-4', provider: 'openai' },
      { id: 'gpt-3.5-turbo', provider: 'openai' },
      { id: 'claude-3-opus', provider: 'anthropic' },
      { id: 'claude-3-sonnet', provider: 'anthropic' }
    ];

    const mockOpenAIKey = 'sk-test123';
    const mockAnthropicKey = null;

    // Simulate the filtering logic that should be implemented
    const filteredModels = mockModelsStore.filter(model => {
      // When only OpenAI key exists, show only OpenAI models
      if (mockOpenAIKey && !mockAnthropicKey) {
        return model.provider === 'openai';
      }
      // When only Anthropic key exists, show only Anthropic models
      if (!mockOpenAIKey && mockAnthropicKey) {
        return model.provider === 'anthropic';
      }
      // When both exist, show all
      return true;
    });

    if (filteredModels.length !== 2) {
      throw new Error(`Expected 2 OpenAI models, got ${filteredModels.length}`);
    }

    if (filteredModels.some(m => m.provider === 'anthropic')) {
      throw new Error('Should not have Anthropic models when only OpenAI key is set');
    }

    const hasOpenAIModels = filteredModels.every(m => m.provider === 'openai');
    if (!hasOpenAIModels) {
      throw new Error('All models should be OpenAI models');
    }
  }
});

registerTest({
  id: 'provider-model-filter-single-anthropic-key',
  name: 'Should show only Anthropic models when only Anthropic key is set',
  fn: () => {
    const mockModelsStore = [
      { id: 'gpt-4', provider: 'openai' },
      { id: 'gpt-3.5-turbo', provider: 'openai' },
      { id: 'claude-3-opus', provider: 'anthropic' },
      { id: 'claude-3-sonnet', provider: 'anthropic' }
    ];

    const mockOpenAIKey = null;
    const mockAnthropicKey = 'sk-ant-test123';

    const filteredModels = mockModelsStore.filter(model => {
      if (mockOpenAIKey && !mockAnthropicKey) {
        return model.provider === 'openai';
      }
      if (!mockOpenAIKey && mockAnthropicKey) {
        return model.provider === 'anthropic';
      }
      return true;
    });

    if (filteredModels.length !== 2) {
      throw new Error(`Expected 2 Anthropic models, got ${filteredModels.length}`);
    }

    if (filteredModels.some(m => m.provider === 'openai')) {
      throw new Error('Should not have OpenAI models when only Anthropic key is set');
    }

    const hasAnthropicModels = filteredModels.every(m => m.provider === 'anthropic');
    if (!hasAnthropicModels) {
      throw new Error('All models should be Anthropic models');
    }
  }
});

// Test 2: Provider indicators should only show when both keys are configured
registerTest({
  id: 'provider-indicators-logic',
  name: 'Should show provider indicators only when both providers configured',
  fn: () => {
    const testCases = [
      { openai: 'key1', anthropic: null, expectIndicators: false },
      { openai: null, anthropic: 'key2', expectIndicators: false },
      { openai: 'key1', anthropic: 'key2', expectIndicators: true },
      { openai: null, anthropic: null, expectIndicators: false }
    ];

    testCases.forEach((tc, index) => {
      const shouldShow = !!(tc.openai && tc.anthropic);
      if (shouldShow !== tc.expectIndicators) {
        throw new Error(`Test case ${index} failed: openai=${tc.openai}, anthropic=${tc.anthropic}, expected=${tc.expectIndicators}, got=${shouldShow}`);
      }
    });
  }
});

// Test 3: Model filtering should respect mode AND provider availability
registerTest({
  id: 'model-filter-mode-and-provider',
  name: 'Should filter by mode and available providers',
  fn: () => {
    const mockModelsStore = [
      { id: 'gpt-4', provider: 'openai' },
      { id: 'gpt-4-vision', provider: 'openai' },
      { id: 'dall-e-3', provider: 'openai' },
      { id: 'tts-1', provider: 'openai' },
      { id: 'claude-3-opus', provider: 'anthropic' },
      { id: 'claude-3-vision', provider: 'anthropic' }
    ];

    // Test GPT mode with only OpenAI key
    const openaiKey = 'sk-test123';
    const anthropicKey = null;

    const gptModels = mockModelsStore.filter(model => {
      // First check if it's a chat model (not vision, dalle, or tts)
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      // Then check provider availability
      if (model.provider === 'openai' && !openaiKey) return false;
      if (model.provider === 'anthropic' && !anthropicKey) return false;

      return true;
    });

    if (gptModels.length !== 1 || gptModels[0].id !== 'gpt-4') {
      throw new Error(`GPT mode filtering failed: expected 1 gpt-4 model, got ${gptModels.length} models: ${gptModels.map(m => m.id).join(', ')}`);
    }
  }
});

// Test 4: Both providers available should show all chat models
registerTest({
  id: 'model-filter-both-providers',
  name: 'Should show both OpenAI and Anthropic chat models when both keys available',
  fn: () => {
    const mockModelsStore = [
      { id: 'gpt-4', provider: 'openai' },
      { id: 'gpt-4-vision', provider: 'openai' },
      { id: 'dall-e-3', provider: 'openai' },
      { id: 'claude-3-opus', provider: 'anthropic' },
      { id: 'claude-3-vision', provider: 'anthropic' }
    ];

    const openaiKey = 'sk-test123';
    const anthropicKey = 'sk-ant-test123';

    const gptModels = mockModelsStore.filter(model => {
      // First check if it's a chat model
      const isGptChat = model.id.includes('gpt') && !model.id.includes('vision');
      const isClaudeChat = model.id.startsWith('claude-') && !model.id.includes('vision');

      if (!isGptChat && !isClaudeChat) return false;

      // With both keys, all chat models should be available
      if (model.provider === 'openai' && !openaiKey) return false;
      if (model.provider === 'anthropic' && !anthropicKey) return false;

      return true;
    });

    if (gptModels.length !== 2) {
      throw new Error(`Expected 2 chat models (gpt-4 and claude-3-opus), got ${gptModels.length}`);
    }

    const hasOpenAI = gptModels.some(m => m.provider === 'openai');
    const hasAnthropic = gptModels.some(m => m.provider === 'anthropic');

    if (!hasOpenAI || !hasAnthropic) {
      throw new Error('Should have models from both providers');
    }
  }
});

// Test 5: Provider indicator text logic
registerTest({
  id: 'provider-indicator-text-format',
  name: 'Should format provider indicators correctly',
  fn: () => {
    const testCases = [
      {
        model: { id: 'gpt-4', provider: 'openai' },
        shouldShow: true,
        expected: 'gpt-4 (OpenAI)'
      },
      {
        model: { id: 'claude-3-opus', provider: 'anthropic' },
        shouldShow: true,
        expected: 'claude-3-opus (Anthropic)'
      },
      {
        model: { id: 'gpt-4', provider: 'openai' },
        shouldShow: false,
        expected: 'gpt-4'
      }
    ];

    testCases.forEach((tc, index) => {
      const result = tc.shouldShow && tc.model.provider
        ? `${tc.model.id} (${tc.model.provider === 'openai' ? 'OpenAI' : 'Anthropic'})`
        : tc.model.id;

      if (result !== tc.expected) {
        throw new Error(`Test case ${index} failed: expected "${tc.expected}", got "${result}"`);
      }
    });
  }
});