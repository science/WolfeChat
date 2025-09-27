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

// This test verifies that the Reasoning Store layer debug logging works correctly
// by testing the debug logging functions directly and checking that they
// produce the expected debug data structure

registerTest({
  id: 'reasoning-store-debug-logging-window-lifecycle',
  name: 'Reasoning Store debug logging tracks window lifecycle correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test window creation process
    debugLog.reasoning('window_creation_start', {
      convId: 'conv-123',
      model: 'gpt-5-nano',
      anchorIndex: 2,
      timestamp: Date.now()
    }, 'conv-123');

    debugLog.reasoning('window_id_generated', {
      windowId: 'win-123-test',
      convId: 'conv-123',
      model: 'gpt-5-nano',
      pattern: '1234567890-*-win-conv-123'
    }, 'conv-123');

    debugLog.reasoning('window_added_to_store', {
      windowId: 'win-123-test',
      convId: 'conv-123',
      model: 'gpt-5-nano',
      anchorIndex: 2,
      totalWindows: 1,
      newWindow: {
        id: 'win-123-test',
        convId: 'conv-123',
        model: 'gpt-5-nano',
        anchorIndex: 2,
        open: true,
        createdAt: Date.now()
      }
    }, 'conv-123');

    debugLog.reasoning('window_creation_completed', {
      windowId: 'win-123-test',
      convId: 'conv-123',
      model: 'gpt-5-nano',
      anchorIndex: 2,
      success: true
    }, 'conv-123');

    // Test window collapse
    debugLog.reasoning('window_collapse_start', {
      windowId: 'win-123-test',
      timestamp: Date.now()
    });

    debugLog.reasoning('window_marked_collapsed', {
      windowId: 'win-123-test',
      convId: 'conv-123',
      model: 'gpt-5-nano',
      anchorIndex: 2,
      wasOpen: true,
      createdAt: Date.now()
    }, 'conv-123');

    debugLog.reasoning('window_collapse_completed', {
      windowId: 'win-123-test',
      convId: 'conv-123',
      model: 'gpt-5-nano',
      anchorIndex: 2,
      wasOpen: true,
      success: true
    }, 'conv-123');

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data should exist');
    t.that(debugData.layers.reasoning.length === 7, 'Reasoning should have 7 window lifecycle events');

    // Verify window creation events
    const windowCreationStart = debugData.layers.reasoning.find(e => e.event === 'window_creation_start');
    t.that(!!windowCreationStart, 'Should have window creation start event');
    t.that(windowCreationStart!.data.convId === 'conv-123', 'Window creation should have conversation ID');
    t.that(windowCreationStart!.data.model === 'gpt-5-nano', 'Window creation should have model');

    const windowIdGenerated = debugData.layers.reasoning.find(e => e.event === 'window_id_generated');
    t.that(!!windowIdGenerated, 'Should have window ID generated event');
    t.that(windowIdGenerated!.data.windowId === 'win-123-test', 'Window ID generated should have window ID');

    const windowAddedToStore = debugData.layers.reasoning.find(e => e.event === 'window_added_to_store');
    t.that(!!windowAddedToStore, 'Should have window added to store event');
    t.that(windowAddedToStore!.data.totalWindows === 1, 'Window added should track total windows');

    const windowCreationCompleted = debugData.layers.reasoning.find(e => e.event === 'window_creation_completed');
    t.that(!!windowCreationCompleted, 'Should have window creation completed event');
    t.that(windowCreationCompleted!.data.success === true, 'Window creation should indicate success');

    // Verify window collapse events
    const windowCollapseStart = debugData.layers.reasoning.find(e => e.event === 'window_collapse_start');
    t.that(!!windowCollapseStart, 'Should have window collapse start event');

    const windowMarkedCollapsed = debugData.layers.reasoning.find(e => e.event === 'window_marked_collapsed');
    t.that(!!windowMarkedCollapsed, 'Should have window marked collapsed event');
    t.that(windowMarkedCollapsed!.data.wasOpen === true, 'Window collapse should track previous open state');

    const windowCollapseCompleted = debugData.layers.reasoning.find(e => e.event === 'window_collapse_completed');
    t.that(!!windowCollapseCompleted, 'Should have window collapse completed event');
    t.that(windowCollapseCompleted!.data.success === true, 'Window collapse should indicate success');

    // Verify all events have proper metadata
    debugData.layers.reasoning.forEach(event => {
      t.that(event.layer === 'reasoning', 'All events should be from reasoning layer');
      t.that(typeof event.timestamp === 'number', 'All events should have timestamp');
      t.that(typeof event.sequenceId === 'number', 'All events should have sequence ID');
      t.that(Array.isArray(event.callStack), 'All events should have call stack');
    });
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-panel-lifecycle',
  name: 'Reasoning Store debug logging tracks panel lifecycle correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test panel creation process
    debugLog.reasoning('panel_creation_start', {
      kind: 'summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      timestamp: Date.now()
    }, 'conv-456', 'resp-789');

    debugLog.reasoning('panel_id_generated', {
      panelId: 'panel-456-summary',
      kind: 'summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      pattern: '1234567890-*-summary-conv-456'
    }, 'conv-456', 'resp-789');

    debugLog.reasoning('panel_added_to_store', {
      panelId: 'panel-456-summary',
      kind: 'summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      totalPanels: 1,
      panelsForConv: 1,
      newPanel: {
        id: 'panel-456-summary',
        convId: 'conv-456',
        responseId: 'resp-789',
        kind: 'summary',
        text: '',
        open: true,
        startedAt: Date.now(),
        done: false
      }
    }, 'conv-456', 'resp-789');

    debugLog.reasoning('panel_creation_completed', {
      panelId: 'panel-456-summary',
      kind: 'summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      success: true
    }, 'conv-456', 'resp-789');

    // Test text content updates
    debugLog.reasoning('text_update_start', {
      panelId: 'panel-456-summary',
      textLength: 25,
      textSnippet: 'This is reasoning content',
      timestamp: Date.now()
    });

    debugLog.reasoning('text_content_updated', {
      panelId: 'panel-456-summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      kind: 'summary',
      beforeTextLength: 0,
      afterTextLength: 25,
      textChanged: true,
      panelOpen: true,
      panelDone: false,
      textSnippet: 'This is reasoning content'
    }, 'conv-456', 'resp-789');

    debugLog.reasoning('text_update_completed', {
      panelId: 'panel-456-summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      kind: 'summary',
      done: false,
      open: true,
      beforeTextLength: 0,
      afterTextLength: 25,
      success: true
    }, 'conv-456', 'resp-789');

    // Test panel completion
    debugLog.reasoning('panel_completion_start', {
      panelId: 'panel-456-summary',
      timestamp: Date.now()
    });

    debugLog.reasoning('panel_marked_complete', {
      panelId: 'panel-456-summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      kind: 'summary',
      textLength: 25,
      wasOpen: true,
      wasDone: false,
      finalTextSnippet: 'This is reasoning content'
    }, 'conv-456', 'resp-789');

    debugLog.reasoning('panel_completion_completed', {
      panelId: 'panel-456-summary',
      convId: 'conv-456',
      responseId: 'resp-789',
      kind: 'summary',
      textLength: 25,
      wasOpen: true,
      wasDone: false,
      success: true
    }, 'conv-456', 'resp-789');

    const debugData = getDebugData();
    t.that(debugData.layers.reasoning.length === 10, 'Should have 10 panel lifecycle events');

    // Verify panel creation events
    const panelCreationStart = debugData.layers.reasoning.find(e => e.event === 'panel_creation_start');
    t.that(!!panelCreationStart, 'Should have panel creation start event');
    t.that(panelCreationStart!.data.kind === 'summary', 'Panel creation should have kind');
    t.that(panelCreationStart!.responseId === 'resp-789', 'Panel creation should have response ID');

    const panelIdGenerated = debugData.layers.reasoning.find(e => e.event === 'panel_id_generated');
    t.that(!!panelIdGenerated, 'Should have panel ID generated event');
    t.that(panelIdGenerated!.data.panelId === 'panel-456-summary', 'Panel ID generated should have panel ID');

    const panelAddedToStore = debugData.layers.reasoning.find(e => e.event === 'panel_added_to_store');
    t.that(!!panelAddedToStore, 'Should have panel added to store event');
    t.that(panelAddedToStore!.data.totalPanels === 1, 'Panel added should track total panels');
    t.that(panelAddedToStore!.data.panelsForConv === 1, 'Panel added should track panels for conversation');

    // Verify text update events
    const textUpdateStart = debugData.layers.reasoning.find(e => e.event === 'text_update_start');
    t.that(!!textUpdateStart, 'Should have text update start event');
    t.that(textUpdateStart!.data.textLength === 25, 'Text update should track content length');

    const textContentUpdated = debugData.layers.reasoning.find(e => e.event === 'text_content_updated');
    t.that(!!textContentUpdated, 'Should have text content updated event');
    t.that(textContentUpdated!.data.textChanged === true, 'Text content updated should track change');
    t.that(textContentUpdated!.data.afterTextLength === 25, 'Text content updated should track new length');

    // Verify panel completion events
    const panelMarkedComplete = debugData.layers.reasoning.find(e => e.event === 'panel_marked_complete');
    t.that(!!panelMarkedComplete, 'Should have panel marked complete event');
    t.that(panelMarkedComplete!.data.wasOpen === true, 'Panel completion should track previous open state');
    t.that(panelMarkedComplete!.data.wasDone === false, 'Panel completion should track previous done state');

    const panelCompletionCompleted = debugData.layers.reasoning.find(e => e.event === 'panel_completion_completed');
    t.that(!!panelCompletionCompleted, 'Should have panel completion completed event');
    t.that(panelCompletionCompleted!.data.success === true, 'Panel completion should indicate success');
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-sse-events',
  name: 'Reasoning Store debug logging tracks SSE events correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test SSE event logging
    debugLog.reasoning('sse_event_logged', {
      eventType: 'response.reasoning_summary.delta',
      convId: 'conv-sse',
      timestamp: Date.now(),
      hasData: true,
      dataKeys: ['delta', 'part']
    }, 'conv-sse');

    debugLog.reasoning('sse_event_added_to_store', {
      eventId: 'evt-123-sse',
      eventType: 'response.reasoning_summary.delta',
      convId: 'conv-sse',
      totalEvents: 1,
      eventsForConv: 1,
      wasTruncated: false
    }, 'conv-sse');

    debugLog.reasoning('sse_event_logged', {
      eventType: 'response.reasoning_text.done',
      convId: 'conv-sse',
      timestamp: Date.now(),
      hasData: true,
      dataKeys: ['text']
    }, 'conv-sse');

    debugLog.reasoning('sse_event_added_to_store', {
      eventId: 'evt-456-sse',
      eventType: 'response.reasoning_text.done',
      convId: 'conv-sse',
      totalEvents: 2,
      eventsForConv: 2,
      wasTruncated: false
    }, 'conv-sse');

    const debugData = getDebugData();
    t.that(debugData.layers.reasoning.length === 4, 'Should have 4 SSE event tracking events');

    // Verify SSE event logging
    const sseEventLogged = debugData.layers.reasoning.filter(e => e.event === 'sse_event_logged');
    t.that(sseEventLogged.length === 2, 'Should have 2 SSE event logged events');
    t.that(sseEventLogged[0].data.eventType === 'response.reasoning_summary.delta', 'First SSE event should be summary delta');
    t.that(sseEventLogged[1].data.eventType === 'response.reasoning_text.done', 'Second SSE event should be text done');

    const sseEventAddedToStore = debugData.layers.reasoning.filter(e => e.event === 'sse_event_added_to_store');
    t.that(sseEventAddedToStore.length === 2, 'Should have 2 SSE event added to store events');
    t.that(sseEventAddedToStore[0].data.totalEvents === 1, 'First SSE event should show 1 total event');
    t.that(sseEventAddedToStore[1].data.totalEvents === 2, 'Second SSE event should show 2 total events');
    t.that(sseEventAddedToStore[1].data.eventsForConv === 2, 'Should track events per conversation');
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-disabled',
  name: 'Reasoning Store debug logging is disabled when debug mode is off',
  fn: (t) => {
    mockDebugMode(false);
    resetDebugData();

    // Try to log events when debug mode is disabled
    debugLog.reasoning('window_creation_start', { test: 'data' }, 'conv-123');
    debugLog.reasoning('panel_creation_start', { test: 'data' }, 'conv-123');

    const debugData = getDebugData();
    t.that(!debugData, 'Debug data should not exist when debug mode is disabled');
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-conversation-tracking',
  name: 'Reasoning Store debug logging tracks conversation context correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test events for multiple conversations
    debugLog.reasoning('window_creation_start', { convId: 'conv-1', model: 'gpt-5-nano' }, 'conv-1');
    debugLog.reasoning('panel_creation_start', { kind: 'summary', convId: 'conv-1' }, 'conv-1', 'resp-1');
    debugLog.reasoning('window_creation_start', { convId: 'conv-2', model: 'gpt-4o' }, 'conv-2');
    debugLog.reasoning('panel_creation_start', { kind: 'text', convId: 'conv-2' }, 'conv-2', 'resp-2');
    debugLog.reasoning('panel_completion_completed', { panelId: 'panel-1', success: true }, 'conv-1', 'resp-1');

    const debugData = getDebugData();
    t.that(debugData.layers.reasoning.length === 5, 'Should have 5 events total');

    // Test conversation filtering
    const conv1Events = debugData.timeline.filter(e => e.conversationId === 'conv-1');
    const conv2Events = debugData.timeline.filter(e => e.conversationId === 'conv-2');

    t.that(conv1Events.length === 3, 'Should have 3 events for conv-1');
    t.that(conv2Events.length === 2, 'Should have 2 events for conv-2');

    t.that(conv1Events.every(e => e.conversationId === 'conv-1'), 'All conv-1 events should have correct conversation ID');
    t.that(conv2Events.every(e => e.conversationId === 'conv-2'), 'All conv-2 events should have correct conversation ID');

    // Test response ID filtering
    const resp1Events = debugData.timeline.filter(e => e.responseId === 'resp-1');
    const resp2Events = debugData.timeline.filter(e => e.responseId === 'resp-2');

    t.that(resp1Events.length === 2, 'Should have 2 events for resp-1');
    t.that(resp2Events.length === 1, 'Should have 1 event for resp-2');
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-error-handling',
  name: 'Reasoning Store debug logging handles error cases correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test panel not found scenarios
    debugLog.reasoning('text_update_panel_not_found', {
      panelId: 'nonexistent-panel',
      textLength: 15,
      allPanelIds: []
    });

    debugLog.reasoning('panel_completion_not_found', {
      panelId: 'another-nonexistent-panel'
    });

    debugLog.reasoning('window_collapse_not_found', {
      windowId: 'nonexistent-window'
    });

    const debugData = getDebugData();
    t.that(debugData.layers.reasoning.length === 3, 'Should have 3 error events');

    const textUpdateNotFound = debugData.layers.reasoning.find(e => e.event === 'text_update_panel_not_found');
    t.that(!!textUpdateNotFound, 'Should have text update panel not found event');
    t.that(textUpdateNotFound!.data.panelId === 'nonexistent-panel', 'Text update not found should have panel ID');

    const panelCompletionNotFound = debugData.layers.reasoning.find(e => e.event === 'panel_completion_not_found');
    t.that(!!panelCompletionNotFound, 'Should have panel completion not found event');
    t.that(panelCompletionNotFound!.data.panelId === 'another-nonexistent-panel', 'Panel completion not found should have panel ID');

    const windowCollapseNotFound = debugData.layers.reasoning.find(e => e.event === 'window_collapse_not_found');
    t.that(!!windowCollapseNotFound, 'Should have window collapse not found event');
    t.that(windowCollapseNotFound!.data.windowId === 'nonexistent-window', 'Window collapse not found should have window ID');
  }
});

registerTest({
  id: 'reasoning-store-debug-logging-panel-kinds',
  name: 'Reasoning Store debug logging handles different panel kinds correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test summary panel
    debugLog.reasoning('panel_creation_completed', {
      panelId: 'panel-summary',
      kind: 'summary',
      convId: 'conv-test',
      responseId: 'resp-test',
      success: true
    }, 'conv-test', 'resp-test');

    // Test text panel
    debugLog.reasoning('panel_creation_completed', {
      panelId: 'panel-text',
      kind: 'text',
      convId: 'conv-test',
      responseId: 'resp-test',
      success: true
    }, 'conv-test', 'resp-test');

    const debugData = getDebugData();
    const events = debugData.layers.reasoning;

    const summaryPanel = events.find(e => e.data.kind === 'summary');
    const textPanel = events.find(e => e.data.kind === 'text');

    t.that(!!summaryPanel, 'Should have summary panel event');
    t.that(!!textPanel, 'Should have text panel event');
    t.that(summaryPanel!.data.panelId === 'panel-summary', 'Summary panel should have correct ID');
    t.that(textPanel!.data.panelId === 'panel-text', 'Text panel should have correct ID');
  }
});