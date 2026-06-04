/**
 * Unit tests for Anthropic Model Configuration System
 *
 * This test suite defines the expected behavior for model configuration
 * before implementing the actual code (TDD approach).
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

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

    debugInfo('✓ Opus 4.1 configuration test passed');
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

    debugInfo('✓ Sonnet 4 configuration test passed');
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

    debugInfo('✓ Haiku 3 configuration test passed');
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

    debugInfo('✓ Token constraint validation passed - 400 errors should be fixed!');
  }
});

// Test: Opus 4.7 Model Configuration (adaptive thinking)
registerTest({
  id: 'opus-4-7-model-config',
  name: 'Should configure Claude Opus 4.7 with adaptive thinking and 128k max tokens',
  fn: async () => {
    const { getModelConfig, supportsReasoning, getMaxOutputTokens, usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    const modelName = 'claude-opus-4-7-20260416';
    const config = getModelConfig(modelName);

    if (config.maxOutputTokens !== 128000) {
      throw new Error(`Expected maxOutputTokens 128000, got ${config.maxOutputTokens}`);
    }
    if (!config.supportsReasoning) {
      throw new Error('Opus 4.7 should support reasoning');
    }
    if (!supportsReasoning(modelName)) {
      throw new Error('supportsReasoning should return true for Opus 4.7');
    }
    if (!usesAdaptiveThinking(modelName)) {
      throw new Error('usesAdaptiveThinking should return true for Opus 4.7');
    }
    if (getMaxOutputTokens(modelName) !== 128000) {
      throw new Error(`getMaxOutputTokens should return 128000, got ${getMaxOutputTokens(modelName)}`);
    }

    // Regression guard: Opus 4.7 must match BEFORE the less-specific 'claude-opus-4' entry
    // (which has 32000 max tokens and manual thinking)
    if (usesAdaptiveThinking('claude-opus-4-20250514')) {
      throw new Error('Opus 4.0 must NOT use adaptive thinking (manual mode only)');
    }
    if (usesAdaptiveThinking('claude-opus-4-1-20250805')) {
      throw new Error('Opus 4.1 must NOT use adaptive thinking (manual mode only)');
    }

    debugInfo('✓ Opus 4.7 configuration test passed');
  }
});

// Test: Opus 4.8 Model Configuration (adaptive thinking)
registerTest({
  id: 'opus-4-8-model-config',
  name: 'Should configure Claude Opus 4.8 with adaptive thinking and 128k max tokens',
  fn: async () => {
    const { getModelConfig, getMaxOutputTokens, usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    const modelName = 'claude-opus-4-8';
    const config = getModelConfig(modelName);

    if (config.maxOutputTokens !== 128000) {
      throw new Error(`Expected maxOutputTokens 128000, got ${config.maxOutputTokens}`);
    }
    if (!config.supportsReasoning) {
      throw new Error('Opus 4.8 should support reasoning');
    }
    if (!usesAdaptiveThinking(modelName)) {
      throw new Error('usesAdaptiveThinking should return true for Opus 4.8');
    }
    if (getMaxOutputTokens(modelName) !== 128000) {
      throw new Error(`getMaxOutputTokens should return 128000, got ${getMaxOutputTokens(modelName)}`);
    }

    // Regression guard: Opus 4.8 must match its own entry, NOT fall through via startsWith
    // to the less-specific 'claude-opus-4' entry (32000 max tokens + manual thinking, which
    // Opus 4.8 rejects with a 400). This was the original bug. Exercise the date-suffixed form too.
    if (!usesAdaptiveThinking('claude-opus-4-8-20260601')) {
      throw new Error('Opus 4.8 (date-suffixed) should require adaptive thinking');
    }
    if (getMaxOutputTokens('claude-opus-4-8-20260601') !== 128000) {
      throw new Error('Opus 4.8 (date-suffixed) should return 128000 max tokens');
    }

    debugInfo('✓ Opus 4.8 configuration test passed');
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

    // Forward-default must be scoped to claude opus/sonnet only — a non-Claude id (or a
    // Claude family we don't forward-default, e.g. haiku) must stay conservative.
    for (const nonClaude of ['gpt-5', 'some-random-model', 'claude-haiku-9']) {
      const c = getModelConfig(nonClaude);
      if (c.supportsReasoning) {
        throw new Error(`${nonClaude} should NOT default to reasoning support`);
      }
      if (c.maxOutputTokens !== 4096) {
        throw new Error(`${nonClaude} should keep conservative 4096 max tokens, got ${c.maxOutputTokens}`);
      }
    }

    debugInfo('✓ Unknown model safety test passed');
  }
});

// Test: Future/unknown Claude opus & sonnet models default to adaptive thinking
registerTest({
  id: 'future-claude-models-default-adaptive',
  name: 'Future claude-opus-*/claude-sonnet-* (>=4) should default to reasoning + adaptive thinking',
  fn: async () => {
    const { supportsReasoning, getMaxOutputTokens, usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    const futureModels = [
      'claude-opus-4-9',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-opus-9-9',
      'claude-opus-4-9-20270101'  // date-suffixed future form
    ];

    for (const model of futureModels) {
      if (!supportsReasoning(model)) {
        throw new Error(`${model} should default to reasoning support`);
      }
      if (!usesAdaptiveThinking(model)) {
        throw new Error(`${model} should default to adaptive thinking`);
      }
      if (getMaxOutputTokens(model) !== 64000) {
        throw new Error(`${model} should default to 64000 max tokens, got ${getMaxOutputTokens(model)}`);
      }
    }

    debugInfo('✓ Future Claude models default to adaptive thinking');
  }
});

// Test: Reasoning models below the 4.6 adaptive cutover use manual thinking
registerTest({
  id: 'sub-4-6-models-use-manual-thinking',
  name: 'Reasoning models below 4.6 must use manual thinking (adaptive 400s on them)',
  fn: async () => {
    const { supportsReasoning, getThinkingBudget, usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    // Every reasoning-capable Claude model older than 4.6 is manual-only. Opus 4.5 in
    // particular is a live regression: Anthropic returns "adaptive thinking is not supported on
    // this model" for it (verified in the live-regression spectrum bracket). Adaptive thinking
    // was introduced at 4.6, so 4.0/4.1/4.5 (opus), 4.0/4.5 (sonnet) and 3.7 are all manual.
    const manualModels = [
      'claude-opus-4-5-20251101',
      'claude-opus-4-5',
      'claude-opus-4-1-20250805',
      'claude-opus-4-1',
      'claude-opus-4-20250514',
      'claude-opus-4',
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-3.7'
    ];

    for (const model of manualModels) {
      if (!supportsReasoning(model)) {
        throw new Error(`${model} should support reasoning`);
      }
      if (usesAdaptiveThinking(model)) {
        throw new Error(`${model} (< 4.6) must use manual thinking, not adaptive`);
      }
      if (getThinkingBudget(model) <= 0) {
        throw new Error(`${model} manual thinking needs a positive budget, got ${getThinkingBudget(model)}`);
      }
    }

    debugInfo('✓ Sub-4.6 reasoning models use manual thinking');
  }
});

// Test: Adaptive-thinking version cutover is exactly 4.6 (both opus and sonnet)
registerTest({
  id: 'adaptive-thinking-version-threshold',
  name: 'Adaptive thinking turns on at version >= 4.6 for both opus and sonnet',
  fn: async () => {
    const { usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    // Just below the cutover → manual
    for (const manual of ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929']) {
      if (usesAdaptiveThinking(manual)) {
        throw new Error(`${manual} (4.5 < 4.6) must NOT use adaptive thinking`);
      }
    }
    // At/above the cutover → adaptive
    for (const adaptive of ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-7', 'claude-opus-4-8']) {
      if (!usesAdaptiveThinking(adaptive)) {
        throw new Error(`${adaptive} (>= 4.6) must use adaptive thinking`);
      }
    }

    debugInfo('✓ Adaptive-thinking cutover is 4.6 for both families');
  }
});

// Test: Opus 4.0 (date-suffixed, no minor) vs Opus 4.x edge case
registerTest({
  id: 'opus-4-0-vs-4x-edge',
  name: 'Opus 4.0 stays manual while Opus 4.7/4.8/4.9 are adaptive (startsWith/date edge)',
  fn: async () => {
    const { getMaxOutputTokens, usesAdaptiveThinking } =
      await import('../../services/anthropicModelConfig.js');

    // 4.0 (date sits where a minor would), 4.1, and 4.5 → manual (all below the 4.6 cutover)
    for (const manual of ['claude-opus-4-20250514', 'claude-opus-4-1-20250805', 'claude-opus-4-5-20251101']) {
      if (usesAdaptiveThinking(manual)) {
        throw new Error(`${manual} must NOT use adaptive thinking`);
      }
    }
    // 4.6 (cutover), 4.7 / 4.8 (known) and 4.9 (future) → adaptive
    for (const adaptive of ['claude-opus-4-6', 'claude-opus-4-7-20260416', 'claude-opus-4-8', 'claude-opus-4-9']) {
      if (!usesAdaptiveThinking(adaptive)) {
        throw new Error(`${adaptive} should use adaptive thinking`);
      }
    }
    // Table value for 4.0 preserved
    if (getMaxOutputTokens('claude-opus-4-20250514') !== 32000) {
      throw new Error(`Opus 4.0 should keep 32000 max tokens, got ${getMaxOutputTokens('claude-opus-4-20250514')}`);
    }

    debugInfo('✓ Opus 4.0-vs-4.x edge case holds');
  }
});