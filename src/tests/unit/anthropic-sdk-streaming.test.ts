/**
 * Unit Test: Anthropic SDK Streaming
 *
 * Tests the SDK-based streaming implementation and event handling
 * Verifies proper processing of different streaming event types
 */

import { registerTest } from '../testHarness.js';

registerTest({
  id: 'anthropic-sdk-stream-handler-creation',
  name: 'Should create SDK stream handler and process events',
  fn: async () => {
    // This test verifies the stream handler can be created and process events
    let handlerError: Error | null = null;
    let handler: any = null;

    try {
      // Import the stream handler (which doesn't exist yet)
      const handlerModule = await import('../../services/anthropicSDKStreamHandler.js');
      const StreamHandler = handlerModule.AnthropicSDKStreamHandler;

      // Create a stream handler instance
      handler = new StreamHandler({
        onTextDelta: (text: string) => console.log('Text delta:', text),
        onCompleted: () => console.log('Stream completed'),
        onError: (error: Error) => console.log('Stream error:', error)
      });
    } catch (error) {
      handlerError = error as Error;
    }

    // Assert: Handler creation works
    if (handlerError) {
      throw new Error(`Failed to create stream handler: ${handlerError.message}`);
    }
    if (!handler) {
      throw new Error('Stream handler should be created');
    }

    console.log('✓ SDK stream handler created successfully');
  }
});

registerTest({
  id: 'anthropic-sdk-content-block-events',
  name: 'Should handle content block streaming events correctly',
  fn: async () => {
    // This test verifies handling of content block events
    let eventError: Error | null = null;
    let accumulatedText = '';

    try {
      const handlerModule = await import('../../services/anthropicSDKStreamHandler.js');
      const StreamHandler = handlerModule.AnthropicSDKStreamHandler;

      // Create handler with text accumulation
      const handler = new StreamHandler({
        onTextDelta: (text: string) => {
          accumulatedText += text;
        },
        onCompleted: () => {
          console.log('Stream completed with text:', accumulatedText);
        },
        onError: (error: Error) => {
          eventError = error;
        }
      });

      // Simulate streaming events
      handler.handleEvent({
        type: 'content_block_start',
        content_block: { type: 'text' },
        index: 0
      });

      handler.handleEvent({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
        index: 0
      });

      handler.handleEvent({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: ' World!' },
        index: 0
      });

      handler.handleEvent({
        type: 'content_block_stop',
        index: 0
      });

    } catch (error) {
      eventError = error as Error;
    }

    // Assert: Events processed correctly
    if (eventError) {
      throw new Error(`Event processing failed: ${eventError.message}`);
    }
    if (accumulatedText !== 'Hello World!') {
      throw new Error(`Expected 'Hello World!', got '${accumulatedText}'`);
    }

    console.log('✓ Content block events processed correctly');
  }
});

registerTest({
  id: 'anthropic-sdk-thinking-block-events',
  name: 'Should handle thinking block events for reasoning',
  fn: async () => {
    // This test verifies handling of thinking/reasoning events
    let thinkingError: Error | null = null;
    let thinkingText = '';
    let reasoningStarted = false;

    try {
      const handlerModule = await import('../../services/anthropicSDKStreamHandler.js');
      const StreamHandler = handlerModule.AnthropicSDKStreamHandler;

      // Create handler with reasoning callbacks
      const handler = new StreamHandler({
        onTextDelta: (text: string) => {
          // Regular text delta
        },
        onReasoningStart: () => {
          reasoningStarted = true;
        },
        onReasoningDelta: (text: string) => {
          thinkingText += text;
        },
        onReasoningComplete: () => {
          console.log('Reasoning completed with text:', thinkingText);
        },
        onCompleted: () => {
          console.log('Stream completed');
        },
        onError: (error: Error) => {
          thinkingError = error;
        }
      });

      // Simulate thinking block events
      handler.handleEvent({
        type: 'content_block_start',
        content_block: { type: 'thinking' },
        index: 0
      });

      handler.handleEvent({
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', text: 'Let me think about this...' },
        index: 0
      });

      handler.handleEvent({
        type: 'content_block_stop',
        index: 0
      });

    } catch (error) {
      thinkingError = error as Error;
    }

    // Assert: Thinking events processed correctly
    if (thinkingError) {
      throw new Error(`Thinking processing failed: ${thinkingError.message}`);
    }
    if (!reasoningStarted) {
      throw new Error('Reasoning should have started');
    }
    if (thinkingText !== 'Let me think about this...') {
      throw new Error(`Expected thinking text, got '${thinkingText}'`);
    }

    console.log('✓ Thinking block events processed correctly');
  }
});