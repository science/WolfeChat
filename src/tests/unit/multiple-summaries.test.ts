/**
 * Unit tests for multiple summaries functionality
 *
 * Tests Scenarios 2 and 3 from Issue #31:
 * - Creating multiple summaries at different positions
 * - Correct message shadowing with multiple active summaries
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
// Scenario 2: Second summary below existing
// ============================================================================

test({
  id: 'multiple-summaries-scenario-2-collection',
  name: 'getMessagesToSummarize: Scenario 2 - second summary collects only messages after first summary',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    // Scenario 2 setup:
    // A, B, C, [Summary1], D, E, F
    // Creating summary at index 5 (E) should only collect D and E
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),        // 0
      createMessage('assistant', 'Message B'),   // 1
      createMessage('user', 'Message C'),        // 2
      createSummary('Summary 1: A, B, C', true), // 3
      createMessage('assistant', 'Message D'),   // 4
      createMessage('user', 'Message E'),        // 5
      createMessage('assistant', 'Message F')    // 6
    ];

    // Summarize up to E (index 5)
    const messages = getMessagesToSummarize(history, 5);

    assert.that(messages.length === 2, `Should collect 2 messages (D, E), got ${messages.length}`);
    assert.that(messages[0].content === 'Message D', 'First should be D');
    assert.that(messages[1].content === 'Message E', 'Second should be E');
  }
});

test({
  id: 'multiple-summaries-scenario-2-filtering',
  name: 'buildMessagesForAPI: Scenario 2 - two summaries shadow their respective messages',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // After Scenario 2:
    // A, B, C, [Summary1], D, E, [Summary2], F, G (new message)
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),        // 0
      createMessage('assistant', 'Message B'),   // 1
      createMessage('user', 'Message C'),        // 2
      createSummary('Summary 1: A, B, C', true), // 3
      createMessage('assistant', 'Message D'),   // 4
      createMessage('user', 'Message E'),        // 5
      createSummary('Summary 2: D, E', true),    // 6
      createMessage('assistant', 'Message F'),   // 7
      createMessage('user', 'Message G')         // 8
    ];

    const result = buildMessagesForAPI(history);

    // Expected: [Summary1, Summary2, F, G]
    assert.that(result.length === 4, `Should have 4 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 1: A, B, C', 'First should be Summary 1');
    assert.that(result[1].content === 'Summary 2: D, E', 'Second should be Summary 2');
    assert.that(result[2].content === 'Message F', 'Third should be F');
    assert.that(result[3].content === 'Message G', 'Fourth should be G');
  }
});

// ============================================================================
// Scenario 3: Summary above existing (overlapping)
// ============================================================================

test({
  id: 'multiple-summaries-scenario-3-collection',
  name: 'getMessagesToSummarize: Scenario 3 - summary above existing collects all messages above it',
  fn: async (assert) => {
    const { getMessagesToSummarize } = await import('../../lib/summaryUtils.js');

    // After Scenario 2, before adding Summary 3:
    // A, B, C, [Summary1], D, E, [Summary2], F
    // User clicks on B (index 1) to create Summary 3
    // Should collect A and B (messages before it, no prior summary)
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),        // 0
      createMessage('assistant', 'Message B'),   // 1
      createMessage('user', 'Message C'),        // 2
      createSummary('Summary 1: A, B, C', true), // 3
      createMessage('assistant', 'Message D'),   // 4
      createMessage('user', 'Message E'),        // 5
      createSummary('Summary 2: D, E', true),    // 6
      createMessage('assistant', 'Message F')    // 7
    ];

    // Summarize up to B (index 1)
    const messages = getMessagesToSummarize(history, 1);

    assert.that(messages.length === 2, `Should collect 2 messages (A, B), got ${messages.length}`);
    assert.that(messages[0].content === 'Message A', 'First should be A');
    assert.that(messages[1].content === 'Message B', 'Second should be B');
  }
});

test({
  id: 'multiple-summaries-scenario-3-filtering',
  name: 'buildMessagesForAPI: Scenario 3 - three overlapping summaries all included',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // Full Scenario 3 result:
    // A, B, [Summary3: A,B], C, [Summary1: A,B,C], D, E, [Summary2: D,E], F, G, H, I
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),            // 0
      createMessage('assistant', 'Message B'),       // 1
      createSummary('Summary 3: A, B', true),        // 2
      createMessage('user', 'Message C'),            // 3
      createSummary('Summary 1: A, B, C', true),     // 4
      createMessage('assistant', 'Message D'),       // 5
      createMessage('user', 'Message E'),            // 6
      createSummary('Summary 2: D, E', true),        // 7
      createMessage('assistant', 'Message F'),       // 8
      createMessage('user', 'Message G'),            // 9
      createMessage('assistant', 'Message H'),       // 10
      createMessage('user', 'Message I')             // 11
    ];

    const result = buildMessagesForAPI(history);

    // Expected: [Summary3, Summary1, Summary2, F, G, H, I]
    assert.that(result.length === 7, `Should have 7 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 3: A, B', 'First should be Summary 3');
    assert.that(result[1].content === 'Summary 1: A, B, C', 'Second should be Summary 1');
    assert.that(result[2].content === 'Summary 2: D, E', 'Third should be Summary 2');
    assert.that(result[3].content === 'Message F', 'Fourth should be F');
    assert.that(result[4].content === 'Message G', 'Fifth should be G');
    assert.that(result[5].content === 'Message H', 'Sixth should be H');
    assert.that(result[6].content === 'Message I', 'Seventh should be I');
  }
});

// ============================================================================
// Mixed active/inactive with multiple summaries
// ============================================================================

test({
  id: 'multiple-summaries-mixed-active',
  name: 'buildMessagesForAPI: multiple summaries with some inactive',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // Two summaries, first is inactive
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),            // 0
      createMessage('assistant', 'Message B'),       // 1
      createSummary('Summary 1: A, B', false),       // 2 - INACTIVE
      createMessage('user', 'Message C'),            // 3
      createMessage('assistant', 'Message D'),       // 4
      createSummary('Summary 2: C, D', true),        // 5 - ACTIVE
      createMessage('user', 'Message E')             // 6
    ];

    const result = buildMessagesForAPI(history);

    // Summary 1 is inactive, so A, B, C, D are all shadowed by Summary 2
    // Expected: [Summary 2, E]
    assert.that(result.length === 2, `Should have 2 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 2: C, D', 'First should be Summary 2');
    assert.that(result[1].content === 'Message E', 'Second should be E');
  }
});

test({
  id: 'multiple-summaries-last-inactive',
  name: 'buildMessagesForAPI: last summary inactive, earlier one active',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    // Two summaries, second is inactive
    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),            // 0
      createMessage('assistant', 'Message B'),       // 1
      createSummary('Summary 1: A, B', true),        // 2 - ACTIVE
      createMessage('user', 'Message C'),            // 3
      createMessage('assistant', 'Message D'),       // 4
      createSummary('Summary 2: C, D', false),       // 5 - INACTIVE
      createMessage('user', 'Message E')             // 6
    ];

    const result = buildMessagesForAPI(history);

    // Summary 2 is inactive, so it's skipped
    // Summary 1 is active, so A, B are shadowed
    // C, D, E are not shadowed (no active summary after them)
    // Expected: [Summary 1, C, D, E]
    assert.that(result.length === 4, `Should have 4 messages, got ${result.length}`);
    assert.that(result[0].content === 'Summary 1: A, B', 'First should be Summary 1');
    assert.that(result[1].content === 'Message C', 'Second should be C');
    assert.that(result[2].content === 'Message D', 'Third should be D');
    assert.that(result[3].content === 'Message E', 'Fourth should be E');
  }
});

test({
  id: 'multiple-summaries-all-inactive',
  name: 'buildMessagesForAPI: all summaries inactive returns all messages',
  fn: async (assert) => {
    const { buildMessagesForAPI } = await import('../../lib/summaryUtils.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createSummary('Summary 1', false),
      createMessage('user', 'Message C'),
      createSummary('Summary 2', false),
      createMessage('assistant', 'Message D')
    ];

    const result = buildMessagesForAPI(history);

    // All summaries inactive, so all messages are included (no summaries)
    assert.that(result.length === 4, `Should have 4 messages (A, B, C, D), got ${result.length}`);
    assert.that(result.every(m => m.type !== 'summary'), 'No summaries should be in result');
  }
});
