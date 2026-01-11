/**
 * Summary Message Model Display Tests
 *
 * Tests for displaying the model name in the summary message header.
 */

import { test } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';

// ============================================================================
// Model Display Utility
// ============================================================================

test({
  id: 'summary-model-display-with-model',
  name: 'formatSummaryHeader should include model when present',
  fn: async (assert) => {
    const { formatSummaryHeader } = await import('../../lib/summaryDisplayUtils.js');

    const message: ChatMessage = {
      role: 'system',
      content: 'Summary text',
      type: 'summary',
      model: 'gpt-4o'
    };

    const result = formatSummaryHeader(message);

    assert.that(result.includes('gpt-4o'),
      `Expected header to include 'gpt-4o', got: ${result}`);
  }
});

test({
  id: 'summary-model-display-without-model',
  name: 'formatSummaryHeader should work without model',
  fn: async (assert) => {
    const { formatSummaryHeader } = await import('../../lib/summaryDisplayUtils.js');

    const message: ChatMessage = {
      role: 'system',
      content: 'Summary text',
      type: 'summary'
    };

    const result = formatSummaryHeader(message);

    // Should still return a valid header without model
    assert.that(result === 'Summary',
      `Expected 'Summary', got: ${result}`);
  }
});

test({
  id: 'summary-model-display-anthropic-model',
  name: 'formatSummaryHeader should display Anthropic model names',
  fn: async (assert) => {
    const { formatSummaryHeader } = await import('../../lib/summaryDisplayUtils.js');

    const message: ChatMessage = {
      role: 'system',
      content: 'Summary text',
      type: 'summary',
      model: 'claude-3-haiku-20240307'
    };

    const result = formatSummaryHeader(message);

    assert.that(result.includes('claude-3-haiku-20240307'),
      `Expected header to include 'claude-3-haiku-20240307', got: ${result}`);
  }
});

test({
  id: 'summary-model-get-model-display',
  name: 'getSummaryModelDisplay should return model or empty string',
  fn: async (assert) => {
    const { getSummaryModelDisplay } = await import('../../lib/summaryDisplayUtils.js');

    // With model
    const withModel: ChatMessage = {
      role: 'system',
      content: 'Summary text',
      type: 'summary',
      model: 'gpt-4o'
    };
    const resultWith = getSummaryModelDisplay(withModel);
    assert.that(resultWith === 'gpt-4o',
      `Expected 'gpt-4o', got: ${resultWith}`);

    // Without model
    const withoutModel: ChatMessage = {
      role: 'system',
      content: 'Summary text',
      type: 'summary'
    };
    const resultWithout = getSummaryModelDisplay(withoutModel);
    assert.that(resultWithout === '',
      `Expected empty string, got: ${resultWithout}`);
  }
});
