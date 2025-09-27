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

// This test verifies that the SSE parser debug logging works correctly
// by testing the debug logging functions directly and checking that they
// produce the expected debug data structure

registerTest({
  id: 'sse-parser-debug-logging-direct',
  name: 'SSE Parser debug logging functions work correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test SSE parser specific debug events
    debugLog.sseParser('raw_chunk_received', {
      chunkLength: 100,
      chunkSnippet: 'event: response.output_text.delta'
    }, 'conv-123', 'resp-456');

    debugLog.sseParser('sse_block_received', {
      blockLength: 200,
      blockSnippet: 'event: response.output_text.delta\ndata: {"delta": {"text": "Hello"}}'
    }, 'conv-123', 'resp-456');

    debugLog.sseParser('sse_json_parsed', {
      eventType: 'response.output_text.delta',
      hasId: false,
      hasChoices: false,
      objType: undefined
    }, 'conv-123', 'resp-456');

    debugLog.sseParser('sse_event_resolved', {
      rawEventType: 'response.output_text.delta',
      resolvedType: 'response.output_text.delta',
      hasData: true
    }, 'conv-123', 'resp-456');

    debugLog.sseParser('sse_stream_done', {
      finalTextLength: 50,
      activePanels: 2
    }, 'conv-123', 'resp-456');

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data should exist');
    t.that(debugData.layers.sseParser.length === 5, 'SSE parser should have 5 events');

    // Verify event data structure
    const events = debugData.layers.sseParser;

    // Check raw chunk event
    const rawChunkEvent = events.find(e => e.event === 'raw_chunk_received');
    t.that(!!rawChunkEvent, 'Should have raw chunk event');
    t.that(rawChunkEvent!.conversationId === 'conv-123', 'Raw chunk event should have conversation ID');
    t.that(rawChunkEvent!.responseId === 'resp-456', 'Raw chunk event should have response ID');
    t.that(rawChunkEvent!.data.chunkLength === 100, 'Raw chunk event should have chunk length');

    // Check block received event
    const blockEvent = events.find(e => e.event === 'sse_block_received');
    t.that(!!blockEvent, 'Should have block received event');
    t.that(blockEvent!.data.blockLength === 200, 'Block event should have block length');

    // Check JSON parsed event
    const jsonEvent = events.find(e => e.event === 'sse_json_parsed');
    t.that(!!jsonEvent, 'Should have JSON parsed event');
    t.that(jsonEvent!.data.eventType === 'response.output_text.delta', 'JSON event should have event type');

    // Check event resolved event
    const resolvedEvent = events.find(e => e.event === 'sse_event_resolved');
    t.that(!!resolvedEvent, 'Should have event resolved event');
    t.that(resolvedEvent!.data.resolvedType === 'response.output_text.delta', 'Resolved event should have resolved type');

    // Check stream done event
    const doneEvent = events.find(e => e.event === 'sse_stream_done');
    t.that(!!doneEvent, 'Should have stream done event');
    t.that(doneEvent!.data.finalTextLength === 50, 'Done event should have final text length');
    t.that(doneEvent!.data.activePanels === 2, 'Done event should have active panels count');

    // Verify all events have proper metadata
    events.forEach(event => {
      t.that(event.layer === 'sseParser', 'All events should be from sseParser layer');
      t.that(typeof event.timestamp === 'number', 'All events should have timestamp');
      t.that(typeof event.sequenceId === 'number', 'All events should have sequence ID');
      t.that(Array.isArray(event.callStack), 'All events should have call stack');
    });

    // Verify timeline contains all events
    t.that(debugData.timeline.length === 5, 'Timeline should have all 5 events');
    const sseParserEventsInTimeline = debugData.timeline.filter(e => e.layer === 'sseParser');
    t.that(sseParserEventsInTimeline.length === 5, 'Timeline should have all SSE parser events');
  }
});

registerTest({
  id: 'sse-parser-debug-logging-disabled',
  name: 'SSE Parser debug logging is disabled when debug mode is off',
  fn: (t) => {
    mockDebugMode(false);
    resetDebugData();

    // Try to log events when debug mode is disabled
    debugLog.sseParser('raw_chunk_received', { test: 'data' }, 'conv-123');
    debugLog.sseParser('sse_block_received', { test: 'data' }, 'conv-123');

    const debugData = getDebugData();
    t.that(!debugData, 'Debug data should not exist when debug mode is disabled');
  }
});

registerTest({
  id: 'sse-parser-debug-logging-conversation-tracking',
  name: 'SSE Parser debug logging tracks conversation context correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test events for multiple conversations
    debugLog.sseParser('raw_chunk_received', { data: 'conv1' }, 'conv-1', 'resp-1');
    debugLog.sseParser('raw_chunk_received', { data: 'conv2' }, 'conv-2', 'resp-2');
    debugLog.sseParser('sse_stream_done', { finalText: 'done1' }, 'conv-1', 'resp-1');

    const debugData = getDebugData();
    t.that(debugData.layers.sseParser.length === 3, 'Should have 3 events total');

    // Test conversation filtering
    const conv1Events = debugData.timeline.filter(e => e.conversationId === 'conv-1');
    const conv2Events = debugData.timeline.filter(e => e.conversationId === 'conv-2');

    t.that(conv1Events.length === 2, 'Should have 2 events for conv-1');
    t.that(conv2Events.length === 1, 'Should have 1 event for conv-2');

    t.that(conv1Events.every(e => e.conversationId === 'conv-1'), 'All conv-1 events should have correct conversation ID');
    t.that(conv2Events.every(e => e.conversationId === 'conv-2'), 'All conv-2 events should have correct conversation ID');
  }
});