/**
 * Unit tests for summary generation functionality
 *
 * TDD tests for summary creation, message collection, and prompt formatting.
 */

import { test } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
  return { role, content };
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
// Message collection for summarization
// ============================================================================

test({
  id: 'summary-gen-collect-messages-no-prior-summary',
  name: 'getMessagesToSummarize: should collect all messages up to target when no prior summary',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D')
    ];

    // Summarize up to and including Message C (index 2)
    const messages = getMessagesToSummarize(history, 2);

    assert.that(messages.length === 3, `Should collect 3 messages, got ${messages.length}`);
    assert.that(messages[0].content === 'Message A', 'First should be A');
    assert.that(messages[1].content === 'Message B', 'Second should be B');
    assert.that(messages[2].content === 'Message C', 'Third should be C');
  }
});

test({
  id: 'summary-gen-collect-messages-with-prior-summary',
  name: 'getMessagesToSummarize: should collect only messages after prior summary',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createSummary('Summary 1', true),
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D'),
      createMessage('user', 'Message E')
    ];

    // Summarize up to and including Message E (index 5)
    // Should only include C, D, E (not A, B which are before Summary 1)
    const messages = getMessagesToSummarize(history, 5);

    assert.that(messages.length === 3, `Should collect 3 messages (C, D, E), got ${messages.length}`);
    assert.that(messages[0].content === 'Message C', 'First should be C');
    assert.that(messages[1].content === 'Message D', 'Second should be D');
    assert.that(messages[2].content === 'Message E', 'Third should be E');
  }
});

test({
  id: 'summary-gen-collect-messages-excludes-summaries',
  name: 'getMessagesToSummarize: should not include existing summaries in collected messages',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createSummary('Old summary', true),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C')
    ];

    // Summarize up to and including Message C (index 3)
    // Should only include B, C (not the old summary at index 1)
    const messages = getMessagesToSummarize(history, 3);

    assert.that(messages.length === 2, `Should collect 2 messages, got ${messages.length}`);
    assert.that(messages[0].content === 'Message B', 'First should be B');
    assert.that(messages[1].content === 'Message C', 'Second should be C');
  }
});

test({
  id: 'summary-gen-collect-single-message',
  name: 'getMessagesToSummarize: should handle single message collection',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Only message')
    ];

    const messages = getMessagesToSummarize(history, 0);

    assert.that(messages.length === 1, 'Should collect 1 message');
    assert.that(messages[0].content === 'Only message', 'Should be the only message');
  }
});

// ============================================================================
// Summary prompt formatting
// ============================================================================

test({
  id: 'summary-gen-format-prompt',
  name: 'formatSummaryPrompt: should create proper summarization prompt',
  fn: async (assert) => {
    const { formatSummaryPrompt } = await import('../../managers/summaryManager.js');

    const messages: ChatMessage[] = [
      createMessage('user', 'Hello, how are you?'),
      createMessage('assistant', 'I am doing well, thank you!'),
      createMessage('user', 'What is the weather like?')
    ];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('Summarize'), 'Prompt should mention summarizing');
    assert.that(prompt.includes('Hello, how are you?'), 'Prompt should include message content');
    assert.that(prompt.includes('I am doing well'), 'Prompt should include assistant response');
    assert.that(prompt.includes('weather'), 'Prompt should include all messages');
  }
});

test({
  id: 'summary-gen-format-prompt-roles',
  name: 'formatSummaryPrompt: should include role labels in prompt',
  fn: async (assert) => {
    const { formatSummaryPrompt } = await import('../../managers/summaryManager.js');

    const messages: ChatMessage[] = [
      createMessage('user', 'User question'),
      createMessage('assistant', 'Assistant answer')
    ];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('User:') || prompt.includes('user:'), 'Prompt should label user messages');
    assert.that(prompt.includes('Assistant:') || prompt.includes('assistant:'), 'Prompt should label assistant messages');
  }
});

// ============================================================================
// Summary insertion
// ============================================================================

test({
  id: 'summary-gen-insertion-index',
  name: 'getSummaryInsertionIndex: should return correct insertion position',
  fn: async (assert) => {
    const { getSummaryInsertionIndex } = await import('../../lib/summaryUtils.js');

    // Summary should be inserted right after the target message
    assert.that(getSummaryInsertionIndex(0) === 1, 'After index 0 should insert at 1');
    assert.that(getSummaryInsertionIndex(2) === 3, 'After index 2 should insert at 3');
    assert.that(getSummaryInsertionIndex(5) === 6, 'After index 5 should insert at 6');
  }
});

test({
  id: 'summary-gen-insert-into-history',
  name: 'insertSummaryIntoHistory: should insert summary at correct position',
  fn: async (assert) => {
    const { insertSummaryIntoHistory } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D')
    ];

    // Insert summary after Message C (index 2), so at index 3
    const newHistory = insertSummaryIntoHistory(history, 2, 'Summary of A, B, C');

    assert.that(newHistory.length === 5, `Should have 5 messages, got ${newHistory.length}`);
    assert.that(newHistory[0].content === 'Message A', 'First should still be A');
    assert.that(newHistory[1].content === 'Message B', 'Second should still be B');
    assert.that(newHistory[2].content === 'Message C', 'Third should still be C');
    assert.that(newHistory[3].type === 'summary', 'Fourth should be the summary');
    assert.that(newHistory[3].content === 'Summary of A, B, C', 'Summary content should match');
    assert.that(newHistory[4].content === 'Message D', 'Fifth should be D (shifted)');
  }
});

test({
  id: 'summary-gen-insert-at-end',
  name: 'insertSummaryIntoHistory: should handle insertion at end of history',
  fn: async (assert) => {
    const { insertSummaryIntoHistory } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B')
    ];

    // Insert summary after Message B (index 1), so at index 2 (end)
    const newHistory = insertSummaryIntoHistory(history, 1, 'Summary');

    assert.that(newHistory.length === 3, 'Should have 3 messages');
    assert.that(newHistory[2].type === 'summary', 'Third should be the summary');
    assert.that(newHistory[2].summaryActive === true, 'Summary should be active by default');
  }
});

// ============================================================================
// Summary message creation
// ============================================================================

test({
  id: 'summary-gen-create-message',
  name: 'createSummaryMessage: should create properly formatted summary message',
  fn: async (assert) => {
    const { createSummaryMessage } = await import('../../lib/summaryUtils.js');

    const summary = createSummaryMessage('This is a summary');

    assert.that(summary.role === 'system', 'Role should be system');
    assert.that(summary.type === 'summary', 'Type should be summary');
    assert.that(summary.content === 'This is a summary', 'Content should match');
    assert.that(summary.summaryActive === true, 'Should be active by default');
  }
});

test({
  id: 'summary-gen-create-inactive-message',
  name: 'createSummaryMessage: should create inactive summary when specified',
  fn: async (assert) => {
    const { createSummaryMessage } = await import('../../lib/summaryUtils.js');

    const summary = createSummaryMessage('Inactive summary', false);

    assert.that(summary.summaryActive === false, 'Should be inactive when specified');
  }
});
