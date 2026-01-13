/**
 * Tests for dynamic summary word target calculation
 *
 * The algorithm:
 * 1. Count total characters in message content
 * 2. Divide by 5 to estimate word count
 * 3. Take 10% of that as the target
 * 4. Clamp between min (50) and max (2000) bounds
 */

import { test } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';
import {
  calculateSummaryWordTarget,
  formatSummaryPrompt,
  SUMMARY_WORD_TARGET_MIN,
  SUMMARY_WORD_TARGET_MAX
} from '../../managers/summaryManager.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

// ============================================================================
// Basic calculation (chars / 5 * 0.10)
// ============================================================================

test({
  id: 'word-target-basic-medium',
  name: 'calculateSummaryWordTarget: calculates 10% of estimated word count for medium conversations',
  fn: async (assert) => {
    // 5000 chars / 5 = 1000 words, 10% = 100 word target
    const content = 'a'.repeat(5000);
    const messages = [createMessage('user', content)];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 100, `Expected 100, got ${result}`);
  }
});

test({
  id: 'word-target-basic-multiple-messages',
  name: 'calculateSummaryWordTarget: sums content from multiple messages',
  fn: async (assert) => {
    // 2500 + 2500 = 5000 chars / 5 = 1000 words, 10% = 100
    const messages = [
      createMessage('user', 'a'.repeat(2500)),
      createMessage('assistant', 'b'.repeat(2500))
    ];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 100, `Expected 100, got ${result}`);
  }
});

test({
  id: 'word-target-basic-typical',
  name: 'calculateSummaryWordTarget: calculates correctly for typical conversation',
  fn: async (assert) => {
    // 10000 chars / 5 = 2000 words, 10% = 200 word target
    const messages = [
      createMessage('user', 'a'.repeat(3000)),
      createMessage('assistant', 'b'.repeat(4000)),
      createMessage('user', 'c'.repeat(3000))
    ];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 200, `Expected 200, got ${result}`);
  }
});

// ============================================================================
// Minimum bound (50 words)
// ============================================================================

test({
  id: 'word-target-min-short',
  name: 'calculateSummaryWordTarget: returns minimum 50 for very short conversations',
  fn: async (assert) => {
    // 500 chars / 5 = 100 words, 10% = 10, but min is 50
    const messages = [createMessage('user', 'a'.repeat(500))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 50, `Expected 50 (minimum), got ${result}`);
  }
});

test({
  id: 'word-target-min-empty-content',
  name: 'calculateSummaryWordTarget: returns minimum 50 for empty content',
  fn: async (assert) => {
    const messages = [createMessage('user', '')];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 50, `Expected 50 (minimum), got ${result}`);
  }
});

test({
  id: 'word-target-min-empty-array',
  name: 'calculateSummaryWordTarget: returns minimum 50 for empty messages array',
  fn: async (assert) => {
    const result = calculateSummaryWordTarget([]);
    assert.that(result === 50, `Expected 50 (minimum), got ${result}`);
  }
});

test({
  id: 'word-target-min-boundary',
  name: 'calculateSummaryWordTarget: returns exactly 50 at the minimum boundary',
  fn: async (assert) => {
    // Need 2500 chars to get exactly 50: 2500 / 5 = 500 words, 10% = 50
    const messages = [createMessage('user', 'a'.repeat(2500))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 50, `Expected 50, got ${result}`);
  }
});

test({
  id: 'word-target-min-clamped',
  name: 'calculateSummaryWordTarget: clamps to minimum when calculation is below 50',
  fn: async (assert) => {
    // 2000 chars / 5 = 400 words, 10% = 40, clamped to 50
    const messages = [createMessage('user', 'a'.repeat(2000))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 50, `Expected 50 (clamped minimum), got ${result}`);
  }
});

// ============================================================================
// Maximum bound (2000 words)
// ============================================================================

test({
  id: 'word-target-max-long',
  name: 'calculateSummaryWordTarget: caps at 2000 for very long conversations',
  fn: async (assert) => {
    // 150000 chars / 5 = 30000 words, 10% = 3000, capped to 2000
    const messages = [createMessage('user', 'a'.repeat(150000))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 2000, `Expected 2000 (maximum), got ${result}`);
  }
});

test({
  id: 'word-target-max-boundary',
  name: 'calculateSummaryWordTarget: returns exactly 2000 at the maximum boundary',
  fn: async (assert) => {
    // Need 100000 chars: 100000 / 5 = 20000 words, 10% = 2000
    const messages = [createMessage('user', 'a'.repeat(100000))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 2000, `Expected 2000, got ${result}`);
  }
});

test({
  id: 'word-target-max-multiple',
  name: 'calculateSummaryWordTarget: caps multiple long messages',
  fn: async (assert) => {
    // 200000 total chars / 5 = 40000 words, 10% = 4000, capped to 2000
    const messages = [
      createMessage('user', 'a'.repeat(100000)),
      createMessage('assistant', 'b'.repeat(100000))
    ];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 2000, `Expected 2000 (capped maximum), got ${result}`);
  }
});

// ============================================================================
// Edge cases
// ============================================================================

test({
  id: 'word-target-edge-whitespace',
  name: 'calculateSummaryWordTarget: handles messages with whitespace (whitespace counts as chars)',
  fn: async (assert) => {
    // Whitespace still counts as characters
    const messages = [createMessage('user', '   '.repeat(1000))]; // 3000 chars
    // 3000 / 5 = 600 words, 10% = 60

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 60, `Expected 60, got ${result}`);
  }
});

test({
  id: 'word-target-edge-unicode',
  name: 'calculateSummaryWordTarget: counts all character types equally',
  fn: async (assert) => {
    // Mix of letters, numbers, punctuation, unicode
    const content = 'Hello! 你好 123 🎉'.repeat(250);
    const messages = [createMessage('user', content)];
    const charCount = content.length;
    const expected = Math.max(50, Math.min(2000, Math.round(charCount / 5 * 0.10)));

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === expected, `Expected ${expected}, got ${result}`);
  }
});

test({
  id: 'word-target-edge-role-agnostic',
  name: 'calculateSummaryWordTarget: ignores role, only counts content',
  fn: async (assert) => {
    // Same content should give same result regardless of roles
    const content = 'a'.repeat(5000);
    const userMessages = [createMessage('user', content)];
    const assistantMessages = [createMessage('assistant', content)];

    const userResult = calculateSummaryWordTarget(userMessages);
    const assistantResult = calculateSummaryWordTarget(assistantMessages);

    assert.that(userResult === assistantResult, `Results differ: user=${userResult}, assistant=${assistantResult}`);
  }
});

test({
  id: 'word-target-edge-rounding',
  name: 'calculateSummaryWordTarget: rounds to nearest integer',
  fn: async (assert) => {
    // 5555 chars / 5 = 1111 words, 10% = 111.1, should round to 111
    const messages = [createMessage('user', 'a'.repeat(5555))];

    const result = calculateSummaryWordTarget(messages);
    assert.that(result === 111, `Expected 111 (rounded), got ${result}`);
  }
});

// ============================================================================
// Constants verification
// ============================================================================

test({
  id: 'word-target-const-min',
  name: 'calculateSummaryWordTarget: MIN constant is 50',
  fn: async (assert) => {
    assert.that(SUMMARY_WORD_TARGET_MIN === 50, `Expected SUMMARY_WORD_TARGET_MIN to be 50, got ${SUMMARY_WORD_TARGET_MIN}`);
  }
});

test({
  id: 'word-target-const-max',
  name: 'calculateSummaryWordTarget: MAX constant is 2000',
  fn: async (assert) => {
    assert.that(SUMMARY_WORD_TARGET_MAX === 2000, `Expected SUMMARY_WORD_TARGET_MAX to be 2000, got ${SUMMARY_WORD_TARGET_MAX}`);
  }
});

// ============================================================================
// formatSummaryPrompt with dynamic word target
// ============================================================================

test({
  id: 'format-prompt-dynamic-medium',
  name: 'formatSummaryPrompt: includes dynamic word target for medium conversation',
  fn: async (assert) => {
    // 5000 chars / 5 = 1000 words, 10% = 100 word target
    const messages = [createMessage('user', 'a'.repeat(5000))];

    const prompt = formatSummaryPrompt(messages);

    // Should contain "100 words" not "200 words"
    assert.that(prompt.includes('100 words'), `Expected prompt to mention "100 words", got: ${prompt.substring(0, 300)}...`);
    assert.that(!prompt.includes('200 words'), 'Prompt should not contain hardcoded "200 words"');
  }
});

test({
  id: 'format-prompt-dynamic-minimum',
  name: 'formatSummaryPrompt: includes minimum word target for short conversation',
  fn: async (assert) => {
    // Very short conversation should use minimum of 50
    const messages = [createMessage('user', 'Hello')];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('50 words'), `Expected prompt to mention "50 words" (minimum), got: ${prompt.substring(0, 300)}...`);
  }
});

test({
  id: 'format-prompt-dynamic-maximum',
  name: 'formatSummaryPrompt: includes maximum word target for very long conversation',
  fn: async (assert) => {
    // Very long conversation should use maximum of 2000
    const messages = [createMessage('user', 'a'.repeat(150000))];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('2000 words'), `Expected prompt to mention "2000 words" (maximum), got: ${prompt.substring(0, 300)}...`);
  }
});

test({
  id: 'format-prompt-dynamic-multiple',
  name: 'formatSummaryPrompt: calculates target from multiple messages',
  fn: async (assert) => {
    // 10000 total chars / 5 = 2000 words, 10% = 200 word target
    const messages = [
      createMessage('user', 'a'.repeat(5000)),
      createMessage('assistant', 'b'.repeat(5000))
    ];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('200 words'), `Expected prompt to mention "200 words", got: ${prompt.substring(0, 300)}...`);
  }
});

test({
  id: 'format-prompt-content-preserved',
  name: 'formatSummaryPrompt: still contains conversation content',
  fn: async (assert) => {
    const messages = [
      createMessage('user', 'Hello, how are you?'),
      createMessage('assistant', 'I am doing well, thank you!')
    ];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('User: Hello, how are you?'), 'Prompt should include formatted user message');
    assert.that(prompt.includes('Assistant: I am doing well, thank you!'), 'Prompt should include formatted assistant message');
  }
});

test({
  id: 'format-prompt-structure',
  name: 'formatSummaryPrompt: contains summary instruction structure',
  fn: async (assert) => {
    const messages = [createMessage('user', 'Test message')];

    const prompt = formatSummaryPrompt(messages);

    assert.that(prompt.includes('Summarize'), 'Prompt should contain "Summarize" instruction');
    assert.that(prompt.includes('Key topics'), 'Prompt should mention "Key topics"');
    assert.that(prompt.includes('third person'), 'Prompt should mention "third person"');
  }
});
