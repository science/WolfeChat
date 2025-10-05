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
    (window as any).__DEBUG = enabled ? 2 : undefined;
  }
}

// This test verifies that the Message Assembly layer debug logging works correctly
// by testing the debug logging functions directly and checking that they
// produce the expected debug data structure

registerTest({
  id: 'message-assembly-debug-logging-direct',
  name: 'Message Assembly debug logging functions work correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test conversation lookup events
    debugLog.messageAssembly('conversation_lookup_start', {
      convId: 'conv-123',
      totalConversations: 3,
      conversationIds: ['conv-123', 'conv-456', 'conv-789']
    }, 'conv-123');

    debugLog.messageAssembly('conversation_lookup_success', {
      convId: 'conv-123',
      conversationIndex: 0,
      conversationTitle: 'Test Conversation'
    }, 'conv-123');

    // Test text delta events
    debugLog.messageAssembly('text_delta_received', {
      deltaText: 'Hello',
      deltaLength: 5,
      currentStreamLength: 0,
      conversationIndex: 0,
      resolvedModel: 'gpt-5-nano'
    }, 'conv-123');

    // Test assistant message creation
    debugLog.messageAssembly('assistant_message_creating', {
      messageContent: 'Hello█',
      contentLength: 5,
      conversationIndex: 0,
      historyLength: 1
    }, 'conv-123');

    // Test setHistory calls
    debugLog.messageAssembly('setHistory_called_streaming', {
      conversationIndex: 0,
      newHistoryLength: 2,
      assistantContent: 'Hello█',
      model: 'gpt-5-nano'
    }, 'conv-123');

    // Test stream completion
    debugLog.messageAssembly('stream_completed', {
      finalText: 'Hello world',
      streamText: 'Hello world',
      conversationIndex: 0,
      userRequestedClosure: false
    }, 'conv-123');

    // Test final message creation
    debugLog.messageAssembly('final_assistant_message_creating', {
      finalContent: 'Hello world',
      contentLength: 11,
      conversationIndex: 0,
      historyLength: 1,
      model: 'gpt-5-nano'
    }, 'conv-123');

    // Test final setHistory call
    debugLog.messageAssembly('setHistory_called_final', {
      conversationIndex: 0,
      newHistoryLength: 2,
      finalContent: 'Hello world',
      model: 'gpt-5-nano'
    }, 'conv-123');

    const debugData = getDebugData();
    t.that(!!debugData, 'Debug data should exist');
    t.that(debugData.layers.messageAssembly.length === 8, 'Message assembly should have 8 events');

    // Verify event data structure
    const events = debugData.layers.messageAssembly;

    // Check conversation lookup start event
    const lookupStartEvent = events.find(e => e.event === 'conversation_lookup_start');
    t.that(!!lookupStartEvent, 'Should have conversation lookup start event');
    t.that(lookupStartEvent!.conversationId === 'conv-123', 'Lookup start event should have conversation ID');
    t.that(lookupStartEvent!.data.convId === 'conv-123', 'Lookup start event should have convId in data');
    t.that(lookupStartEvent!.data.totalConversations === 3, 'Lookup start event should have total conversations count');
    t.that(Array.isArray(lookupStartEvent!.data.conversationIds), 'Lookup start event should have conversation IDs array');

    // Check conversation lookup success event
    const lookupSuccessEvent = events.find(e => e.event === 'conversation_lookup_success');
    t.that(!!lookupSuccessEvent, 'Should have conversation lookup success event');
    t.that(lookupSuccessEvent!.data.conversationIndex === 0, 'Lookup success event should have conversation index');
    t.that(lookupSuccessEvent!.data.conversationTitle === 'Test Conversation', 'Lookup success event should have conversation title');

    // Check text delta event
    const textDeltaEvent = events.find(e => e.event === 'text_delta_received');
    t.that(!!textDeltaEvent, 'Should have text delta event');
    t.that(textDeltaEvent!.data.deltaText === 'Hello', 'Text delta event should have delta text');
    t.that(textDeltaEvent!.data.deltaLength === 5, 'Text delta event should have delta length');
    t.that(textDeltaEvent!.data.resolvedModel === 'gpt-5-nano', 'Text delta event should have resolved model');

    // Check assistant message creating event
    const messageCreatingEvent = events.find(e => e.event === 'assistant_message_creating');
    t.that(!!messageCreatingEvent, 'Should have assistant message creating event');
    t.that(messageCreatingEvent!.data.messageContent === 'Hello█', 'Message creating event should have message content');
    t.that(messageCreatingEvent!.data.contentLength === 5, 'Message creating event should have content length');

    // Check setHistory streaming call event
    const setHistoryStreamingEvent = events.find(e => e.event === 'setHistory_called_streaming');
    t.that(!!setHistoryStreamingEvent, 'Should have setHistory streaming call event');
    t.that(setHistoryStreamingEvent!.data.conversationIndex === 0, 'SetHistory streaming event should have conversation index');
    t.that(setHistoryStreamingEvent!.data.newHistoryLength === 2, 'SetHistory streaming event should have new history length');

    // Check stream completed event
    const streamCompletedEvent = events.find(e => e.event === 'stream_completed');
    t.that(!!streamCompletedEvent, 'Should have stream completed event');
    t.that(streamCompletedEvent!.data.finalText === 'Hello world', 'Stream completed event should have final text');
    t.that(streamCompletedEvent!.data.userRequestedClosure === false, 'Stream completed event should have user requested closure flag');

    // Check final message creating event
    const finalMessageCreatingEvent = events.find(e => e.event === 'final_assistant_message_creating');
    t.that(!!finalMessageCreatingEvent, 'Should have final assistant message creating event');
    t.that(finalMessageCreatingEvent!.data.finalContent === 'Hello world', 'Final message creating event should have final content');
    t.that(finalMessageCreatingEvent!.data.model === 'gpt-5-nano', 'Final message creating event should have model');

    // Check final setHistory call event
    const setHistoryFinalEvent = events.find(e => e.event === 'setHistory_called_final');
    t.that(!!setHistoryFinalEvent, 'Should have setHistory final call event');
    t.that(setHistoryFinalEvent!.data.finalContent === 'Hello world', 'SetHistory final event should have final content');

    // Verify all events have proper metadata
    events.forEach(event => {
      t.that(event.layer === 'messageAssembly', 'All events should be from messageAssembly layer');
      t.that(typeof event.timestamp === 'number', 'All events should have timestamp');
      t.that(typeof event.sequenceId === 'number', 'All events should have sequence ID');
      t.that(Array.isArray(event.callStack), 'All events should have call stack');
    });

    // Verify timeline contains all events
    t.that(debugData.timeline.length === 8, 'Timeline should have all 8 events');
    const messageAssemblyEventsInTimeline = debugData.timeline.filter(e => e.layer === 'messageAssembly');
    t.that(messageAssemblyEventsInTimeline.length === 8, 'Timeline should have all message assembly events');
  }
});

registerTest({
  id: 'message-assembly-debug-logging-disabled',
  name: 'Message Assembly debug logging is disabled when debug mode is off',
  fn: (t) => {
    mockDebugMode(false);
    resetDebugData();

    // Try to log events when debug mode is disabled
    debugLog.messageAssembly('conversation_lookup_start', { test: 'data' }, 'conv-123');
    debugLog.messageAssembly('text_delta_received', { test: 'data' }, 'conv-123');

    const debugData = getDebugData();
    t.that(!debugData, 'Debug data should not exist when debug mode is disabled');
  }
});

registerTest({
  id: 'message-assembly-debug-logging-conversation-tracking',
  name: 'Message Assembly debug logging tracks conversation context correctly',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test events for multiple conversations
    debugLog.messageAssembly('conversation_lookup_start', { convId: 'conv-1' }, 'conv-1');
    debugLog.messageAssembly('text_delta_received', { deltaText: 'Hello from conv1' }, 'conv-1');
    debugLog.messageAssembly('conversation_lookup_start', { convId: 'conv-2' }, 'conv-2');
    debugLog.messageAssembly('text_delta_received', { deltaText: 'Hello from conv2' }, 'conv-2');
    debugLog.messageAssembly('stream_completed', { finalText: 'Done with conv1' }, 'conv-1');

    const debugData = getDebugData();
    t.that(debugData.layers.messageAssembly.length === 5, 'Should have 5 events total');

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
  id: 'message-assembly-debug-logging-vision-events',
  name: 'Message Assembly debug logging handles vision-specific events',
  fn: (t) => {
    mockDebugMode(true);
    resetDebugData();

    // Test vision-specific events
    debugLog.messageAssembly('vision_text_delta_received', {
      deltaText: 'Vision response',
      deltaLength: 14,
      currentStreamLength: 0,
      convId: 5,
      resolvedModel: 'gpt-4-vision-preview'
    }, 'conv-vision');

    debugLog.messageAssembly('vision_assistant_message_creating', {
      messageContent: 'Vision response█',
      contentLength: 14,
      convId: 5,
      historyLength: 2
    }, 'conv-vision');

    debugLog.messageAssembly('vision_setHistory_called_streaming', {
      convId: 5,
      newHistoryLength: 3,
      assistantContent: 'Vision response█',
      model: 'gpt-4-vision-preview'
    }, 'conv-vision');

    debugLog.messageAssembly('vision_stream_completed', {
      streamText: 'Vision response complete',
      convId: 5,
      userRequestedClosure: false
    }, 'conv-vision');

    debugLog.messageAssembly('vision_final_assistant_message_creating', {
      finalContent: 'Vision response complete',
      contentLength: 23,
      convId: 5,
      historyLength: 2,
      model: 'gpt-4-vision-preview'
    }, 'conv-vision');

    debugLog.messageAssembly('vision_setHistory_called_final', {
      convId: 5,
      newHistoryLength: 3,
      finalContent: 'Vision response complete',
      model: 'gpt-4-vision-preview'
    }, 'conv-vision');

    const debugData = getDebugData();
    t.that(debugData.layers.messageAssembly.length === 6, 'Should have 6 vision events');

    const events = debugData.layers.messageAssembly;

    // Check vision text delta event
    const visionTextDeltaEvent = events.find(e => e.event === 'vision_text_delta_received');
    t.that(!!visionTextDeltaEvent, 'Should have vision text delta event');
    t.that(visionTextDeltaEvent!.data.deltaText === 'Vision response', 'Vision text delta should have correct text');
    t.that(visionTextDeltaEvent!.data.resolvedModel === 'gpt-4-vision-preview', 'Vision text delta should have vision model');

    // Check vision stream completed event
    const visionStreamCompletedEvent = events.find(e => e.event === 'vision_stream_completed');
    t.that(!!visionStreamCompletedEvent, 'Should have vision stream completed event');
    t.that(visionStreamCompletedEvent!.data.streamText === 'Vision response complete', 'Vision stream completed should have final text');

    // Verify all vision events are properly tracked
    const visionEvents = events.filter(e => e.event.startsWith('vision_'));
    t.that(visionEvents.length === 6, 'Should have 6 vision-specific events');
    t.that(visionEvents.every(e => e.conversationId === 'conv-vision'), 'All vision events should have correct conversation ID');
  }
});