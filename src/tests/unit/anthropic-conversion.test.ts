/**
 * Unit Test: Anthropic Message Conversion
 *
 * Tests the conversion functions between OpenAI and Anthropic message formats
 * to identify root cause of empty content messages
 */

import { registerTest } from '../testHarness.js';
import { convertMessagesToAnthropicFormat, extractSystemMessage } from '../../services/anthropicMessagingService.js';
import type { ChatMessage } from '../../stores/stores.js';
import { debugInfo, debugWarn } from '../utils/debugLog.js';

registerTest({
  id: 'anthropic-message-conversion-basic',
  name: 'Should convert simple user and assistant messages',
  fn: () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    const result = convertMessagesToAnthropicFormat(messages);

    debugInfo('Input messages: ' + JSON.stringify(messages, null, 2));
    debugInfo('Converted result: ' + JSON.stringify(result, null, 2));

    // Check basic structure
    if (result.length !== 2) {
      throw new Error(`Expected 2 messages, got ${result.length}`);
    }

    if (result[0].role !== 'user' || result[0].content !== 'Hello') {
      throw new Error('First message conversion failed');
    }

    if (result[1].role !== 'assistant' || result[1].content !== 'Hi there!') {
      throw new Error('Second message conversion failed');
    }
  }
});

registerTest({
  id: 'anthropic-message-conversion-with-system',
  name: 'Should filter out system messages',
  fn: () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    const result = convertMessagesToAnthropicFormat(messages);

    debugInfo('Input with system message: ' + JSON.stringify(messages, null, 2));
    debugInfo('Filtered result: ' + JSON.stringify(result, null, 2));

    // Should have filtered out system message
    if (result.length !== 2) {
      throw new Error(`Expected 2 messages after filtering system, got ${result.length}`);
    }

    if (result.some(msg => msg.role === 'system')) {
      throw new Error('System message was not filtered out');
    }
  }
});

registerTest({
  id: 'anthropic-message-conversion-empty-content',
  name: 'Should reveal empty content messages that cause API errors',
  fn: () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Response to first' },
      { role: 'user', content: '' }, // Empty content - this is the bug!
      { role: 'assistant', content: 'Response to empty' }
    ];

    const result = convertMessagesToAnthropicFormat(messages);

    debugInfo('Input with empty content: ' + JSON.stringify(messages, null, 2));
    debugInfo('Result with empty content: ' + JSON.stringify(result, null, 2));

    // Check if we have empty content that would cause Anthropic API errors
    const emptyMessages = result.filter(msg => !msg.content || msg.content.trim().length === 0);

    if (emptyMessages.length > 0) {
      debugWarn('🚨 FOUND THE BUG: Empty content messages that will cause Anthropic API errors: ' + JSON.stringify(emptyMessages));
      debugWarn(`Empty message at index: ${result.findIndex(msg => !msg.content || msg.content.trim().length === 0)}`);
    }

    // This test is meant to expose the problem, not fix it
    if (result[2].content !== '') {
      throw new Error('Test setup error: expected empty content message');
    }
  }
});

registerTest({
  id: 'anthropic-message-conversion-provider-switch',
  name: 'Should handle mixed conversation from provider switching scenario',
  fn: () => {
    // Simulate what happens when switching from OpenAI to Anthropic mid-conversation
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello from GPT' },
      { role: 'assistant', content: 'GPT response here' },
      { role: 'user', content: 'Hello from Claude' }
    ];

    const result = convertMessagesToAnthropicFormat(messages);

    debugInfo('Provider switch scenario input: ' + JSON.stringify(messages, null, 2));
    debugInfo('Provider switch scenario result: ' + JSON.stringify(result, null, 2));

    // All messages should have non-empty content
    result.forEach((msg, index) => {
      if (!msg.content || msg.content.trim().length === 0) {
        throw new Error(`Message ${index} has empty content: "${msg.content}"`);
      }
    });

    debugInfo('✅ All messages have non-empty content in provider switch scenario');
  }
});

registerTest({
  id: 'anthropic-extract-system-message',
  name: 'Should extract system message when present',
  fn: () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' }
    ];

    const result = extractSystemMessage(messages);

    if (result !== 'You are a helpful assistant') {
      throw new Error(`Expected "You are a helpful assistant", got "${result}"`);
    }
  }
});