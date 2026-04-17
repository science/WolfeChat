/**
 * Unit Test: Anthropic Reasoning + Model Config Integration
 *
 * Tests that the reasoning service correctly integrates with the new
 * model configuration system to use dynamic thinking budgets.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

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

    debugInfo('✓ Reasoning service uses model-specific thinking budget correctly');
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

    debugInfo('✓ Non-reasoning models correctly skip thinking configuration');
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

    debugInfo('✓ Reasoning detection works correctly with model config');
  }
});

// Test: Opus 4.7 yields adaptive thinking payload (no budget_tokens)
registerTest({
  id: 'opus-4-7-adaptive-thinking-payload',
  name: 'Opus 4.7 should produce thinking.type=adaptive with display=summarized and no budget_tokens',
  fn: async () => {
    const { addThinkingConfigurationWithBudget } = await import('../../services/anthropicReasoning.js');

    const params = {
      model: 'claude-opus-4-7-20260416',
      max_tokens: 128000,
      messages: [{ role: 'user', content: 'test' }]
    };

    const configured = addThinkingConfigurationWithBudget(params, { thinkingEnabled: true });

    if (!configured.thinking) {
      throw new Error('Thinking config should be added for Opus 4.7 when thinkingEnabled is true');
    }
    if (configured.thinking.type !== 'adaptive') {
      throw new Error(`Expected thinking.type 'adaptive', got '${configured.thinking.type}'`);
    }
    if (configured.thinking.display !== 'summarized') {
      throw new Error(`Expected thinking.display 'summarized', got '${configured.thinking.display}'`);
    }
    if ('budget_tokens' in configured.thinking) {
      throw new Error('Adaptive thinking must not include budget_tokens (API rejects it on Opus 4.7)');
    }

    // When thinkingEnabled is false, no thinking config should be sent (works on all models)
    const disabled = addThinkingConfigurationWithBudget(params, { thinkingEnabled: false });
    if (disabled.thinking) {
      throw new Error('Thinking config should be omitted when thinkingEnabled is false on Opus 4.7');
    }

    debugInfo('✓ Opus 4.7 produces correct adaptive thinking payload');
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

    debugInfo('✓ Custom budget override works correctly');
  }
});