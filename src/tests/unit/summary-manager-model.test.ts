/**
 * Summary Manager Model Tests
 *
 * Tests that the summaryManager correctly uses the effective summary model
 * and stores the model on the summary message.
 */

import { test } from '../testHarness.js';
import { get } from 'svelte/store';
import type { ChatMessage } from '../../stores/stores.js';

// ============================================================================
// Placeholder Creation with Model
// ============================================================================

test({
  id: 'summary-manager-placeholder-has-model',
  name: 'createPlaceholderSummary should include model when provided',
  fn: async (assert) => {
    const { createPlaceholderSummaryWithModel } = await import('../../managers/summaryManager.js');

    const placeholder = createPlaceholderSummaryWithModel('gpt-4o');

    assert.that(placeholder.model === 'gpt-4o',
      `Expected model 'gpt-4o', got ${placeholder.model}`);
    assert.that(placeholder.type === 'summary',
      `Expected type 'summary', got ${placeholder.type}`);
    assert.that(placeholder.summaryLoading === true,
      `Expected summaryLoading true, got ${placeholder.summaryLoading}`);
  }
});

test({
  id: 'summary-manager-placeholder-model-preserved',
  name: 'completeSummaryLoading should preserve the model on the summary',
  fn: async (assert) => {
    const { completeSummaryLoading } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      {
        role: 'system',
        content: 'Summary text',
        type: 'summary',
        summaryActive: true,
        summaryLoading: true,
        model: 'claude-3-haiku-20240307'
      }
    ];

    const result = completeSummaryLoading(history, 1);

    assert.that(result[1].model === 'claude-3-haiku-20240307',
      `Expected model to be preserved, got ${result[1].model}`);
    assert.that(result[1].summaryLoading === false,
      `Expected summaryLoading to be false, got ${result[1].summaryLoading}`);
  }
});

// ============================================================================
// Summary Model Selection in Manager
// ============================================================================

test({
  id: 'summary-manager-uses-effective-model',
  name: 'insertPlaceholderSummaryWithModel should use provided model',
  fn: async (assert) => {
    const { insertPlaceholderSummaryWithModel } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    const result = insertPlaceholderSummaryWithModel(history, 1, 'gpt-4o');

    // Summary should be inserted at index 2
    assert.that(result.length === 3,
      `Expected 3 messages, got ${result.length}`);
    assert.that(result[2].type === 'summary',
      `Expected summary at index 2, got type ${result[2].type}`);
    assert.that(result[2].model === 'gpt-4o',
      `Expected model 'gpt-4o', got ${result[2].model}`);
  }
});

test({
  id: 'summary-manager-streaming-content-preserves-model',
  name: 'updateStreamingSummaryContent should preserve model',
  fn: async (assert) => {
    const { updateStreamingSummaryContent } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      {
        role: 'system',
        content: 'Initial',
        type: 'summary',
        summaryActive: true,
        summaryLoading: true,
        model: 'claude-3-opus-20240229'
      }
    ];

    const result = updateStreamingSummaryContent(history, 1, 'Updated content');

    assert.that(result[1].content === 'Updated content',
      `Expected content to be updated, got ${result[1].content}`);
    assert.that(result[1].model === 'claude-3-opus-20240229',
      `Expected model to be preserved, got ${result[1].model}`);
  }
});
