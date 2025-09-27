import { test } from '../testHarness.js';
import { createReasoningWindow, reasoningWindows, clearAllReasoning } from '../../stores/reasoningStore.js';
import { conversations } from '../../stores/stores.js';
import { get } from 'svelte/store';

test({
  id: 'hello-world-test',
  name: 'Hello World Test - Verify test infrastructure works',
  fn: (assert) => {
    assert.that(true === true, 'Basic assertion should pass');
    assert.that(2 + 2 === 4, 'Math should work');
  }
});

test({
  id: 'reasoning-window-undefined-conversation-id',
  name: 'Reasoning windows should handle undefined conversation ID properly',
  fn: (assert) => {
    // Clear any existing reasoning data
    clearAllReasoning();

    // Create reasoning window with undefined conversation ID (the bug condition)
    const windowId = createReasoningWindow(undefined, 'gpt-5-nano', 0);

    // Get the created window
    const windows = get(reasoningWindows);
    const createdWindow = windows.find(w => w.id === windowId);

    // CURRENT BEHAVIOR: Window is created with undefined convId
    assert.that(createdWindow !== undefined, 'Reasoning window should be created');
    assert.that(createdWindow.convId === undefined, 'Window currently has undefined convId (demonstrating the bug)');

    // DESIRED BEHAVIOR: When this bug is fixed, the window should either:
    // 1. Have a fallback conversation ID, or
    // 2. The UI should handle undefined gracefully
    // For now, we document the current broken behavior
  }
});

test({
  id: 'reasoning-window-ui-id-mismatch',
  name: 'UI cannot find reasoning windows when conversation IDs mismatch',
  fn: (assert) => {
    clearAllReasoning();

    // Create window with undefined ID (simulates the bug)
    const windowId = createReasoningWindow(undefined, 'gpt-5-nano', 0);

    // UI tries to find windows for a specific conversation
    const targetConvId = 'test-conv-123';
    const windows = get(reasoningWindows);
    const windowsForAnchor = windows.filter(
      (w) => w.convId === targetConvId && w.anchorIndex === 0
    );

    // BUG DEMONSTRATION: UI finds no windows because undefined !== 'test-conv-123'
    assert.that(windowsForAnchor.length === 0, 'UI cannot find window due to ID mismatch');

    // But window exists in store
    const allWindows = get(reasoningWindows);
    assert.that(allWindows.length === 1, 'Window exists in store but is unreachable by UI');
  }
});

test({
  id: 'conversation-id-lookup-race-condition',
  name: 'Demonstrates root cause: numeric index to string ID lookup fails',
  fn: (assert) => {
    // Setup: Clear conversations and add a single conversation
    conversations.set([{
      id: 'conv-abc-123',
      history: [],
      conversationTokens: 0,
      assistantRole: 'Test assistant',
      title: 'Test Conversation'
    }]);

    // WORKING CASE: Valid index lookup
    const validIndex = 0;
    const validLookup = get(conversations)[validIndex]?.id;
    assert.that(validLookup === 'conv-abc-123', 'Valid index should return string ID');

    // BUG CASE: Invalid index lookup (race condition scenario)
    const invalidIndex = 1; // Index doesn't exist
    const invalidLookup = get(conversations)[invalidIndex]?.id;
    assert.that(invalidLookup === undefined, 'Invalid index should return undefined');

    // This is what causes createReasoningWindow to receive undefined
    // In the real app: get(conversations)[convId]?.id where convId might be stale/invalid
    assert.that(typeof invalidLookup === 'undefined', 'Undefined lookup demonstrates the race condition');
  }
});