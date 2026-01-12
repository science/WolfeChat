/**
 * Unit tests for streaming summary functionality
 *
 * TDD tests for streaming summary generation with:
 * - Placeholder insertion
 * - Progressive content updates
 * - Loading state management
 * - Abort handling
 */

import { test } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

// ============================================================================
// Placeholder Summary Insertion
// ============================================================================

test({
  id: 'streaming-summary-create-placeholder',
  name: 'createPlaceholderSummary: should create empty summary with loading flag',
  fn: async (assert) => {
    const { createPlaceholderSummary } = await import('../../managers/summaryManager.js');

    const placeholder = createPlaceholderSummary();

    assert.that(placeholder.role === 'system', 'Role should be system');
    assert.that(placeholder.type === 'summary', 'Type should be summary');
    assert.that(placeholder.content === '', 'Content should be empty initially');
    assert.that(placeholder.summaryActive === true, 'Should be active by default');
    assert.that(placeholder.summaryLoading === true, 'Should have loading flag set to true');
  }
});

test({
  id: 'streaming-summary-insert-placeholder-into-history',
  name: 'insertPlaceholderSummary: should insert placeholder at correct position',
  fn: async (assert) => {
    const { insertPlaceholderSummary } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createMessage('assistant', 'Message B'),
      createMessage('user', 'Message C'),
      createMessage('assistant', 'Message D')
    ];

    // Insert placeholder after Message C (index 2)
    const newHistory = insertPlaceholderSummary(history, 2);

    assert.that(newHistory.length === 5, `Should have 5 messages, got ${newHistory.length}`);
    assert.that(newHistory[3].type === 'summary', 'Fourth message should be summary');
    assert.that(newHistory[3].summaryLoading === true, 'Summary should be in loading state');
    assert.that(newHistory[3].content === '', 'Summary content should be empty');
    assert.that(newHistory[4].content === 'Message D', 'Fifth message should be D (shifted)');
  }
});

// ============================================================================
// Progressive Content Updates
// ============================================================================

test({
  id: 'streaming-summary-update-content-partial',
  name: 'updateStreamingSummaryContent: should update content while maintaining loading state',
  fn: async (assert) => {
    const { createPlaceholderSummary, updateStreamingSummaryContent } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createPlaceholderSummary() // at index 1
    ];

    // Update with partial content
    const updated = updateStreamingSummaryContent(history, 1, 'Partial summary text...');

    assert.that(updated[1].content === 'Partial summary text...', 'Content should be updated');
    assert.that(updated[1].summaryLoading === true, 'Should still be in loading state');
    assert.that(updated[1].type === 'summary', 'Should still be a summary');
  }
});

test({
  id: 'streaming-summary-append-content',
  name: 'updateStreamingSummaryContent: should handle multiple progressive updates',
  fn: async (assert) => {
    const { createPlaceholderSummary, updateStreamingSummaryContent } = await import('../../managers/summaryManager.js');

    let history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      createPlaceholderSummary() // at index 1
    ];

    // Simulate streaming chunks
    history = updateStreamingSummaryContent(history, 1, 'First chunk');
    assert.that(history[1].content === 'First chunk', 'First update');

    history = updateStreamingSummaryContent(history, 1, 'First chunk... second chunk');
    assert.that(history[1].content === 'First chunk... second chunk', 'Second update');

    history = updateStreamingSummaryContent(history, 1, 'First chunk... second chunk... done');
    assert.that(history[1].content === 'First chunk... second chunk... done', 'Final update');
    assert.that(history[1].summaryLoading === true, 'Still loading until explicitly completed');
  }
});

// ============================================================================
// Loading State Completion
// ============================================================================

test({
  id: 'streaming-summary-complete-loading',
  name: 'completeSummaryLoading: should set loading to false when complete',
  fn: async (assert) => {
    const { createPlaceholderSummary, completeSummaryLoading } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      { ...createPlaceholderSummary(), content: 'Final summary content' }
    ];

    const completed = completeSummaryLoading(history, 1);

    assert.that(completed[1].summaryLoading === false, 'Loading should be false');
    assert.that(completed[1].content === 'Final summary content', 'Content should be preserved');
    assert.that(completed[1].summaryActive === true, 'Should still be active');
  }
});

test({
  id: 'streaming-summary-abort-preserves-partial',
  name: 'completeSummaryLoading: should preserve partial content when aborted',
  fn: async (assert) => {
    const { createPlaceholderSummary, completeSummaryLoading } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'Message A'),
      { ...createPlaceholderSummary(), content: 'Partial content before abort...' }
    ];

    // Complete loading (same function for both success and abort)
    const aborted = completeSummaryLoading(history, 1);

    assert.that(aborted[1].summaryLoading === false, 'Loading should be false after abort');
    assert.that(aborted[1].content === 'Partial content before abort...', 'Partial content preserved');
    assert.that(aborted[1].type === 'summary', 'Should still be a summary');
  }
});

// ============================================================================
// Summary Loading State Detection
// ============================================================================

test({
  id: 'streaming-summary-is-loading',
  name: 'isSummaryLoading: should detect loading state correctly',
  fn: async (assert) => {
    const { isSummaryLoading, createPlaceholderSummary } = await import('../../managers/summaryManager.js');

    const loadingSummary = createPlaceholderSummary();
    const completedSummary = { ...loadingSummary, summaryLoading: false };
    const regularMessage = createMessage('user', 'Hello');
    const regularSummary: ChatMessage = { role: 'system', content: 'Summary', type: 'summary' };

    assert.that(isSummaryLoading(loadingSummary) === true, 'Loading summary should return true');
    assert.that(isSummaryLoading(completedSummary) === false, 'Completed summary should return false');
    assert.that(isSummaryLoading(regularMessage) === false, 'Regular message should return false');
    assert.that(isSummaryLoading(regularSummary) === false, 'Regular summary without flag should return false');
  }
});

// ============================================================================
// History Index Management
// ============================================================================

test({
  id: 'streaming-summary-find-loading-index',
  name: 'findLoadingSummaryIndex: should find index of loading summary in history',
  fn: async (assert) => {
    const { findLoadingSummaryIndex, createPlaceholderSummary } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'A'),
      createMessage('assistant', 'B'),
      createPlaceholderSummary(), // index 2
      createMessage('user', 'C')
    ];

    const index = findLoadingSummaryIndex(history);

    assert.that(index === 2, `Should find loading summary at index 2, got ${index}`);
  }
});

test({
  id: 'streaming-summary-find-loading-index-none',
  name: 'findLoadingSummaryIndex: should return -1 when no loading summary',
  fn: async (assert) => {
    const { findLoadingSummaryIndex } = await import('../../managers/summaryManager.js');

    const history: ChatMessage[] = [
      createMessage('user', 'A'),
      createMessage('assistant', 'B'),
      { role: 'system', content: 'Complete summary', type: 'summary', summaryActive: true } // not loading
    ];

    const index = findLoadingSummaryIndex(history);

    assert.that(index === -1, `Should return -1 when no loading summary, got ${index}`);
  }
});
