import { registerTest } from '../testHarness.js';
import {
  debugLog,
  getDebugData,
  resetDebugData,
  isDebugMode
} from '../../utils/debugLayerLogger.js';

// Mock debug mode for testing
function mockDebugMode(enabled: boolean) {
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG_E2E = enabled ? 2 : undefined;
  }
}

// This test verifies that the Store Update layer debug logging works correctly
// by testing the debug logging functions directly and checking that they
// produce the expected debug data structure

registerTest({
  id: 'store-updates-debug-logging-direct',
  name: 'Store Updates debug logging functions work correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test setHistory call logging
    debugLog.storeUpdates('setHistory_called', {
      convId: 0,
      conversationUniqueId: 'conv-123',
      incomingHistoryLength: 2,
      incomingMessages: [
        { role: 'user', contentLength: 12, hasModel: false },
        { role: 'assistant', contentLength: 20, hasModel: true }
      ],
      totalConversations: 1
    }, 'conv-123');

    // Test conversation state before
    debugLog.storeUpdates('conversation_state_before', {
      convId: 0,
      conversationExists: true,
      currentHistoryLength: 1,
      conversationTitle: 'Test Chat',
      conversationId: 'conv-123'
    }, 'conv-123');

    // Test conversation state after
    debugLog.storeUpdates('conversation_state_after', {
      convId: 0,
      newHistoryLength: 2,
      conversationTitle: 'Test Chat',
      conversationId: 'conv-123',
      lastMessage: {
        role: 'assistant',
        contentLength: 20
      }
    }, 'conv-123');

    // Test conversations store set
    debugLog.storeUpdates('conversations_store_set', {
      convId: 0,
      totalConversations: 1,
      targetConversationHistoryLength: 2,
      storeUpdateTimestamp: performance.now()
    }, 'conv-123');

    // Test setHistory completed
    debugLog.storeUpdates('setHistory_completed', {
      convId: 0,
      conversationUniqueId: 'conv-123',
      finalHistoryLength: 2,
      success: true
    }, 'conv-123');

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data should exist');
    t.that(debugData.layers.storeUpdates.length === 5, 'Store updates should have 5 events');

    // Verify event data structure
    const events = debugData.layers.storeUpdates;

    // Check setHistory_called event
    const setHistoryCalledEvent = events.find(e => e.event === 'setHistory_called');
    t.that(!!setHistoryCalledEvent, 'Should have setHistory_called event');
    t.that(setHistoryCalledEvent!.conversationId === 'conv-123', 'SetHistory called event should have conversation ID');
    t.that(setHistoryCalledEvent!.data.convId === 0, 'SetHistory called event should have numeric convId');
    t.that(setHistoryCalledEvent!.data.conversationUniqueId === 'conv-123', 'SetHistory called event should have unique conversation ID');
    t.that(setHistoryCalledEvent!.data.incomingHistoryLength === 2, 'SetHistory called event should have incoming history length');
    t.that(Array.isArray(setHistoryCalledEvent!.data.incomingMessages), 'SetHistory called event should have incoming messages array');
    t.that(setHistoryCalledEvent!.data.incomingMessages.length === 2, 'SetHistory called event should have 2 incoming messages');

    // Check conversation_state_before event
    const stateBeforeEvent = events.find(e => e.event === 'conversation_state_before');
    t.that(!!stateBeforeEvent, 'Should have conversation_state_before event');
    t.that(stateBeforeEvent!.data.conversationExists === true, 'State before event should indicate conversation exists');
    t.that(stateBeforeEvent!.data.currentHistoryLength === 1, 'State before event should have current history length');
    t.that(stateBeforeEvent!.data.conversationTitle === 'Test Chat', 'State before event should have conversation title');

    // Check conversation_state_after event
    const stateAfterEvent = events.find(e => e.event === 'conversation_state_after');
    t.that(!!stateAfterEvent, 'Should have conversation_state_after event');
    t.that(stateAfterEvent!.data.newHistoryLength === 2, 'State after event should have new history length');
    t.that(!!stateAfterEvent!.data.lastMessage, 'State after event should have last message details');
    t.that(stateAfterEvent!.data.lastMessage.role === 'assistant', 'State after event last message should have correct role');

    // Check conversations_store_set event
    const storeSetEvent = events.find(e => e.event === 'conversations_store_set');
    t.that(!!storeSetEvent, 'Should have conversations_store_set event');
    t.that(storeSetEvent!.data.totalConversations === 1, 'Store set event should have total conversations count');
    t.that(storeSetEvent!.data.targetConversationHistoryLength === 2, 'Store set event should have target history length');
    t.that(typeof storeSetEvent!.data.storeUpdateTimestamp === 'number', 'Store set event should have timestamp');

    // Check setHistory_completed event
    const setHistoryCompletedEvent = events.find(e => e.event === 'setHistory_completed');
    t.that(!!setHistoryCompletedEvent, 'Should have setHistory_completed event');
    t.that(setHistoryCompletedEvent!.data.success === true, 'SetHistory completed event should indicate success');
    t.that(setHistoryCompletedEvent!.data.finalHistoryLength === 2, 'SetHistory completed event should have final history length');

    // Verify all events have proper metadata
    events.forEach(event => {
      t.that(event.layer === 'storeUpdates', 'All events should be from storeUpdates layer');
      t.that(typeof event.timestamp === 'number', 'All events should have timestamp');
      t.that(typeof event.sequenceId === 'number', 'All events should have sequence ID');
      t.that(Array.isArray(event.callStack), 'All events should have call stack');
    });

    // Verify timeline contains all events
    t.that(debugData.timeline.length === 5, 'Timeline should have all 5 events');
    const storeUpdateEventsInTimeline = debugData.timeline.filter(e => e.layer === 'storeUpdates');
    t.that(storeUpdateEventsInTimeline.length === 5, 'Timeline should have all store update events');
  }
});

registerTest({
  id: 'store-updates-debug-logging-disabled',
  name: 'Store Updates debug logging is disabled when debug mode is off',
  fn: (t) => {
    mockDebugMode(false);
    resetDebugData();

    // Try to log events when debug mode is disabled
    debugLog.storeUpdates('setHistory_called', { test: 'data' }, 'conv-123');
    debugLog.storeUpdates('conversation_state_before', { test: 'data' }, 'conv-123');

    const debugData = getDebugData();
    t.that(!debugData, 'Debug data should not exist when debug mode is disabled');
  }
});

registerTest({
  id: 'store-updates-debug-logging-error-handling',
  name: 'Store Updates debug logging handles errors correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test error logging
    debugLog.storeUpdates('setHistory_error', {
      convId: 0,
      error: 'Conversation not found',
      errorMessage: 'Conversation with ID 0 does not exist',
      messageCount: 2
    }, 'conv-invalid');

    const debugData = getDebugData();
    t.that(debugData.layers.storeUpdates.length === 1, 'Should have 1 error event');

    const errorEvent = debugData.layers.storeUpdates[0];
    t.that(errorEvent.event === 'setHistory_error', 'Should have setHistory_error event');
    t.that(errorEvent.data.error === 'Conversation not found', 'Error event should have error string');
    t.that(errorEvent.data.errorMessage === 'Conversation with ID 0 does not exist', 'Error event should have error message');
    t.that(errorEvent.data.messageCount === 2, 'Error event should have message count');
  }
});

registerTest({
  id: 'store-updates-debug-logging-conversation-tracking',
  name: 'Store Updates debug logging tracks conversation context correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test events for multiple conversations
    debugLog.storeUpdates('setHistory_called', { convId: 0, conversationUniqueId: 'conv-1' }, 'conv-1');
    debugLog.storeUpdates('conversation_state_before', { convId: 0, currentHistoryLength: 1 }, 'conv-1');
    debugLog.storeUpdates('setHistory_called', { convId: 1, conversationUniqueId: 'conv-2' }, 'conv-2');
    debugLog.storeUpdates('conversation_state_before', { convId: 1, currentHistoryLength: 0 }, 'conv-2');
    debugLog.storeUpdates('setHistory_completed', { convId: 0, success: true }, 'conv-1');

    const debugData = getDebugData();
    t.that(debugData.layers.storeUpdates.length === 5, 'Should have 5 events total');

    // Test conversation filtering
    const conv1Events = debugData.timeline.filter(e => e.conversationId === 'conv-1');
    const conv2Events = debugData.timeline.filter(e => e.conversationId === 'conv-2');

    t.that(conv1Events.length === 3, 'Should have 3 events for conv-1');
    t.that(conv2Events.length === 2, 'Should have 2 events for conv-2');

    t.that(conv1Events.every(e => e.conversationId === 'conv-1'), 'All conv-1 events should have correct conversation ID');
    t.that(conv2Events.every(e => e.conversationId === 'conv-2'), 'All conv-2 events should have correct conversation ID');
  }
});

registerTest({
  id: 'store-updates-debug-logging-message-details',
  name: 'Store Updates debug logging captures message details correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test with complex message structures
    debugLog.storeUpdates('setHistory_called', {
      convId: 0,
      conversationUniqueId: 'conv-complex',
      incomingHistoryLength: 3,
      incomingMessages: [
        { role: 'user', contentLength: 15, hasModel: false },
        { role: 'assistant', contentLength: 50, hasModel: true },
        { role: 'user', contentLength: 8, hasModel: false }
      ],
      totalConversations: 2
    }, 'conv-complex');

    debugLog.storeUpdates('conversation_state_after', {
      convId: 0,
      newHistoryLength: 3,
      conversationTitle: 'Complex Test',
      conversationId: 'conv-complex',
      lastMessage: {
        role: 'user',
        contentLength: 8
      }
    }, 'conv-complex');

    const debugData = getDebugData();
    const events = debugData.layers.storeUpdates;

    // Check message details in setHistory_called
    const setHistoryEvent = events.find(e => e.event === 'setHistory_called');
    t.that(!!setHistoryEvent, 'Should have setHistory_called event');
    t.that(setHistoryEvent!.data.incomingMessages.length === 3, 'Should have 3 incoming messages');

    const messages = setHistoryEvent!.data.incomingMessages;
    t.that(messages[0].role === 'user', 'First message should be user');
    t.that(messages[0].hasModel === false, 'First message should not have model');
    t.that(messages[1].role === 'assistant', 'Second message should be assistant');
    t.that(messages[1].hasModel === true, 'Second message should have model');
    t.that(messages[1].contentLength === 50, 'Second message should have correct content length');

    // Check last message details in conversation_state_after
    const stateAfterEvent = events.find(e => e.event === 'conversation_state_after');
    t.that(!!stateAfterEvent, 'Should have conversation_state_after event');
    t.that(stateAfterEvent!.data.lastMessage.role === 'user', 'Last message should be user');
    t.that(stateAfterEvent!.data.lastMessage.contentLength === 8, 'Last message should have correct content length');
  }
});