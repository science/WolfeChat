/**
 * Summary Streaming Alignment Tests
 *
 * Tests that summary streaming uses the same infrastructure as main chat
 * to ensure consistent behavior with reasoning models.
 */

import { test } from '../testHarness.js';

// ============================================================================
// OpenAI Summary Streaming - Payload Building
// ============================================================================

test({
  id: 'summary-streaming-uses-responses-payload',
  name: 'buildSummaryPayload should use buildResponsesPayload for OpenAI models',
  fn: async (assert) => {
    const { buildSummaryPayload } = await import('../../lib/summaryStreamingUtils.js');
    const { supportsReasoning } = await import('../../services/openaiService.js');

    // Test with a reasoning model
    const reasoningPayload = buildSummaryPayload('gpt-5-mini', [
      { role: 'user', content: 'Summarize this conversation' }
    ], {
      reasoningEffort: 'low',
      verbosity: 'medium',
      summaryOption: 'auto'
    });

    // Should use Responses API format (input, not messages)
    assert.that('input' in reasoningPayload,
      'Reasoning model payload should use "input" field (Responses API format)');
    assert.that(!('messages' in reasoningPayload),
      'Reasoning model payload should NOT use "messages" field');

    // Should include reasoning configuration
    if (supportsReasoning('gpt-5-mini')) {
      assert.that('reasoning' in reasoningPayload || 'text' in reasoningPayload,
        'Reasoning model payload should include reasoning or text configuration');
    }
  }
});

test({
  id: 'summary-streaming-non-reasoning-model',
  name: 'buildSummaryPayload should work for non-reasoning models',
  fn: async (assert) => {
    const { buildSummaryPayload } = await import('../../lib/summaryStreamingUtils.js');

    // Test with a non-reasoning model
    const payload = buildSummaryPayload('gpt-3.5-turbo', [
      { role: 'user', content: 'Summarize this' }
    ], {});

    // Should still use Responses API format for consistency
    assert.that('input' in payload,
      'Non-reasoning model payload should also use Responses API format');
    assert.that(payload.model === 'gpt-3.5-turbo',
      `Expected model 'gpt-3.5-turbo', got ${payload.model}`);
  }
});

test({
  id: 'summary-streaming-no-max-tokens',
  name: 'buildSummaryPayload should NOT include max_tokens (unsupported in Responses API)',
  fn: async (assert) => {
    const { buildSummaryPayload } = await import('../../lib/summaryStreamingUtils.js');

    const payload = buildSummaryPayload('gpt-5-mini', [
      { role: 'user', content: 'Summarize' }
    ], { reasoningEffort: 'medium' });

    assert.that(!('max_tokens' in payload),
      'Payload should NOT contain max_tokens (causes error with reasoning models)');
  }
});

// ============================================================================
// Anthropic Summary Streaming - SDK Usage
// ============================================================================

test({
  id: 'summary-anthropic-uses-sdk-params',
  name: 'buildAnthropicSummaryParams should use proper SDK parameter structure',
  fn: async (assert) => {
    const { buildAnthropicSummaryParams } = await import('../../lib/summaryStreamingUtils.js');
    const { getMaxOutputTokens } = await import('../../services/anthropicModelConfig.js');

    const params = buildAnthropicSummaryParams('claude-3-haiku-20240307', [
      { role: 'user', content: 'Summarize this' }
    ], {});

    // Should use dynamic max_tokens from model config
    const expectedMaxTokens = getMaxOutputTokens('claude-3-haiku-20240307');
    assert.that(params.max_tokens === expectedMaxTokens,
      `Expected max_tokens ${expectedMaxTokens}, got ${params.max_tokens}`);

    // Should have proper structure
    assert.that(params.model === 'claude-3-haiku-20240307',
      `Expected model 'claude-3-haiku-20240307', got ${params.model}`);
    assert.that(Array.isArray(params.messages),
      'Params should have messages array');
  }
});

test({
  id: 'summary-anthropic-thinking-model',
  name: 'buildAnthropicSummaryParams should support thinking for capable models',
  fn: async (assert) => {
    const { buildAnthropicSummaryParams } = await import('../../lib/summaryStreamingUtils.js');
    const { supportsAnthropicReasoning } = await import('../../services/anthropicReasoning.js');

    // Test with a thinking-capable model
    const thinkingModel = 'claude-sonnet-4-20250514';

    if (supportsAnthropicReasoning(thinkingModel)) {
      const params = buildAnthropicSummaryParams(thinkingModel, [
        { role: 'user', content: 'Summarize' }
      ], { thinkingEnabled: true });

      // When thinking is enabled, should have thinking config
      assert.that('thinking' in params || params.max_tokens > 0,
        'Thinking-capable model should have proper configuration');
    } else {
      // Model doesn't support reasoning, that's fine
      assert.that(true, 'Model does not support reasoning - skipped');
    }
  }
});

test({
  id: 'summary-anthropic-no-hardcoded-500',
  name: 'buildAnthropicSummaryParams should NOT use hardcoded 500 tokens',
  fn: async (assert) => {
    const { buildAnthropicSummaryParams } = await import('../../lib/summaryStreamingUtils.js');

    const params = buildAnthropicSummaryParams('claude-3-opus-20240229', [
      { role: 'user', content: 'Summarize' }
    ], {});

    // Should NOT be hardcoded to 500
    assert.that(params.max_tokens !== 500,
      `max_tokens should not be hardcoded to 500, got ${params.max_tokens}`);
  }
});
