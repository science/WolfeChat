/**
 * Unit tests for Anthropic Model Configuration System
 *
 * This test suite defines the expected behavior for model configuration
 * before implementing the actual code (TDD approach).
 */

import { registerTest } from '../testHarness.js';

// Test: Opus 4.1 Model Configuration
registerTest({
  id: 'opus-4-1-model-config',
  name: 'Should correctly configure Claude Opus 4.1 models',
  fn: async () => {
    // Import the module (will fail until we implement it)
    const { getModelConfig, supportsReasoning, getThinkingBudget, getMaxOutputTokens } =
      await import('../../services/anthropicModelConfig.js');

    const modelName = 'claude-opus-4-1-20250805';
    const config = getModelConfig(modelName);

    // Verify opus 4.1 configuration
    if (config.maxOutputTokens !== 32000) {
      throw new Error(`Expected maxOutputTokens 32000, got ${config.maxOutputTokens}`);
    }
    if (!config.supportsReasoning) {
      throw new Error('Opus 4.1 should support reasoning');
    }
    if (config.thinkingBudgetTokens !== 8000) {
      throw new Error(`Expected thinkingBudgetTokens 8000, got ${config.thinkingBudgetTokens}`);
    }

    // Verify helper functions
    if (!supportsReasoning(modelName)) {
      throw new Error('supportsReasoning should return true for Opus 4.1');
    }
    if (getThinkingBudget(modelName) !== 8000) {
      throw new Error(`getThinkingBudget should return 8000, got ${getThinkingBudget(modelName)}`);
    }
    if (getMaxOutputTokens(modelName) !== 32000) {
      throw new Error(`getMaxOutputTokens should return 32000, got ${getMaxOutputTokens(modelName)}`);
    }

    console.log('✓ Opus 4.1 configuration test passed');
  }
});

// Test: Sonnet 4 Model Configuration
registerTest({
  id: 'sonnet-4-model-config',
  name: 'Should correctly configure Claude Sonnet 4 models',
  fn: async () => {
    const { getModelConfig, supportsReasoning, getThinkingBudget, getMaxOutputTokens } =
      await import('../../services/anthropicModelConfig.js');

    const modelName = 'claude-sonnet-4-20250514';
    const config = getModelConfig(modelName);

    // Verify sonnet 4 configuration
    if (config.maxOutputTokens !== 64000) {
      throw new Error(`Expected maxOutputTokens 64000, got ${config.maxOutputTokens}`);
    }
    if (!config.supportsReasoning) {
      throw new Error('Sonnet 4 should support reasoning');
    }
    if (config.thinkingBudgetTokens !== 16000) {
      throw new Error(`Expected thinkingBudgetTokens 16000, got ${config.thinkingBudgetTokens}`);
    }

    console.log('✓ Sonnet 4 configuration test passed');
  }
});

// Test: Haiku 3 Model Configuration (Non-reasoning)
registerTest({
  id: 'haiku-3-model-config',
  name: 'Should correctly configure Claude Haiku 3 models (non-reasoning)',
  fn: async () => {
    const { getModelConfig, supportsReasoning, getThinkingBudget, getMaxOutputTokens } =
      await import('../../services/anthropicModelConfig.js');

    const modelName = 'claude-3-haiku-20240307';
    const config = getModelConfig(modelName);

    // Verify haiku 3 configuration
    if (config.maxOutputTokens !== 4096) {
      throw new Error(`Expected maxOutputTokens 4096, got ${config.maxOutputTokens}`);
    }
    if (config.supportsReasoning) {
      throw new Error('Haiku 3 should NOT support reasoning');
    }
    if (config.thinkingBudgetTokens !== 0) {
      throw new Error(`Expected thinkingBudgetTokens 0, got ${config.thinkingBudgetTokens}`);
    }

    // Verify helper functions
    if (supportsReasoning(modelName)) {
      throw new Error('supportsReasoning should return false for Haiku 3');
    }
    if (getThinkingBudget(modelName) !== 0) {
      throw new Error(`getThinkingBudget should return 0, got ${getThinkingBudget(modelName)}`);
    }

    console.log('✓ Haiku 3 configuration test passed');
  }
});

// Test: Critical Constraint Validation
registerTest({
  id: 'token-constraint-validation',
  name: 'Should ensure max_tokens > thinking_budget for ALL reasoning models',
  fn: async () => {
    const { getMaxOutputTokens, getThinkingBudget } =
      await import('../../services/anthropicModelConfig.js');

    const reasoningModels = [
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219'
    ];

    for (const model of reasoningModels) {
      const maxTokens = getMaxOutputTokens(model);
      const thinkingBudget = getThinkingBudget(model);

      // This is the KEY constraint that was causing 400 errors!
      if (maxTokens <= thinkingBudget) {
        throw new Error(`CRITICAL: max_tokens (${maxTokens}) must be > thinking_budget (${thinkingBudget}) for ${model}`);
      }

      // Verify 25% allocation
      const expected25Percent = maxTokens * 0.25;
      if (thinkingBudget !== expected25Percent) {
        throw new Error(`Expected 25% allocation (${expected25Percent}), got ${thinkingBudget} for ${model}`);
      }
    }

    console.log('✓ Token constraint validation passed - 400 errors should be fixed!');
  }
});

// Test: Unknown Model Safety
registerTest({
  id: 'unknown-model-safety',
  name: 'Should provide safe defaults for unknown models',
  fn: async () => {
    const { getModelConfig, supportsReasoning, getThinkingBudget, getMaxOutputTokens } =
      await import('../../services/anthropicModelConfig.js');

    const unknownModel = 'totally-unknown-model-xyz';
    const config = getModelConfig(unknownModel);

    // Verify safe defaults
    if (config.maxOutputTokens !== 4096) {
      throw new Error(`Expected conservative default maxOutputTokens 4096, got ${config.maxOutputTokens}`);
    }
    if (config.supportsReasoning) {
      throw new Error('Unknown models should default to NO reasoning support');
    }
    if (config.thinkingBudgetTokens !== 0) {
      throw new Error(`Expected thinkingBudgetTokens 0 for unknown model, got ${config.thinkingBudgetTokens}`);
    }

    console.log('✓ Unknown model safety test passed');
  }
});