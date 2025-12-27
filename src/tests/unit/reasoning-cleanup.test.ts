/**
 * Unit tests for reasoning cleanup functionality
 *
 * TDD tests for the cleanupReasoningForDeletedMessages function
 * that will be extracted to DRY up the codebase.
 */

import { test } from '../testHarness.js';
import { get } from 'svelte/store';
import {
  reasoningWindows,
  reasoningPanels,
  createReasoningWindow,
  startReasoningPanel,
  clearAllReasoning,
} from '../../stores/reasoningStore.js';

// Helper to set up test windows
function setupTestWindows(convId: string, anchorIndices: number[]): string[] {
  const windowIds: string[] = [];
  for (const anchorIndex of anchorIndices) {
    const windowId = createReasoningWindow(convId, 'test-model', anchorIndex);
    windowIds.push(windowId);
  }
  return windowIds;
}

// Helper to set up windows with panels
function setupTestWindowsWithPanels(convId: string, anchorIndices: number[]): { windowId: string; panelId: string }[] {
  const results: { windowId: string; panelId: string }[] = [];
  for (const anchorIndex of anchorIndices) {
    const windowId = createReasoningWindow(convId, 'test-model', anchorIndex);
    const panelId = startReasoningPanel('text', convId, windowId);
    results.push({ windowId, panelId });
  }
  return results;
}

// ============================================================================
// deleteAtIndex - single message deletion tests
// ============================================================================

test({
  id: 'cleanup-delete-at-index-exact',
  name: 'cleanupReasoningForDeletedMessages: should delete window at exact index',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindows(convId, [0, 1, 2]);

    assert.that(get(reasoningWindows).length === 3, 'Setup: should have 3 windows');

    // Import and call the function (will fail until implemented)
    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtIndex: 1 });

    const remaining = get(reasoningWindows);
    assert.that(remaining.length === 2, 'Should have 2 windows after deletion');
    assert.that(remaining.some(w => w.anchorIndex === 0), 'Window at index 0 should remain');
    assert.that(!remaining.some(w => w.anchorIndex === 1), 'Window at index 1 should be deleted');
    assert.that(remaining.some(w => w.anchorIndex === 2), 'Window at index 2 should remain');
  }
});

test({
  id: 'cleanup-delete-at-index-cross-conversation-isolation',
  name: 'cleanupReasoningForDeletedMessages: should not delete windows from other conversations',
  fn: (assert) => {
    clearAllReasoning();
    const convId1 = 'test-conv-1';
    const convId2 = 'test-conv-2';

    setupTestWindows(convId1, [0, 1]);
    createReasoningWindow(convId2, 'test-model', 0);
    createReasoningWindow(convId2, 'test-model', 1);

    assert.that(get(reasoningWindows).length === 4, 'Setup: should have 4 windows');

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId1, { deleteAtIndex: 1 });

    const remaining = get(reasoningWindows);
    assert.that(remaining.length === 3, 'Should have 3 windows after deletion');
    assert.that(remaining.filter(w => w.convId === convId1).length === 1, 'Conv1 should have 1 window');
    assert.that(remaining.filter(w => w.convId === convId2).length === 2, 'Conv2 should still have 2 windows');
  }
});

test({
  id: 'cleanup-delete-at-index-with-panels',
  name: 'cleanupReasoningForDeletedMessages: should delete panels linked to deleted windows',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    const setup = setupTestWindowsWithPanels(convId, [0, 1, 2]);

    assert.that(get(reasoningWindows).length === 3, 'Setup: should have 3 windows');
    assert.that(get(reasoningPanels).length === 3, 'Setup: should have 3 panels');

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtIndex: 1 });

    assert.that(get(reasoningWindows).length === 2, 'Should have 2 windows');
    assert.that(get(reasoningPanels).length === 2, 'Should have 2 panels');

    const remainingPanels = get(reasoningPanels);
    assert.that(!remainingPanels.some(p => p.responseId === setup[1].windowId),
      'Panel linked to deleted window should be removed');
  }
});

// ============================================================================
// reindexAfterIndex - index adjustment after deletion tests
// ============================================================================

test({
  id: 'cleanup-reindex-after-deletion',
  name: 'cleanupReasoningForDeletedMessages: should decrement anchorIndex for windows after deleted index',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindows(convId, [0, 1, 2, 3]);

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, {
      deleteAtIndex: 1,
      reindexAfterIndex: 1
    });

    const remaining = get(reasoningWindows);
    assert.that(remaining.length === 3, 'Should have 3 windows');

    // Check re-indexed values
    const indices = remaining.map(w => w.anchorIndex).sort((a, b) => (a ?? 0) - (b ?? 0));
    assert.that(indices[0] === 0, 'First window should be at index 0');
    assert.that(indices[1] === 1, 'Second window should be at index 1 (was 2)');
    assert.that(indices[2] === 2, 'Third window should be at index 2 (was 3)');
  }
});

test({
  id: 'cleanup-reindex-cross-conversation-isolation',
  name: 'cleanupReasoningForDeletedMessages: should not re-index windows in other conversations',
  fn: (assert) => {
    clearAllReasoning();
    const convId1 = 'test-conv-1';
    const convId2 = 'test-conv-2';

    setupTestWindows(convId1, [0, 1, 2]);
    createReasoningWindow(convId2, 'test-model', 2);

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId1, {
      deleteAtIndex: 1,
      reindexAfterIndex: 1
    });

    // Conv2's window at index 2 should be unchanged
    const conv2Windows = get(reasoningWindows).filter(w => w.convId === convId2);
    assert.that(conv2Windows.length === 1, 'Conv2 should have 1 window');
    assert.that(conv2Windows[0].anchorIndex === 2, 'Conv2 window should still be at index 2');
  }
});

// ============================================================================
// deleteAtOrAfterIndex - delete all below tests
// ============================================================================

test({
  id: 'cleanup-delete-at-or-after-index',
  name: 'cleanupReasoningForDeletedMessages: should delete windows at or after specified index',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindows(convId, [0, 1, 2, 3]);

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtOrAfterIndex: 2 });

    const remaining = get(reasoningWindows);
    assert.that(remaining.length === 2, 'Should have 2 windows');
    assert.that(remaining.some(w => w.anchorIndex === 0), 'Window at 0 should remain');
    assert.that(remaining.some(w => w.anchorIndex === 1), 'Window at 1 should remain');
    assert.that(!remaining.some(w => w.anchorIndex === 2), 'Window at 2 should be deleted');
    assert.that(!remaining.some(w => w.anchorIndex === 3), 'Window at 3 should be deleted');
  }
});

test({
  id: 'cleanup-delete-all-from-index-zero',
  name: 'cleanupReasoningForDeletedMessages: should delete all windows when index is 0',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindows(convId, [0, 1, 2]);

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtOrAfterIndex: 0 });

    const remaining = get(reasoningWindows).filter(w => w.convId === convId);
    assert.that(remaining.length === 0, 'All windows for conversation should be deleted');
  }
});

test({
  id: 'cleanup-delete-at-or-after-with-panels',
  name: 'cleanupReasoningForDeletedMessages: deleteAtOrAfter should delete linked panels',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindowsWithPanels(convId, [0, 1, 2, 3]);

    assert.that(get(reasoningPanels).length === 4, 'Setup: should have 4 panels');

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtOrAfterIndex: 2 });

    assert.that(get(reasoningPanels).length === 2, 'Should have 2 panels remaining');
  }
});

// ============================================================================
// Edge cases
// ============================================================================

test({
  id: 'cleanup-empty-store',
  name: 'cleanupReasoningForDeletedMessages: should handle empty store gracefully',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');

    // Should not throw
    let threw = false;
    try {
      cleanupReasoningForDeletedMessages(convId, { deleteAtIndex: 0 });
    } catch (e) {
      threw = true;
    }

    assert.that(!threw, 'Should not throw on empty store');
    assert.that(get(reasoningWindows).length === 0, 'Store should still be empty');
  }
});

test({
  id: 'cleanup-non-existent-conversation',
  name: 'cleanupReasoningForDeletedMessages: should handle non-existent conversation gracefully',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';
    setupTestWindows(convId, [0, 1]);

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages('non-existent-conv', { deleteAtIndex: 0 });

    assert.that(get(reasoningWindows).length === 2, 'Original windows should be unchanged');
  }
});

test({
  id: 'cleanup-window-without-anchor-index',
  name: 'cleanupReasoningForDeletedMessages: should handle windows without anchorIndex',
  fn: (assert) => {
    clearAllReasoning();
    const convId = 'test-conv-1';

    // Create window without anchorIndex
    reasoningWindows.update(windows => [
      ...windows,
      { id: 'test-window', convId, open: true, createdAt: Date.now() } as any
    ]);

    assert.that(get(reasoningWindows).length === 1, 'Setup: should have 1 window');

    const { cleanupReasoningForDeletedMessages } = require('../../stores/reasoningStore.js');
    cleanupReasoningForDeletedMessages(convId, { deleteAtIndex: 0 });

    // Window without anchorIndex should be kept (can't match any specific index)
    assert.that(get(reasoningWindows).length === 1, 'Window without anchorIndex should be kept');
  }
});
