import { registerTest } from '../testHarness.js';
import {
  isDebugMode,
  initializeDebugStructure,
  getTimestamp,
  captureCallStack,
  logDebugEvent,
  debugLog,
  getDebugData,
  getTimelineForConversation,
  getEventsForResponseId,
  findMissingEvents,
  analyzeEventTiming,
  dumpDebugData,
  resetDebugData
} from '../../utils/debugLayerLogger.js';

// Mock window.DEBUG_E2E for testing
function mockDebugMode(enabled: boolean) {
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG_E2E = enabled ? 2 : undefined;
  }
}

function mockWindowUndefined() {
  // @ts-ignore - Temporarily mock window as undefined
  const originalWindow = globalThis.window;
  // @ts-ignore
  delete globalThis.window;
  return () => { globalThis.window = originalWindow; };
}

registerTest({
  id: 'debug-layer-logger-debug-mode-detection',
  name: 'isDebugMode correctly detects debug state',
  fn: (t) => {
    // Test debug mode disabled
    mockDebugMode(false);
    t.that(!isDebugMode(), 'Debug mode should be disabled when window.__DEBUG_E2E is not 2');

    // Test debug mode enabled
    mockDebugMode(true);
    t.that(isDebugMode(), 'Debug mode should be enabled when window.__DEBUG_E2E is 2');

    // Test when window is undefined (SSR scenario)
    const restoreWindow = mockWindowUndefined();
    t.that(!isDebugMode(), 'Debug mode should be disabled when window is undefined');
    restoreWindow();
  }
});

registerTest({
  id: 'debug-layer-logger-no-logging-when-disabled',
  name: 'Logging functions are no-ops when debug mode is disabled',
  fn: (t) => {
    mockDebugMode(false);

    // Clear any existing debug data
    if (typeof window !== 'undefined') {
      (window as any).__testDebugData = undefined;
    }

    // Test logging functions don't create data when disabled
    debugLog.sseParser('test_event', { test: 'data' }, 'conv-1', 'resp-1');
    debugLog.messageAssembly('test_event', { test: 'data' });
    logDebugEvent('storeUpdates', 'test_event', { test: 'data' });

    t.that(!getDebugData(), 'No debug data should be created when debug mode is disabled');
  }
});

registerTest({
  id: 'debug-layer-logger-structure-initialization',
  name: 'Debug structure initialization works correctly',
  fn: (t) => {
    mockDebugMode(true);

    // Clear any existing debug data
    if (typeof window !== 'undefined') {
      (window as any).__testDebugData = undefined;
    }

    // Test initialization
    initializeDebugStructure();

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data structure should be created');
    t.that(!!debugData?.layers, 'Layers object should be created');
    t.that(Array.isArray(debugData?.layers.sseParser), 'sseParser layer should be an array');
    t.that(Array.isArray(debugData?.layers.messageAssembly), 'messageAssembly layer should be an array');
    t.that(Array.isArray(debugData?.layers.storeUpdates), 'storeUpdates layer should be an array');
    t.that(Array.isArray(debugData?.layers.reactivity), 'reactivity layer should be an array');
    t.that(Array.isArray(debugData?.layers.domRender), 'domRender layer should be an array');
    t.that(Array.isArray(debugData?.layers.reasoning), 'reasoning layer should be an array');
    t.that(Array.isArray(debugData?.timeline), 'Timeline should be an array');
    t.that(debugData?.conversationContext instanceof Map, 'Conversation context should be a Map');
  }
});

registerTest({
  id: 'debug-layer-logger-logging-functionality',
  name: 'Logging functions work correctly when debug mode is enabled',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test basic logging
    debugLog.sseParser('sse_event_received', { eventType: 'response.output_text.delta' }, 'conv-1', 'resp-1');
    debugLog.messageAssembly('message_created', { role: 'assistant', content: 'test' }, 'conv-1');
    debugLog.storeUpdates('setHistory_called', { convIndex: 0, historyLength: 2 });

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data should exist');
    t.that(debugData.layers.sseParser.length === 1, 'SSE parser should have 1 event');
    t.that(debugData.layers.messageAssembly.length === 1, 'Message assembly should have 1 event');
    t.that(debugData.layers.storeUpdates.length === 1, 'Store updates should have 1 event');
    t.that(debugData.timeline.length === 3, 'Timeline should have 3 events total');

    // Verify event structure
    const sseEvent = debugData.layers.sseParser[0];
    t.that(sseEvent.layer === 'sseParser', 'Event should have correct layer');
    t.that(sseEvent.event === 'sse_event_received', 'Event should have correct event name');
    t.that(sseEvent.conversationId === 'conv-1', 'Event should have conversation ID');
    t.that(sseEvent.responseId === 'resp-1', 'Event should have response ID');
    t.that(typeof sseEvent.timestamp === 'number', 'Event should have timestamp');
    t.that(typeof sseEvent.sequenceId === 'number', 'Event should have sequence ID');
    t.that(Array.isArray(sseEvent.callStack), 'Event should have call stack');
  }
});

registerTest({
  id: 'debug-layer-logger-timeline-filtering',
  name: 'Timeline filtering functions work correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Create test events
    debugLog.sseParser('event1', { data: 1 }, 'conv-1', 'resp-1');
    debugLog.messageAssembly('event2', { data: 2 }, 'conv-1', 'resp-1');
    debugLog.storeUpdates('event3', { data: 3 }, 'conv-2', 'resp-2');
    debugLog.reactivity('event4', { data: 4 }, 'conv-1', 'resp-2');

    // Test conversation filtering
    const conv1Events = getTimelineForConversation('conv-1');
    t.that(conv1Events.length === 3, 'Should find 3 events for conv-1');
    t.that(conv1Events.every(e => e.conversationId === 'conv-1'), 'All events should be for conv-1');

    const conv2Events = getTimelineForConversation('conv-2');
    t.that(conv2Events.length === 1, 'Should find 1 event for conv-2');

    // Test response ID filtering
    const resp1Events = getEventsForResponseId('resp-1');
    t.that(resp1Events.length === 2, 'Should find 2 events for resp-1');
    t.that(resp1Events.every(e => e.responseId === 'resp-1'), 'All events should be for resp-1');

    const resp2Events = getEventsForResponseId('resp-2');
    t.that(resp2Events.length === 2, 'Should find 2 events for resp-2');
  }
});

registerTest({
  id: 'debug-layer-logger-missing-events-analysis',
  name: 'Missing events analysis works correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Create some events but not all expected ones
    debugLog.sseParser('response.created', { id: 'resp-1' });
    debugLog.sseParser('response.output_text.delta', { delta: 'hello' });
    // Missing 'response.completed'

    debugLog.messageAssembly('message_created', { role: 'assistant' });
    // Missing 'content_accumulated' and 'setHistory_called'

    const missing = findMissingEvents();
    t.that(missing.length === 2, 'Should find 2 layers with missing events');

    const sseMissing = missing.find(m => m.layer === 'sseParser');
    t.that(!!sseMissing, 'Should find missing SSE events');
    t.that(sseMissing!.expectedEvents.includes('response.completed'), 'Should identify missing response.completed');

    const assemblyMissing = missing.find(m => m.layer === 'messageAssembly');
    t.that(!!assemblyMissing, 'Should find missing assembly events');
    t.that(assemblyMissing!.expectedEvents.includes('content_accumulated'), 'Should identify missing content_accumulated');
    t.that(assemblyMissing!.expectedEvents.includes('setHistory_called'), 'Should identify missing setHistory_called');
  }
});

registerTest({
  id: 'debug-layer-logger-timing-analysis',
  name: 'Event timing analysis works correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Get initial timestamp
    const baseTime = getTimestamp();

    // Manually create events with controlled timing
    const debugData = getDebugData()!;

    // Create a normal sequence
    debugData.timeline.push({
      timestamp: baseTime,
      layer: 'sseParser',
      event: 'event1',
      data: {},
      callStack: [],
      sequenceId: 1
    });

    // Create a rapid sequence (< 1ms gap)
    debugData.timeline.push({
      timestamp: baseTime + 0.5,
      layer: 'messageAssembly',
      event: 'event2',
      data: {},
      callStack: [],
      sequenceId: 2
    });

    // Create a large gap (> 100ms)
    debugData.timeline.push({
      timestamp: baseTime + 150,
      layer: 'storeUpdates',
      event: 'event3',
      data: {},
      callStack: [],
      sequenceId: 3
    });

    const timing = analyzeEventTiming();
    t.that(timing.rapidSequences.length === 1, 'Should find 1 rapid sequence');
    t.that(timing.rapidSequences[0].gap < 1, 'Rapid sequence gap should be < 1ms');

    t.that(timing.gaps.length === 1, 'Should find 1 large gap');
    t.that(timing.gaps[0].gap > 100, 'Large gap should be > 100ms');
  }
});

registerTest({
  id: 'debug-layer-logger-reset-functionality',
  name: 'Reset functionality clears all debug data',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Add some data
    debugLog.sseParser('test_event', { data: 'test' }, 'conv-1');
    debugLog.messageAssembly('test_event', { data: 'test' }, 'conv-1');

    let debugData = getDebugData();
    t.that(debugData!.timeline.length > 0, 'Should have events before reset');

    // Reset and verify
    resetDebugData();
    debugData = getDebugData();

    t.that(debugData!.timeline.length === 0, 'Timeline should be empty after reset');
    t.that(debugData!.layers.sseParser.length === 0, 'SSE parser layer should be empty after reset');
    t.that(debugData!.layers.messageAssembly.length === 0, 'Message assembly layer should be empty after reset');
    t.that(debugData!.conversationContext.size === 0, 'Conversation context should be empty after reset');
  }
});

registerTest({
  id: 'debug-layer-logger-utility-functions',
  name: 'Utility functions work correctly',
  fn: (t) => {
    // Test timestamp function
    const timestamp1 = getTimestamp();
    const timestamp2 = getTimestamp();
    t.that(timestamp2 >= timestamp1, 'Timestamps should be monotonic');
    t.that(typeof timestamp1 === 'number', 'Timestamp should be a number');

    // Test call stack capture
    const callStack = captureCallStack();
    t.that(Array.isArray(callStack), 'Call stack should be an array');
    t.that(callStack.length > 0, 'Call stack should have entries');
    t.that(typeof callStack[0] === 'string', 'Call stack entries should be strings');
  }
});