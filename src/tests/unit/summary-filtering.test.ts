/**
 * Unit tests for summary message filtering functionality
 *
 * TDD tests for the buildMessagesForAPI function that filters
 * messages based on active summaries.
 */

import { test } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant' | 'system', content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { role, content, ...extra };
}

// Helper to create a summary message
function createSummary(content: string, active: boolean = true): ChatMessage {
  return {
    role: 'system',
    content,
    type: 'summary',
    summaryActive: active
  };
}

// ============================================================================
// Basic filtering - no summaries
// ============================================================================

test({
  id: 'summary-filter-no-summaries',
  name: 'buildMessagesForAPI: should pass through all messages when no summaries exist',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi there!'),
      createMessage('user', 'How are you?'),
      createMessage('assistant', 'I am doing well!')
    ];

    const result = buildMessagesForAPI(history);

    assert.that(result.length === 4, `Should have 4 messages, got ${result.length}`);
    assert.that(result[0].content === 'Hello', 'First message should be Hello');
    assert.that(result[3].content === 'I am doing well!', 'Last message should be "I am doing well!"');
  }
});

// ============================================================================
// Single summary - basic shadowing
// ============================================================================

test({
  id: 'summary-filter-single-active-summary',
  name: 'buildMessagesForAPI: should exclude messages before an active summary',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createSummary('Summary of A, B, C', true),
      createMessage('assistant', 'Message D'),
      createMessage('user', 'Message E')
    ];

    const result = buildMessagesForAPI(history);

    // Should include: Summary, D, E (A, B, C are shadowed)
    assert.that(result.length === 3, `Should have 3 messages, got ${result.length}`);
    assert.that(result[0].type === 'summary', 'First message should be the summary');
    assert.that(result[1].content === 'Message D', 'Second message should be D');
    assert.that(result[2].content === 'Message E', 'Third message should be E');
  }
});

test({
  id: 'summary-filter-inactive-summary',
  name: 'buildMessagesForAPI: should include all messages when summary is inactive',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createSummary('Summary of A, B', false), // Inactive
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D')
    ];

    const result = buildMessagesForAPI(history);

    // Should include: A, B, C, D (summary is inactive, so no shadowing)
    // Inactive summaries are NOT included in the result
    assert.that(result.length === 4, `Should have 4 messages (A, B, C, D), got ${result.length}`);
    assert.that(result[0].content === 'Message A', 'First message should be A');
    assert.that(result[3].content === 'Message D', 'Last message should be D');
  }
});

test({
  id: 'summary-filter-summary-at-end',
  name: 'buildMessagesForAPI: should shadow all messages when summary is at end',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createSummary('Summary of A, B, C', true)
    ];

    const result = buildMessagesForAPI(history);

    // Should include only the summary (A, B, C are shadowed)
    assert.that(result.length === 1, `Should have 1 message (summary only), got ${result.length}`);
    assert.that(result[0].type === 'summary', 'Only message should be the summary');
  }
});

// ============================================================================
// Multiple summaries
// ============================================================================

test({
  id: 'summary-filter-multiple-active-summaries',
  name: 'buildMessagesForAPI: should handle multiple active summaries correctly',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // Scenario 2 from Issue #31:
    // A, B, C, [Summary1], D, E, [Summary2], F
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createSummary('Summary 1: A, B, C', true),
      createMessage('assistant', 'Message D'),
      createMessage('user', 'Message E'),
      createSummary('Summary 2: D, E', true),
      createMessage('assistant', 'Message F')
    ];

    const result = buildMessagesForAPI(history);

    // Should include: Summary1, Summary2, F
    // (A,B,C shadowed by Summary1; D,E shadowed by Summary2)
    assert.that(result.length === 3, `Should have 3 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 1: A, B, C', 'First should be Summary 1');
    assert.that(result[1].content === 'Summary 2: D, E', 'Second should be Summary 2');
    assert.that(result[2].content === 'Message F', 'Third should be F');
  }
});

test({
  id: 'summary-filter-overlapping-summaries',
  name: 'buildMessagesForAPI: should handle overlapping summaries (Scenario 3)',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // Scenario 3 from Issue #31 (overlapping summaries):
    // A, B, [Summary3: A,B], C, [Summary1: A,B,C], D, E, [Summary2: D,E], F, G
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createSummary('Summary 3: A, B', true),
      createMessage('user', 'Message C'),
      createSummary('Summary 1: A, B, C', true),
      createMessage('assistant', 'Message D'),
      createMessage('user', 'Message E'),
      createSummary('Summary 2: D, E', true),
      createMessage('assistant', 'Message F'),
      createMessage('user', 'Message G')
    ];

    const result = buildMessagesForAPI(history);

    // Should include: Summary3, Summary1, Summary2, F, G
    // (A,B shadowed by Summary3; C shadowed by Summary1; D,E shadowed by Summary2)
    assert.that(result.length === 5, `Should have 5 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 3: A, B', 'First should be Summary 3');
    assert.that(result[1].content === 'Summary 1: A, B, C', 'Second should be Summary 1');
    assert.that(result[2].content === 'Summary 2: D, E', 'Third should be Summary 2');
    assert.that(result[3].content === 'Message F', 'Fourth should be F');
    assert.that(result[4].content === 'Message G', 'Fifth should be G');
  }
});

test({
  id: 'summary-filter-mixed-active-inactive',
  name: 'buildMessagesForAPI: should correctly handle mix of active and inactive summaries',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createSummary('Summary 1: A, B', false), // Inactive
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D'),
      createSummary('Summary 2: C, D', true), // Active
      createMessage('user', 'Message E')
    ];

    const result = buildMessagesForAPI(history);

    // Summary 1 is inactive, so A, B are NOT shadowed by it
    // Summary 2 is active, so A, B, C, D are all shadowed (anything before Summary 2)
    // Result: Summary 2, E
    assert.that(result.length === 2, `Should have 2 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 2: C, D', 'First should be Summary 2');
    assert.that(result[1].content === 'Message E', 'Second should be E');
  }
});

// ============================================================================
// Edge cases
// ============================================================================

test({
  id: 'summary-filter-empty-history',
  name: 'buildMessagesForAPI: should handle empty history',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [];
    const result = buildMessagesForAPI(history);

    assert.that(result.length === 0, 'Should return empty array for empty history');
  }
});

test({
  id: 'summary-filter-only-summary',
  name: 'buildMessagesForAPI: should handle history with only a summary',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createSummary('A lonely summary', true)
    ];

    const result = buildMessagesForAPI(history);

    assert.that(result.length === 1, 'Should have 1 message');
    assert.that(result[0].type === 'summary', 'Should be the summary');
  }
});

test({
  id: 'summary-filter-summary-default-active',
  name: 'buildMessagesForAPI: should treat summary without summaryActive as active (default true)',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      // Summary without explicit summaryActive (should default to true)
      { role: 'system', content: 'Summary', type: 'summary' },
      createMessage('user', 'Message C')
    ];

    const result = buildMessagesForAPI(history);

    // A, B should be shadowed because summary defaults to active
    assert.that(result.length === 2, `Should have 2 messages, got ${result.length}`);
    assert.that(result[0].type === 'summary', 'First should be summary');
    assert.that(result[1].content === 'Message C', 'Second should be C');
  }
});

test({
  id: 'summary-filter-preserves-system-messages',
  name: 'buildMessagesForAPI: should not treat regular system messages as summaries',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('system', 'You are a helpful assistant'),
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi!'),
      createSummary('Summary of conversation', true),
      createMessage('user', 'Goodbye')
    ];

    const result = buildMessagesForAPI(history);

    // System message at start should be shadowed like any other message before the summary
    // Result: Summary, Goodbye
    assert.that(result.length === 2, `Should have 2 messages, got ${result.length}`);
    assert.that(result[0].type === 'summary', 'First should be summary');
    assert.that(result[1].content === 'Goodbye', 'Second should be Goodbye');
  }
});

// ============================================================================
// Utility functions
// ============================================================================

test({
  id: 'summary-is-summary-message',
  name: 'isSummaryMessage: should correctly identify summary messages',
  fn: async (assert) => {
    const { isSummaryMessage } = await import('../../lib/summaryUtils.js');

    assert.that(isSummaryMessage(createSummary('test', true)) === true, 'Active summary should be identified');
    assert.that(isSummaryMessage(createSummary('test', false)) === true, 'Inactive summary should still be identified as summary');
    assert.that(isSummaryMessage(createMessage('user', 'test')) === false, 'User message should not be summary');
    assert.that(isSummaryMessage(createMessage('system', 'test')) === false, 'Regular system message should not be summary');
    assert.that(isSummaryMessage({ role: 'system', content: 'test', type: 'summary' }) === true, 'Summary without explicit active should be identified');
  }
});

test({
  id: 'summary-count-shadowed-messages',
  name: 'countShadowedMessages: should count messages that would be shadowed by a summary',
  fn: async (assert) => {
    const { countShadowedMessages } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'A'),
      createMessage('assistant', 'B'),
      createMessage('user', 'C'),
      createSummary('Summary', true), // at index 3
      createMessage('assistant', 'D'),
      createMessage('user', 'E')
    ];

    // Summary at index 3 shadows messages 0, 1, 2 (A, B, C)
    const count = countShadowedMessages(history, 3);

    assert.that(count === 3, `Should shadow 3 messages, got ${count}`);
  }
});

test({
  id: 'summary-count-shadowed-with-prior-summary',
  name: 'countShadowedMessages: should only count messages between prior summary and current',
  fn: async (assert) => {
    const { countShadowedMessages } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'A'),
      createMessage('assistant', 'B'),
      createSummary('Summary 1', true), // at index 2
      createMessage('user', 'C'),
      createMessage('assistant', 'D'),
      createSummary('Summary 2', true), // at index 5
      createMessage('user', 'E')
    ];

    // Summary 2 at index 5 shadows messages 3, 4 (C, D) - not messages before Summary 1
    const count = countShadowedMessages(history, 5);

    assert.that(count === 2, `Should shadow 2 messages (C, D), got ${count}`);
  }
});
