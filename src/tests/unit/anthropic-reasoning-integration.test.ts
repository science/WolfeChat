/**
 * Unit Test: Anthropic Reasoning Integration
 *
 * TDD test that describes EXPECTED behavior for reasoning window integration
 * with Anthropic SDK streaming. If this test fails, it proves the bug exists.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'anthropic-reasoning-window-creation',
  name: 'Should create reasoning window for Opus models during streaming',
  fn: async () => {
    // This test describes EXPECTED behavior: Reasoning windows should appear for Opus models

    // Mock the reasoning store functions
    let reasoningWindowCreated = false;
    let reasoningPanelStarted = false;
    let reasoningTextUpdated = false;
    let reasoningCompleted = false;
    let capturedReasoningText = '';

    // Import and mock the reasoning store
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Test 1: Verify Opus 4.1 is recognized as a reasoning model
    const opus41Supports = reasoningModule.supportsAnthropicReasoning('claude-opus-4-1-20250805');
    if (!opus41Supports) {
      throw new Error('EXPECTED: claude-opus-4-1 should support reasoning');
    }
    debugInfo('✓ Opus 4.1 correctly identified as reasoning model');

    // Test 2: Verify Haiku does NOT support reasoning
    const haikuSupports = reasoningModule.supportsAnthropicReasoning('claude-3-haiku-20240307');
    if (haikuSupports) {
      throw new Error('EXPECTED: claude-3-haiku should NOT support reasoning');
    }
    debugInfo('✓ Haiku correctly identified as non-reasoning model');

    // Test 3: Create reasoning support and verify it initializes
    const reasoningSupport = reasoningModule.createAnthropicReasoningSupport({
      convId: 'test-conv-1',
      model: 'claude-opus-4-1-20250805',
      callbacks: {
        onReasoningStart: () => {
          reasoningWindowCreated = true;
          reasoningPanelStarted = true;
        },
        onReasoningUpdate: (text) => {
          reasoningTextUpdated = true;
          capturedReasoningText += text;
        },
        onReasoningComplete: () => {
          reasoningCompleted = true;
        }
      }
    });

    // Simulate reasoning flow
    reasoningSupport.startReasoning();
    reasoningSupport.updateReasoning('Let me think about this problem...');
    reasoningSupport.updateReasoning(' I need to calculate step by step.');
    reasoningSupport.completeReasoning();

    // Assert: All reasoning callbacks should have been called
    if (!reasoningWindowCreated) {
      throw new Error('EXPECTED: Reasoning window should be created');
    }
    if (!reasoningPanelStarted) {
      throw new Error('EXPECTED: Reasoning panel should start');
    }
    if (!reasoningTextUpdated) {
      throw new Error('EXPECTED: Reasoning text should be updated');
    }
    if (!reasoningCompleted) {
      throw new Error('EXPECTED: Reasoning should complete');
    }
    if (capturedReasoningText !== 'Let me think about this problem... I need to calculate step by step.') {
      throw new Error(`EXPECTED: Reasoning text should accumulate correctly, got: ${capturedReasoningText}`);
    }

    debugInfo('✓ Reasoning support lifecycle works correctly');
  }
});

registerTest({
  id: 'anthropic-sdk-thinking-events',
  name: 'Should handle SDK thinking events and update reasoning window',
  fn: async () => {
    // This test verifies that SDK events are properly translated to reasoning updates

    // Import the SDK messaging module
    const messagingModule = await import('../../services/anthropicSDKMessaging.js');
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Track reasoning events
    let reasoningEvents: string[] = [];

    // Create a mock stream handler to simulate SDK events
    const mockStreamEvents = [
      { type: 'message_start' },
      { type: 'content_block_start', content_block: { type: 'thinking' }, index: 0 },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', text: 'Analyzing the request...' }, index: 0 },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', text: ' This requires calculation.' }, index: 0 },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', content_block: { type: 'text' }, index: 1 },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'The answer is 42.' }, index: 1 },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_stop' }
    ];

    // Import the stream handler
    const streamHandlerModule = await import('../../services/anthropicSDKStreamHandler.js');
    const StreamHandler = streamHandlerModule.AnthropicSDKStreamHandler;

    // Create handler with tracking callbacks
    const handler = new StreamHandler({
      onTextDelta: (text) => {
        reasoningEvents.push(`text: ${text}`);
      },
      onReasoningStart: () => {
        reasoningEvents.push('reasoning_start');
      },
      onReasoningDelta: (text) => {
        reasoningEvents.push(`reasoning: ${text}`);
      },
      onReasoningComplete: () => {
        reasoningEvents.push('reasoning_complete');
      },
      onCompleted: () => {
        reasoningEvents.push('message_complete');
      }
    });

    // Process all mock events
    for (const event of mockStreamEvents) {
      handler.handleEvent(event);
    }

    // Verify expected event sequence
    const expectedEvents = [
      'reasoning_start',
      'reasoning: Analyzing the request...',
      'reasoning:  This requires calculation.',
      'reasoning_complete',
      'text: The answer is 42.',
      'message_complete'
    ];

    // Assert: Events should match expected sequence
    if (reasoningEvents.length !== expectedEvents.length) {
      throw new Error(`EXPECTED: ${expectedEvents.length} events, got ${reasoningEvents.length}`);
    }

    for (let i = 0; i < expectedEvents.length; i++) {
      if (reasoningEvents[i] !== expectedEvents[i]) {
        throw new Error(`Event ${i} mismatch - EXPECTED: "${expectedEvents[i]}", got "${reasoningEvents[i]}"`);
      }
    }

    debugInfo('✓ SDK thinking events properly handled');

    // Verify accumulated text is correct
    const finalText = handler.getAllText();
    if (finalText !== 'The answer is 42.') {
      throw new Error(`EXPECTED: Final text to be "The answer is 42.", got "${finalText}"`);
    }

    const reasoningText = handler.getReasoningText();
    if (reasoningText !== 'Analyzing the request... This requires calculation.') {
      throw new Error(`EXPECTED: Reasoning text to accumulate, got "${reasoningText}"`);
    }

    debugInfo('✓ Text accumulation works correctly (reasoning excluded from output)');
  }
});

registerTest({
  id: 'anthropic-thinking-configuration',
  name: 'Should add thinking configuration for reasoning models',
  fn: async () => {
    // This test verifies that thinking configuration is properly added to API requests

    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Test 1: Opus model should get thinking configuration
    const opusParams = {
      model: 'claude-opus-4-1-20250805',
      messages: [],
      max_tokens: 32000
    };

    const configuredOpus = reasoningModule.addThinkingConfigurationWithBudget(opusParams);

    if (!configuredOpus.thinking) {
      throw new Error('EXPECTED: Thinking configuration should be added for Opus');
    }
    if (configuredOpus.thinking.type !== 'enabled') {
      throw new Error('EXPECTED: Thinking type should be "enabled"');
    }
    if (configuredOpus.thinking.budget_tokens !== 8000) {
      throw new Error(`EXPECTED: Thinking budget should be 8000 for Opus, got ${configuredOpus.thinking.budget_tokens}`);
    }

    debugInfo('✓ Thinking configuration added for Opus model');

    // Test 2: Haiku model should NOT get thinking configuration
    const haikuParams = {
      model: 'claude-3-haiku-20240307',
      messages: [],
      max_tokens: 4096
    };

    const configuredHaiku = reasoningModule.addThinkingConfigurationWithBudget(haikuParams);

    if (configuredHaiku.thinking) {
      throw new Error('EXPECTED: No thinking configuration for Haiku');
    }

    debugInfo('✓ No thinking configuration added for Haiku model');

    // Test 3: Verify token constraint validation
    const modelConfigModule = await import('../../services/anthropicModelConfig.js');

    const opusConstraintValid = modelConfigModule.validateTokenConstraint('claude-opus-4-1-20250805');
    if (!opusConstraintValid) {
      throw new Error('EXPECTED: Opus token constraint should be valid (32000 > 8000)');
    }

    const haikuConstraintValid = modelConfigModule.validateTokenConstraint('claude-3-haiku-20240307');
    if (!haikuConstraintValid) {
      throw new Error('EXPECTED: Haiku token constraint should be valid (no thinking budget)');
    }

    debugInfo('✓ Token constraints validated correctly');
  }
});

registerTest({
  id: 'anthropic-reasoning-store-integration',
  name: 'Should integrate with reasoning store for UI updates',
  fn: async () => {
    // This test verifies that reasoning support has the correct API
    // Full integration with the store is tested in E2E tests

    // Import necessary modules
    const reasoningModule = await import('../../services/anthropicReasoning.js');
    const storeModule = await import('../../stores/reasoningStore.js');

    // Verify store functions exist and are callable
    if (typeof storeModule.createReasoningWindow !== 'function') {
      throw new Error('EXPECTED: createReasoningWindow should be a function');
    }
    if (typeof storeModule.startReasoningPanel !== 'function') {
      throw new Error('EXPECTED: startReasoningPanel should be a function');
    }
    if (typeof storeModule.setReasoningText !== 'function') {
      throw new Error('EXPECTED: setReasoningText should be a function');
    }
    if (typeof storeModule.completeReasoningPanel !== 'function') {
      throw new Error('EXPECTED: completeReasoningPanel should be a function');
    }

    // Verify AnthropicReasoningSupport class exists and has correct API
    const support = new reasoningModule.AnthropicReasoningSupport(
      'conv-123',
      'claude-opus-4-1-20250805'
    );

    if (typeof support.startReasoning !== 'function') {
      throw new Error('EXPECTED: startReasoning should be a function');
    }
    if (typeof support.updateReasoning !== 'function') {
      throw new Error('EXPECTED: updateReasoning should be a function');
    }
    if (typeof support.completeReasoning !== 'function') {
      throw new Error('EXPECTED: completeReasoning should be a function');
    }
    if (typeof support.isActive !== 'boolean') {
      throw new Error('EXPECTED: isActive should be a boolean property');
    }

    // Test factory function
    const factorySupport = reasoningModule.createAnthropicReasoningSupport({
      convId: 'conv-456',
      model: 'claude-opus-4-1-20250805'
    });

    if (!factorySupport) {
      throw new Error('EXPECTED: Factory function should create reasoning support');
    }
    if (typeof factorySupport.startReasoning !== 'function') {
      throw new Error('EXPECTED: Factory-created support should have startReasoning method');
    }

    debugInfo('✓ Reasoning store integration API is correct');
  }
});