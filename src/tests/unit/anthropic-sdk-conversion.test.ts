/**
 * Unit Test: Anthropic SDK Message Conversion
 *
 * Tests the conversion functions between ChatMessage format and Anthropic SDK format
 * Ensures proper handling of different message types, system messages, and edge cases
 */

import { registerTest } from '../testHarness.js';
import type { ChatMessage } from '../../stores/stores.js';

registerTest({
  id: 'anthropic-sdk-simple-conversion',
  name: 'Should convert simple user and assistant messages to SDK format',
  fn: async () => {
    // This test verifies basic message conversion
    let converterError: Error | null = null;
    let convertedMessages: any = null;

    try {
      // Import the converter (which doesn't exist yet)
      const converterModule = await import('../../services/anthropicSDKConverter.js');
      const converter = converterModule.convertToSDKFormat;

      const inputMessages: ChatMessage[] = [
        { role: 'user', content: 'Hello Claude!' },
        { role: 'assistant', content: 'Hello! How can I help you today?' },
        { role: 'user', content: 'What is the weather like?' }
      ];

      convertedMessages = converter(inputMessages);
    } catch (error) {
      converterError = error as Error;
    }

    // Assert: Conversion works correctly
    if (converterError) {
      throw new Error(`Conversion failed: ${converterError.message}`);
    }
    if (!Array.isArray(convertedMessages)) {
      throw new Error('Converted messages should be an array');
    }
    if (convertedMessages.length !== 3) {
      throw new Error(`Expected 3 messages, got ${convertedMessages.length}`);
    }

    // Verify first message
    const firstMsg = convertedMessages[0];
    if (firstMsg.role !== 'user' || firstMsg.content !== 'Hello Claude!') {
      throw new Error(`First message incorrect: ${JSON.stringify(firstMsg)}`);
    }

    // Verify second message
    const secondMsg = convertedMessages[1];
    if (secondMsg.role !== 'assistant' || secondMsg.content !== 'Hello! How can I help you today?') {
      throw new Error(`Second message incorrect: ${JSON.stringify(secondMsg)}`);
    }

    console.log('✓ Simple message conversion works correctly');
  }
});

registerTest({
  id: 'anthropic-sdk-system-message-handling',
  name: 'Should extract system messages and return separate system content',
  fn: async () => {
    // This test verifies system message handling for SDK format
    let converterError: Error | null = null;
    let result: any = null;

    try {
      const converterModule = await import('../../services/anthropicSDKConverter.js');
      const converter = converterModule.convertToSDKFormatWithSystem;

      const inputMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      result = converter(inputMessages);
    } catch (error) {
      converterError = error as Error;
    }

    // Assert: System message extracted properly
    if (converterError) {
      throw new Error(`System conversion failed: ${converterError.message}`);
    }
    if (!result || typeof result !== 'object') {
      throw new Error('Result should be an object');
    }
    if (!Array.isArray(result.messages)) {
      throw new Error('Result should have messages array');
    }
    if (result.messages.length !== 2) {
      throw new Error(`Expected 2 non-system messages, got ${result.messages.length}`);
    }
    if (result.system !== 'You are a helpful assistant.') {
      throw new Error(`Expected system message extracted, got: ${result.system}`);
    }

    // Verify system message not in messages array
    const hasSystemInMessages = result.messages.some((msg: any) => msg.role === 'system');
    if (hasSystemInMessages) {
      throw new Error('System message should not be in messages array');
    }

    console.log('✓ System message extraction works correctly');
  }
});

registerTest({
  id: 'anthropic-sdk-complex-content-handling',
  name: 'Should handle complex content structures and edge cases',
  fn: async () => {
    // This test verifies handling of complex content types
    let converterError: Error | null = null;
    let convertedMessages: any = null;

    try {
      const converterModule = await import('../../services/anthropicSDKConverter.js');
      const converter = converterModule.convertToSDKFormat;

      const inputMessages: ChatMessage[] = [
        { role: 'user', content: '' }, // Empty content
        { role: 'assistant', content: 'Response to empty' },
        { role: 'user', content: { type: 'complex', data: 'some data' } }, // Non-string content
        { role: 'assistant', content: 'Final response' }
      ];

      convertedMessages = converter(inputMessages);
    } catch (error) {
      converterError = error as Error;
    }

    // Assert: Complex content handled appropriately
    if (converterError) {
      throw new Error(`Complex conversion failed: ${converterError.message}`);
    }
    if (!Array.isArray(convertedMessages)) {
      throw new Error('Should return array even with complex content');
    }

    // Check that empty content is handled
    const firstMsg = convertedMessages[0];
    if (typeof firstMsg.content !== 'string') {
      throw new Error('Empty content should be converted to string');
    }

    // Check that complex content is stringified
    const thirdMsg = convertedMessages[2];
    if (typeof thirdMsg.content !== 'string') {
      throw new Error('Complex content should be stringified');
    }

    console.log('✓ Complex content structures handled correctly');
  }
});