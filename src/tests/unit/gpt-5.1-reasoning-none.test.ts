/**
 * Unit Test: GPT-5.1 Reasoning "none" Option
 *
 * Tests that gpt-5.1 supports reasoning and that the "none" reasoning effort option
 * properly excludes the reasoning field from the API payload while maintaining text.verbosity
 */

import { registerTest } from '../testHarness.js';
import { buildResponsesPayload, supportsReasoning } from '../../services/openaiService.js';
import { reasoningEffort, verbosity, summary } from '../../stores/reasoningSettings.js';
import { debugInfo } from '../utils/debugLog.js';

function makeInput() {
  return [
    {
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello' }]
    }
  ];
}

registerTest({
  id: 'gpt-5.1-supports-reasoning',
  name: 'gpt-5.1 should be recognized as a reasoning-capable model',
  fn: async () => {
    if (!supportsReasoning('gpt-5.1')) {
      throw new Error('gpt-5.1 should support reasoning');
    }
    if (!supportsReasoning('gpt-5.1-preview')) {
      throw new Error('gpt-5.1-preview should support reasoning');
    }

    debugInfo('✓ gpt-5.1 recognized as reasoning-capable model');
  }
});

registerTest({
  id: 'reasoning-none-excludes-reasoning-field',
  name: 'When reasoning effort is "none", reasoning field should not be included in payload',
  fn: async () => {
    reasoningEffort.set('none');
    verbosity.set('medium');
    summary.set('auto');

    const payload = buildResponsesPayload('gpt-5.1', makeInput(), false);

    // When reasoning is set to "none", the reasoning field should not be present
    if ('reasoning' in payload) {
      throw new Error('reasoning field should not be present when effort is "none"');
    }

    // But text.verbosity should still be included since it's a reasoning-capable model
    if (!payload.text || payload.text.verbosity !== 'medium') {
      throw new Error('text.verbosity should still be set for reasoning-capable models');
    }

    debugInfo('✓ Reasoning "none" excludes reasoning field from payload');
  }
});

registerTest({
  id: 'reasoning-none-with-override',
  name: 'When reasoning effort override is "none", reasoning field should not be included',
  fn: async () => {
    // Set global defaults to something other than 'none'
    reasoningEffort.set('high');
    verbosity.set('low');
    summary.set('detailed');

    // Override with 'none' via opts
    const payload = buildResponsesPayload('gpt-5.1', makeInput(), false, {
      reasoningEffort: 'none',
      verbosity: 'high',
      summary: 'auto'
    });

    if ('reasoning' in payload) {
      throw new Error('reasoning field should not be present when override effort is "none"');
    }

    if (!payload.text || payload.text.verbosity !== 'high') {
      throw new Error('text.verbosity should use override value');
    }

    debugInfo('✓ Reasoning "none" works with override options');
  }
});

registerTest({
  id: 'reasoning-minimal-includes-reasoning-field',
  name: 'When reasoning effort is "minimal", reasoning field should be included (for non-5.1 models)',
  fn: async () => {
    reasoningEffort.set('minimal');
    verbosity.set('medium');
    summary.set('auto');

    // Test with gpt-5 (not gpt-5.1) to verify "minimal" works for other reasoning models
    const payload = buildResponsesPayload('gpt-5', makeInput(), false);

    // Minimal should still include the reasoning field
    if (!payload.reasoning || payload.reasoning.effort !== 'minimal') {
      throw new Error('reasoning.effort should be "minimal"');
    }

    if (!payload.text || payload.text.verbosity !== 'medium') {
      throw new Error('text.verbosity should be set');
    }

    debugInfo('✓ Reasoning "minimal" includes reasoning field in payload (non-5.1 models)');
  }
});

registerTest({
  id: 'reasoning-none-for-other-models',
  name: 'Reasoning "none" should work for other reasoning models too',
  fn: async () => {
    reasoningEffort.set('none');
    verbosity.set('low');
    summary.set('auto');

    // Test with gpt-5
    const payload1 = buildResponsesPayload('gpt-5', makeInput(), false);
    if ('reasoning' in payload1) {
      throw new Error('reasoning field should not be present for gpt-5 when effort is "none"');
    }
    if (!payload1.text) {
      throw new Error('text.verbosity should still be present for gpt-5');
    }

    // Test with o4
    const payload2 = buildResponsesPayload('o4', makeInput(), false);
    if ('reasoning' in payload2) {
      throw new Error('reasoning field should not be present for o4 when effort is "none"');
    }
    if (!payload2.text) {
      throw new Error('text.verbosity should still be present for o4');
    }

    debugInfo('✓ Reasoning "none" works for all reasoning models');
  }
});

registerTest({
  id: 'gpt-5.1-minimal-fallback',
  name: 'gpt-5.1 should fall back to "low" when "minimal" is set',
  fn: async () => {
    reasoningEffort.set('minimal');
    verbosity.set('medium');
    summary.set('auto');

    const payload = buildResponsesPayload('gpt-5.1', makeInput(), false);

    // gpt-5.1 doesn't support "minimal", should fall back to "low"
    if (!payload.reasoning || payload.reasoning.effort !== 'low') {
      throw new Error(`gpt-5.1 with "minimal" should fall back to "low", got: ${payload.reasoning?.effort}`);
    }

    debugInfo('✓ gpt-5.1 falls back to "low" when "minimal" is set');
  }
});

registerTest({
  id: 'other-models-support-minimal',
  name: 'Other reasoning models should support "minimal" effort',
  fn: async () => {
    reasoningEffort.set('minimal');
    verbosity.set('medium');
    summary.set('auto');

    // Test gpt-5
    const payload1 = buildResponsesPayload('gpt-5', makeInput(), false);
    if (!payload1.reasoning || payload1.reasoning.effort !== 'minimal') {
      throw new Error('gpt-5 should support "minimal" reasoning effort');
    }

    // Test o1-preview
    const payload2 = buildResponsesPayload('o1-preview', makeInput(), false);
    if (!payload2.reasoning || payload2.reasoning.effort !== 'minimal') {
      throw new Error('o1-preview should support "minimal" reasoning effort');
    }

    // Test o4
    const payload3 = buildResponsesPayload('o4', makeInput(), false);
    if (!payload3.reasoning || payload3.reasoning.effort !== 'minimal') {
      throw new Error('o4 should support "minimal" reasoning effort');
    }

    debugInfo('✓ Other reasoning models support "minimal" effort');
  }
});

// ==================== GPT-5.2 Tests (TDD - should initially FAIL until implementation) ====================

registerTest({
  id: 'gpt-5.2-supports-reasoning',
  name: 'gpt-5.2 should be recognized as a reasoning-capable model',
  fn: async () => {
    if (!supportsReasoning('gpt-5.2')) {
      throw new Error('gpt-5.2 should support reasoning');
    }
    if (!supportsReasoning('gpt-5.2-preview')) {
      throw new Error('gpt-5.2-preview should support reasoning');
    }

    debugInfo('✓ gpt-5.2 recognized as reasoning-capable model');
  }
});

registerTest({
  id: 'gpt-5.2-uses-none-option',
  name: 'gpt-5.2 should use "none" option (like gpt-5.1, not like base gpt-5)',
  fn: async () => {
    // Import the function we need to test - will need to be updated to new name
    const { isGpt51 } = await import('../../services/openaiService.js');

    // gpt-5.2 should be treated like gpt-5.1 (uses "none" option, not "minimal")
    if (!isGpt51('gpt-5.2')) {
      throw new Error('gpt-5.2 should be treated like gpt-5.1 (uses "none" option)');
    }
    if (!isGpt51('gpt-5.2-preview')) {
      throw new Error('gpt-5.2-preview should be treated like gpt-5.1 (uses "none" option)');
    }

    debugInfo('✓ gpt-5.2 correctly identified as versioned gpt-5 model');
  }
});

registerTest({
  id: 'gpt-5.2-minimal-fallback',
  name: 'gpt-5.2 should fall back to "low" when "minimal" is set (like gpt-5.1)',
  fn: async () => {
    reasoningEffort.set('minimal');
    verbosity.set('medium');
    summary.set('auto');

    const payload = buildResponsesPayload('gpt-5.2', makeInput(), false);

    // gpt-5.2 doesn't support "minimal", should fall back to "low" (like gpt-5.1)
    if (!payload.reasoning || payload.reasoning.effort !== 'low') {
      throw new Error(`gpt-5.2 with "minimal" should fall back to "low", got: ${payload.reasoning?.effort}`);
    }

    debugInfo('✓ gpt-5.2 falls back to "low" when "minimal" is set');
  }
});

registerTest({
  id: 'gpt-5.2-none-excludes-reasoning-field',
  name: 'gpt-5.2 with "none" effort should exclude reasoning field from payload',
  fn: async () => {
    reasoningEffort.set('none');
    verbosity.set('medium');
    summary.set('auto');

    const payload = buildResponsesPayload('gpt-5.2', makeInput(), false);

    if ('reasoning' in payload) {
      throw new Error('reasoning field should not be present for gpt-5.2 when effort is "none"');
    }

    if (!payload.text || payload.text.verbosity !== 'medium') {
      throw new Error('text.verbosity should still be set for gpt-5.2');
    }

    debugInfo('✓ gpt-5.2 "none" effort excludes reasoning field');
  }
});

registerTest({
  id: 'base-gpt5-not-versioned',
  name: 'Base gpt-5 models should NOT be treated as versioned (should use "minimal")',
  fn: async () => {
    const { isGpt51 } = await import('../../services/openaiService.js');

    // These should NOT match as versioned gpt-5 models
    if (isGpt51('gpt-5')) {
      throw new Error('gpt-5 should NOT be treated as versioned (should use "minimal")');
    }
    if (isGpt51('gpt-5-nano')) {
      throw new Error('gpt-5-nano should NOT be treated as versioned (should use "minimal")');
    }
    if (isGpt51('gpt-5-mini')) {
      throw new Error('gpt-5-mini should NOT be treated as versioned (should use "minimal")');
    }

    debugInfo('✓ Base gpt-5 models correctly NOT identified as versioned');
  }
});

registerTest({
  id: 'future-versioned-gpt5-support',
  name: 'Future versioned gpt-5 models (5.3, 5.10) should use "none" option',
  fn: async () => {
    const { isGpt51 } = await import('../../services/openaiService.js');

    // Future versions should also be detected
    if (!isGpt51('gpt-5.3')) {
      throw new Error('gpt-5.3 should be treated as versioned (uses "none" option)');
    }
    if (!isGpt51('gpt-5.10')) {
      throw new Error('gpt-5.10 should be treated as versioned (uses "none" option)');
    }

    debugInfo('✓ Future versioned gpt-5 models correctly identified');
  }
});

// ==================== Future-Proof Tests (gpt-6, gpt-7, etc.) ====================
// These tests verify that the logic is inverted: "minimal" is for legacy models only,
// and all new/future reasoning models default to "none"

registerTest({
  id: 'gpt-6-uses-none-option',
  name: 'gpt-6 (future model) should use "none" option by default',
  fn: async () => {
    const { usesMinimalReasoning } = await import('../../services/openaiService.js');

    // gpt-6 is a future model, should NOT use minimal (should use "none")
    if (usesMinimalReasoning('gpt-6')) {
      throw new Error('gpt-6 should NOT use minimal reasoning (should use "none")');
    }
    if (usesMinimalReasoning('gpt-6-preview')) {
      throw new Error('gpt-6-preview should NOT use minimal reasoning (should use "none")');
    }

    debugInfo('✓ gpt-6 correctly uses "none" option');
  }
});

registerTest({
  id: 'gpt-6-minimal-fallback',
  name: 'gpt-6 should fall back to "low" when "minimal" is set',
  fn: async () => {
    reasoningEffort.set('minimal');
    verbosity.set('medium');
    summary.set('auto');

    const payload = buildResponsesPayload('gpt-6', makeInput(), false);

    // gpt-6 doesn't support "minimal", should fall back to "low"
    if (!payload.reasoning || payload.reasoning.effort !== 'low') {
      throw new Error(`gpt-6 with "minimal" should fall back to "low", got: ${payload.reasoning?.effort}`);
    }

    debugInfo('✓ gpt-6 falls back to "low" when "minimal" is set');
  }
});

registerTest({
  id: 'gpt-7-uses-none-option',
  name: 'gpt-7 (future model) should use "none" option by default',
  fn: async () => {
    const { usesMinimalReasoning } = await import('../../services/openaiService.js');

    if (usesMinimalReasoning('gpt-7')) {
      throw new Error('gpt-7 should NOT use minimal reasoning (should use "none")');
    }

    debugInfo('✓ gpt-7 correctly uses "none" option');
  }
});

registerTest({
  id: 'legacy-models-use-minimal',
  name: 'Legacy models (gpt-5, gpt-5-nano, gpt-5-mini, o3, o4) should use "minimal"',
  fn: async () => {
    const { usesMinimalReasoning } = await import('../../services/openaiService.js');

    // These legacy models should use "minimal"
    const legacyModels = ['gpt-5', 'gpt-5-nano', 'gpt-5-mini', 'o3', 'o3-mini', 'o4', 'o4-mini'];

    for (const model of legacyModels) {
      if (!usesMinimalReasoning(model)) {
        throw new Error(`${model} should use minimal reasoning (legacy model)`);
      }
    }

    debugInfo('✓ Legacy models correctly use "minimal" option');
  }
});

registerTest({
  id: 'o1-models-use-minimal',
  name: 'o1 models should use "minimal" (legacy)',
  fn: async () => {
    const { usesMinimalReasoning } = await import('../../services/openaiService.js');

    if (!usesMinimalReasoning('o1-preview')) {
      throw new Error('o1-preview should use minimal reasoning (legacy model)');
    }
    if (!usesMinimalReasoning('o1-mini')) {
      throw new Error('o1-mini should use minimal reasoning (legacy model)');
    }

    debugInfo('✓ o1 models correctly use "minimal" option');
  }
});

registerTest({
  id: 'new-function-replaces-isGpt51',
  name: 'usesMinimalReasoning() should be the inverse of isGpt51() for reasoning models',
  fn: async () => {
    const { usesMinimalReasoning, isGpt51 } = await import('../../services/openaiService.js');

    // For models that isGpt51 returns true (uses "none"), usesMinimalReasoning should return false
    const noneModels = ['gpt-5.1', 'gpt-5.2', 'gpt-5.3', 'gpt-6', 'gpt-7'];
    for (const model of noneModels) {
      if (usesMinimalReasoning(model)) {
        throw new Error(`${model} should NOT use minimal (uses "none" instead)`);
      }
    }

    // For legacy models, usesMinimalReasoning should return true
    const minimalModels = ['gpt-5', 'gpt-5-nano', 'o3', 'o4'];
    for (const model of minimalModels) {
      if (!usesMinimalReasoning(model)) {
        throw new Error(`${model} SHOULD use minimal (legacy model)`);
      }
    }

    debugInfo('✓ usesMinimalReasoning() correctly identifies legacy vs modern models');
  }
});
