/**
 * Unit Test: Anthropic Reasoning + Model Config Integration
 *
 * Tests that the reasoning service correctly integrates with the new
 * model configuration system to use dynamic thinking budgets.
 */

import { registerTest } from '../testHarness.js';

// Test: Reasoning service uses model-specific thinking budget
registerTest({
  id: 'reasoning-service-modelconfig-integration',
  name: 'Should use model-specific thinking budget from model config',
  fn: async () => {
    // Import the updated reasoning service
    const { addThinkingConfigurationWithBudget, supportsAnthropicReasoning } =
      await import('../../services/anthropicReasoning.js');

    // Test reasoning models get correct thinking budget
    const sonnet4Params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'test' }]
    };

    const configuredParams = addThinkingConfigurationWithBudget(sonnet4Params);

    // Verify thinking configuration was added
    if (!configuredParams.thinking) {
      throw new Error('Thinking configuration should be added for reasoning models');
    }

    if (configuredParams.thinking.type !== 'enabled') {
      throw new Error(`Expected thinking.type 'enabled', got '${configuredParams.thinking.type}'`);
    }

    // Verify model-specific budget (16000 for sonnet-4, which is 25% of 64000)
    const expectedBudget = 16000;
    if (configuredParams.thinking.budget_tokens !== expectedBudget) {
      throw new Error(`Expected thinking budget ${expectedBudget}, got ${configuredParams.thinking.budget_tokens}`);
    }

    console.log('✓ Reasoning service uses model-specific thinking budget correctly');
  }
});

// Test: Non-reasoning models don't get thinking configuration
registerTest({
  id: 'non-reasoning-model-no-thinking',
  name: 'Should not add thinking config for non-reasoning models',
  fn: async () => {
    const { addThinkingConfigurationWithBudget, supportsAnthropicReasoning } =
      await import('../../services/anthropicReasoning.js');

    // Test non-reasoning model
    const haikuParams = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'test' }]
    };

    const configuredParams = addThinkingConfigurationWithBudget(haikuParams);

    // Verify no thinking configuration was added
    if (configuredParams.thinking) {
      throw new Error('Thinking configuration should NOT be added for non-reasoning models');
    }

    // Verify all other params are preserved
    if (configuredParams.model !== haikuParams.model) {
      throw new Error('Model parameter should be preserved');
    }
    if (configuredParams.max_tokens !== haikuParams.max_tokens) {
      throw new Error('max_tokens parameter should be preserved');
    }

    console.log('✓ Non-reasoning models correctly skip thinking configuration');
  }
});

// Test: Reasoning detection uses new model config
registerTest({
  id: 'reasoning-detection-modelconfig',
  name: 'Should correctly detect reasoning support using model config',
  fn: async () => {
    const { supportsAnthropicReasoning } = await import('../../services/anthropicReasoning.js');

    // Test reasoning models
    const reasoningModels = [
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219'
    ];

    for (const model of reasoningModels) {
      if (!supportsAnthropicReasoning(model)) {
        throw new Error(`${model} should be detected as supporting reasoning`);
      }
    }

    // Test non-reasoning models
    const nonReasoningModels = [
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307'
    ];

    for (const model of nonReasoningModels) {
      if (supportsAnthropicReasoning(model)) {
        throw new Error(`${model} should NOT be detected as supporting reasoning`);
      }
    }

    console.log('✓ Reasoning detection works correctly with model config');
  }
});

// Test: Custom budget override still works
registerTest({
  id: 'custom-budget-override',
  name: 'Should allow custom budget override while using model config as default',
  fn: async () => {
    const { addThinkingConfigurationWithBudget } = await import('../../services/anthropicReasoning.js');

    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'test' }]
    };

    // Test with custom budget override
    const customBudget = 8000;
    const configuredParams = addThinkingConfigurationWithBudget(params, customBudget);

    if (!configuredParams.thinking) {
      throw new Error('Thinking configuration should be added');
    }

    if (configuredParams.thinking.budget_tokens !== customBudget) {
      throw new Error(`Expected custom budget ${customBudget}, got ${configuredParams.thinking.budget_tokens}`);
    }

    console.log('✓ Custom budget override works correctly');
  }
});