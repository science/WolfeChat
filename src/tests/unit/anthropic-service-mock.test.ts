/**
 * Unit Test: Anthropic Service Functions
 *
 * Tests Anthropic service functions that don't require API mocking
 * Error handling tests have been moved to live API tests in src/tests/live/
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'anthropic-stream-context-management',
  name: 'Anthropic streaming context is properly managed',
  tags: ['unit', 'anthropic', 'stream'],
  timeoutMs: 1000,
  fn: async (t) => {
    const {
      anthropicStreamContext,
      closeAnthropicStream
    } = await import('../../services/anthropicMessagingService.js');
    const { isStreaming } = await import('../../stores/stores.js');

    const { get } = await import('svelte/store');

    // Initial state should be empty
    const initialContext = get(anthropicStreamContext);
    t.that(initialContext.streamText === '', 'Initial stream text should be empty');
    t.that(initialContext.convId === null, 'Initial conv ID should be null');
    t.that(get(isStreaming) === false, 'Should not be streaming initially');

    // Test context updates
    anthropicStreamContext.set({ streamText: 'Hello', convId: 1 });
    const updatedContext = get(anthropicStreamContext);
    t.that(updatedContext.streamText === 'Hello', 'Stream text should update');
    t.that(updatedContext.convId === 1, 'Conv ID should update');

    // Test stream closure
    isStreaming.set(true);
    closeAnthropicStream();

    const finalContext = get(anthropicStreamContext);
    t.that(get(isStreaming) === false, 'Should not be streaming after close');

    debugInfo('✓ Stream context management working correctly');
  }
});

registerTest({
  id: 'anthropic-message-conversion-edge-cases',
  name: 'Message conversion handles edge cases correctly',
  tags: ['unit', 'anthropic', 'conversion'],
  timeoutMs: 1000,
  fn: async (t) => {
    const { convertMessagesToAnthropicFormat, extractSystemMessage } = await import('../../services/anthropicMessagingService.js');

    // Test with complex content objects
    const complexMessages = [
      { role: 'system' as const, content: { type: 'text', text: 'System prompt' } },
      { role: 'user' as const, content: ['Hello', 'World'] },
      { role: 'assistant' as const, content: null },
      { role: 'user' as const, content: '' }
    ];

    const converted = convertMessagesToAnthropicFormat(complexMessages);

    // Should exclude system message and convert complex content to strings
    t.that(converted.length === 3, 'Should have 3 messages after filtering system');
    t.that(typeof converted[0].content === 'string', 'Should convert array content to string');
    t.that(converted[1].content === 'null', 'Should convert null to string');
    t.that(converted[2].content === '', 'Should preserve empty string');

    // Test system message extraction with complex content
    const systemMsg = extractSystemMessage(complexMessages);
    t.that(typeof systemMsg === 'string', 'System message should be converted to string');
    t.that(systemMsg.includes('System prompt'), 'Should extract text from complex system content');

    // Test with no messages
    const emptyConverted = convertMessagesToAnthropicFormat([]);
    t.that(emptyConverted.length === 0, 'Should handle empty array');

    const noSystemExtracted = extractSystemMessage([]);
    t.that(noSystemExtracted === undefined, 'Should return undefined for empty array');

    debugInfo('✓ Message conversion edge cases handled correctly');
  }
});

