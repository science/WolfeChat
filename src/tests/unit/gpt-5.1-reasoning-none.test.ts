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
