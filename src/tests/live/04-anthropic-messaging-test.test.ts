/**
 * Live API Unit Tests - Level 4: Anthropic Messaging Service
 *
 * This test verifies that our anthropicMessagingService.ts functions work correctly
 * with the real Anthropic API for sending messages.
 */

import { registerTest } from '../testHarness.js';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (hasAnthropicKey) {
  registerTest({
    id: 'anthropic-messaging-format-conversion',
    name: 'Level 4: Message format conversion works correctly',
    tags: ['live', 'anthropic', 'messaging'],
    timeoutMs: 1000,
    fn: async (t) => {
      const { convertMessagesToAnthropicFormat, extractSystemMessage } = await import('../../services/anthropicMessagingService.js');

      // Test basic message conversion
      const openaiMessages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello!' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'How are you?' }
      ];

      const anthropicMessages = convertMessagesToAnthropicFormat(openaiMessages);

      // Should exclude system message
      t.that(anthropicMessages.length === 3, 'Should exclude system message from Anthropic format');

      // Check message structure
      t.that(anthropicMessages[0].role === 'user', 'First message should be user');
      t.that(anthropicMessages[0].content === 'Hello!', 'First message content should match');
      t.that(anthropicMessages[1].role === 'assistant', 'Second message should be assistant');
      t.that(anthropicMessages[2].role === 'user', 'Third message should be user');

      // Test system message extraction
      const systemMessage = extractSystemMessage(openaiMessages);
      t.that(systemMessage === 'You are a helpful assistant.', 'Should extract system message correctly');

      // Test with no system message
      const noSystemMessages = [
        { role: 'user' as const, content: 'Hello!' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];

      const noSystemExtracted = extractSystemMessage(noSystemMessages);
      t.that(noSystemExtracted === undefined, 'Should return undefined when no system message');

      console.log('✓ Message format conversion working correctly');
    }
  });

  registerTest({
    id: 'anthropic-messaging-non-streaming',
    name: 'Level 4: Non-streaming Anthropic message works',
    tags: ['live', 'anthropic', 'messaging'],
    timeoutMs: 30000,
    fn: async (t) => {
      // Import stores and set API key
      const { anthropicApiKey } = await import('../../stores/providerStore.js');
      const { conversations } = await import('../../stores/stores.js');

      anthropicApiKey.set(process.env.ANTHROPIC_API_KEY);

      // Mock conversation store data
      const mockConversations = {
        1: {
          id: 1,
          history: [
            { role: 'user', content: 'Say hello in exactly 3 words.' }
          ]
        }
      };

      conversations.set(mockConversations);

      // Import the service
      const { sendAnthropicMessage } = await import('../../services/anthropicMessagingService.js');

      const messages = [
        { role: 'user' as const, content: 'Say hello in exactly 3 words.' }
      ];

      const config = { model: 'claude-3-haiku-20240307' };

      try {
        await sendAnthropicMessage(messages, 1, config);

        // If we get here, the function completed without throwing
        console.log('✓ Non-streaming Anthropic message sent successfully');
        t.that(true, 'sendAnthropicMessage should complete without errors');

      } catch (error) {
        console.error('❌ Non-streaming message failed:', error);
        t.that(false, `sendAnthropicMessage should not throw: ${error.message}`);
      }
    }
  });

  registerTest({
    id: 'anthropic-messaging-streaming',
    name: 'Level 4: Streaming Anthropic message works',
    tags: ['live', 'anthropic', 'messaging'],
    timeoutMs: 45000,
    fn: async (t) => {
      // Import stores and set API key
      const { anthropicApiKey } = await import('../../stores/providerStore.js');
      const { conversations } = await import('../../stores/stores.js');

      anthropicApiKey.set(process.env.ANTHROPIC_API_KEY);

      // Mock conversation store data
      const mockConversations = {
        1: {
          id: 1,
          history: [
            { role: 'user', content: 'Count from 1 to 5, one number per line.' }
          ]
        }
      };

      conversations.set(mockConversations);

      // Import the service
      const { streamAnthropicMessage, anthropicStreamContext } = await import('../../services/anthropicMessagingService.js');
      const { isStreaming } = await import('../../stores/stores.js');

      const messages = [
        { role: 'user' as const, content: 'Count from 1 to 5, one number per line.' }
      ];

      const config = { model: 'claude-3-haiku-20240307' };

      try {
        let streamingStarted = false;
        let receivedText = false;

        // Monitor streaming state
        const unsubscribeStreaming = isStreaming.subscribe(value => {
          if (value) streamingStarted = true;
        });

        // Monitor stream content
        const unsubscribeContext = anthropicStreamContext.subscribe(context => {
          if (context.streamText && context.streamText.length > 0) {
            receivedText = true;
          }
        });

        await streamAnthropicMessage(messages, 1, config);

        // Clean up subscriptions
        unsubscribeStreaming();
        unsubscribeContext();

        t.that(streamingStarted, 'Streaming should have started');
        t.that(receivedText, 'Should have received streaming text');

        console.log('✓ Streaming Anthropic message worked successfully');

      } catch (error) {
        console.error('❌ Streaming message failed:', error);
        t.that(false, `streamAnthropicMessage should not throw: ${error.message}`);
      }
    }
  });

  registerTest({
    id: 'anthropic-messaging-error-handling',
    name: 'Level 4: Anthropic messaging handles API errors correctly',
    tags: ['live', 'anthropic', 'messaging'],
    timeoutMs: 10000,
    fn: async (t) => {
      // Import stores and set invalid API key
      const { anthropicApiKey } = await import('../../stores/providerStore.js');
      const { conversations } = await import('../../stores/stores.js');

      anthropicApiKey.set('sk-ant-invalid-key-12345');

      // Mock conversation store
      const mockConversations = {
        1: {
          id: 1,
          history: []
        }
      };

      conversations.set(mockConversations);

      const { sendAnthropicMessage } = await import('../../services/anthropicMessagingService.js');

      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];

      const config = { model: 'claude-3-haiku-20240307' };

      try {
        await sendAnthropicMessage(messages, 1, config);
        t.that(false, 'Should throw error with invalid API key');
      } catch (error) {
        t.that(error instanceof Error, 'Should throw an Error object');
        t.that(
          error.message.includes('Invalid Anthropic API key') ||
          error.message.includes('API key') ||
          error.message.includes('api-key') ||
          error.message.includes('authentication'),
          'Error should mention API key or authentication issue'
        );
        console.log('✓ Error handling working correctly:', error.message);
      }
    }
  });

} else {
  registerTest({
    id: 'anthropic-messaging-missing-key',
    name: 'Level 4: ANTHROPIC_API_KEY environment variable missing',
    tags: ['live', 'anthropic', 'messaging'],
    timeoutMs: 1000,
    fn: async (t) => {
      console.log('⚠️  ANTHROPIC_API_KEY not set - skipping messaging tests');
      t.that(false, 'ANTHROPIC_API_KEY environment variable is required for messaging tests');
    }
  });
}