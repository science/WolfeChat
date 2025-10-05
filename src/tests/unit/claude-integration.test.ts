/**
 * Unit Test: Claude Integration
 *
 * Tests that Claude models are properly detected and routed to the Anthropic service
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'claude-model-detection',
  name: 'Claude models are detected correctly',
  tags: ['unit', 'claude', 'integration'],
  timeoutMs: 1000,
  fn: async (t) => {
    // Import the function we need to test
    const { isAnthropicModel } = await import('../../services/anthropicService.js');

    // Test various Claude model names
    const claudeModels = [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-4-opus-20250514',
      'claude-opus-4-1-20250805'
    ];

    const nonClaudeModels = [
      'gpt-4',
      'gpt-3.5-turbo',
      'text-davinci-003',
      'dall-e-3'
    ];

    // Test that all Claude models are detected
    for (const model of claudeModels) {
      t.that(isAnthropicModel(model), `${model} should be detected as Anthropic model`);
    }

    // Test that non-Claude models are not detected as Anthropic
    for (const model of nonClaudeModels) {
      t.that(!isAnthropicModel(model), `${model} should NOT be detected as Anthropic model`);
    }

    debugInfo('✓ Claude model detection working correctly');
  }
});

registerTest({
  id: 'anthropic-message-format-conversion',
  name: 'Message format conversion works correctly',
  tags: ['unit', 'claude', 'format'],
  timeoutMs: 1000,
  fn: async (t) => {
    const { convertMessagesToAnthropicFormat, extractSystemMessage } = await import('../../services/anthropicMessagingService.js');

    // Test basic conversion
    const messages = [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'Hello!' },
      { role: 'assistant' as const, content: 'Hi!' },
      { role: 'user' as const, content: 'How are you?' }
    ];

    const converted = convertMessagesToAnthropicFormat(messages);

    // Should exclude system message
    t.that(converted.length === 3, 'Should have 3 messages (excluding system)');

    // Check structure
    t.that(converted[0].role === 'user', 'First message should be user');
    t.that(converted[0].content === 'Hello!', 'First message content should match');
    t.that(converted[1].role === 'assistant', 'Second message should be assistant');
    t.that(converted[2].role === 'user', 'Third message should be user');

    // Test system message extraction
    const systemMsg = extractSystemMessage(messages);
    t.that(systemMsg === 'You are helpful.', 'Should extract system message');

    // Test with no system message
    const noSystem = [{ role: 'user' as const, content: 'Hi' }];
    const noSystemExtracted = extractSystemMessage(noSystem);
    t.that(noSystemExtracted === undefined, 'Should return undefined when no system message');

    debugInfo('✓ Message format conversion working correctly');
  }
});

registerTest({
  id: 'anthropic-service-imports',
  name: 'Anthropic service functions can be imported correctly',
  tags: ['unit', 'claude', 'imports'],
  timeoutMs: 1000,
  fn: async (t) => {
    try {
      // Test that we can import all the functions we need
      const anthropicService = await import('../../services/anthropicService.js');
      const anthropicMessaging = await import('../../services/anthropicMessagingService.js');

      // Check that key functions exist
      t.that(typeof anthropicService.isAnthropicModel === 'function', 'isAnthropicModel should be a function');
      t.that(typeof anthropicService.fetchAnthropicModels === 'function', 'fetchAnthropicModels should be a function');

      t.that(typeof anthropicMessaging.convertMessagesToAnthropicFormat === 'function', 'convertMessagesToAnthropicFormat should be a function');
      t.that(typeof anthropicMessaging.streamAnthropicMessage === 'function', 'streamAnthropicMessage should be a function');
      t.that(typeof anthropicMessaging.sendAnthropicMessage === 'function', 'sendAnthropicMessage should be a function');

      debugInfo('✓ All Anthropic service imports working correctly');
    } catch (error) {
      t.that(false, `Import error: ${error.message}`);
    }
  }
});