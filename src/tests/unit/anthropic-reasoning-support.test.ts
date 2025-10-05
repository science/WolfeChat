/**
 * Unit Test: Anthropic Reasoning Support
 *
 * Tests the reasoning/extended thinking functionality for Claude models
 * Verifies model detection, request configuration, and reasoning window integration
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

registerTest({
  id: 'anthropic-reasoning-model-detection',
  name: 'Should detect Claude models that support reasoning',
  fn: async () => {
    // This test verifies reasoning model detection
    let detectionError: Error | null = null;
    let supportsReasoning: any = null;

    try {
      // Import the reasoning detection function (which doesn't exist yet)
      const reasoningModule = await import('../../services/anthropicReasoning.js');
      supportsReasoning = reasoningModule.supportsAnthropicReasoning;
    } catch (error) {
      detectionError = error as Error;
    }

    // Assert: Function can be imported
    if (detectionError) {
      throw new Error(`Failed to import reasoning detection: ${detectionError.message}`);
    }
    if (typeof supportsReasoning !== 'function') {
      throw new Error('supportsAnthropicReasoning should be a function');
    }

    // Test reasoning-capable models
    const reasoningModels = [
      'claude-opus-4-1-20250805',
      'claude-opus-4',
      'claude-sonnet-4',
      'claude-sonnet-3.7'
    ];

    for (const model of reasoningModels) {
      if (!supportsReasoning(model)) {
        throw new Error(`${model} should support reasoning`);
      }
    }

    // Test non-reasoning models
    const nonReasoningModels = [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229',
      'claude-3.5-sonnet-20241022'
    ];

    for (const model of nonReasoningModels) {
      if (supportsReasoning(model)) {
        throw new Error(`${model} should NOT support reasoning`);
      }
    }

    debugInfo('✓ Claude reasoning model detection works correctly');
  }
});

registerTest({
  id: 'anthropic-reasoning-request-configuration',
  name: 'Should add thinking configuration to requests for reasoning models',
  fn: async () => {
    // This test verifies thinking configuration is added to requests
    let configError: Error | null = null;
    let addThinkingConfig: any = null;

    try {
      const reasoningModule = await import('../../services/anthropicReasoning.js');
      addThinkingConfig = reasoningModule.addThinkingConfiguration;
    } catch (error) {
      configError = error as Error;
    }

    // Assert: Function can be imported
    if (configError) {
      throw new Error(`Failed to import thinking configuration: ${configError.message}`);
    }
    if (typeof addThinkingConfig !== 'function') {
      throw new Error('addThinkingConfiguration should be a function');
    }

    // Test adding thinking config to reasoning model
    const baseParams = {
      model: 'claude-opus-4-1-20250805',
      max_tokens: 4096,
      messages: []
    };

    const configuredParams = addThinkingConfig(baseParams);

    // Assert: Thinking configuration added
    if (!configuredParams.thinking) {
      throw new Error('Thinking configuration should be added');
    }
    if (configuredParams.thinking.type !== 'enabled') {
      throw new Error('Thinking type should be enabled');
    }
    if (typeof configuredParams.thinking.budget_tokens !== 'number') {
      throw new Error('Budget tokens should be a number');
    }
    if (configuredParams.thinking.budget_tokens < 1024) {
      throw new Error('Budget tokens should be at least 1024');
    }

    // Test non-reasoning model (should not add thinking config)
    const nonReasoningParams = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: []
    };

    const unchanged = addThinkingConfig(nonReasoningParams);
    if (unchanged.thinking) {
      throw new Error('Thinking config should not be added to non-reasoning models');
    }

    debugInfo('✓ Thinking configuration added correctly');
  }
});

registerTest({
  id: 'anthropic-reasoning-window-integration',
  name: 'Should integrate with existing reasoning window system',
  fn: async () => {
    // This test verifies integration with reasoning windows
    let integrationError: Error | null = null;
    let createReasoningSupport: any = null;

    try {
      const reasoningModule = await import('../../services/anthropicReasoning.js');
      createReasoningSupport = reasoningModule.createAnthropicReasoningSupport;
    } catch (error) {
      integrationError = error as Error;
    }

    // Assert: Function can be imported
    if (integrationError) {
      throw new Error(`Failed to import reasoning integration: ${integrationError.message}`);
    }
    if (typeof createReasoningSupport !== 'function') {
      throw new Error('createAnthropicReasoningSupport should be a function');
    }

    // Create reasoning support for a conversation
    const reasoningSupport = createReasoningSupport({
      convId: 'test-conv-123',
      model: 'claude-opus-4-1-20250805'
    });

    // Assert: Reasoning support object created
    if (!reasoningSupport) {
      throw new Error('Reasoning support should be created');
    }
    if (typeof reasoningSupport.startReasoning !== 'function') {
      throw new Error('Should have startReasoning method');
    }
    if (typeof reasoningSupport.updateReasoning !== 'function') {
      throw new Error('Should have updateReasoning method');
    }
    if (typeof reasoningSupport.completeReasoning !== 'function') {
      throw new Error('Should have completeReasoning method');
    }

    debugInfo('✓ Reasoning window integration works correctly');
  }
});