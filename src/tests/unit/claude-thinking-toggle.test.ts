/**
 * Unit Test: Claude Thinking Toggle
 *
 * TDD test for the ability to enable/disable extended thinking for Claude models.
 * This feature allows users to turn off thinking for Claude models (on by default).
 */

import { registerTest } from '../testHarness.js';
import { debugInfo } from '../utils/debugLog.js';

registerTest({
  id: 'claude-thinking-toggle-enabled-by-default',
  name: 'Should enable thinking by default for reasoning models',
  fn: async () => {
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Opus model with NO thinkingEnabled option should have thinking enabled
    const opusParams = {
      model: 'claude-opus-4-1-20250805',
      messages: [],
      max_tokens: 32000
    };

    // Call with no options - should enable thinking
    const configuredOpus = reasoningModule.addThinkingConfigurationWithBudget(opusParams);

    if (!configuredOpus.thinking) {
      throw new Error('EXPECTED: Thinking should be enabled by default for Opus');
    }
    if (configuredOpus.thinking.type !== 'enabled') {
      throw new Error('EXPECTED: Thinking type should be "enabled" by default');
    }

    debugInfo('✓ Thinking enabled by default for reasoning models');
  }
});

registerTest({
  id: 'claude-thinking-toggle-can-disable',
  name: 'Should disable thinking when thinkingEnabled is false',
  fn: async () => {
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Opus model with thinkingEnabled: false should NOT have thinking config
    const opusParams = {
      model: 'claude-opus-4-1-20250805',
      messages: [],
      max_tokens: 32000
    };

    // Call with thinkingEnabled: false - should NOT add thinking
    const configured = reasoningModule.addThinkingConfigurationWithBudget(opusParams, {
      thinkingEnabled: false
    });

    if (configured.thinking) {
      throw new Error('EXPECTED: Thinking should NOT be added when thinkingEnabled is false');
    }

    debugInfo('✓ Thinking disabled when thinkingEnabled is false');
  }
});

registerTest({
  id: 'claude-thinking-toggle-explicit-enable',
  name: 'Should enable thinking when thinkingEnabled is true',
  fn: async () => {
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Opus model with thinkingEnabled: true should have thinking config
    const opusParams = {
      model: 'claude-opus-4-1-20250805',
      messages: [],
      max_tokens: 32000
    };

    // Call with thinkingEnabled: true - should add thinking
    const configured = reasoningModule.addThinkingConfigurationWithBudget(opusParams, {
      thinkingEnabled: true
    });

    if (!configured.thinking) {
      throw new Error('EXPECTED: Thinking should be enabled when thinkingEnabled is true');
    }
    if (configured.thinking.type !== 'enabled') {
      throw new Error('EXPECTED: Thinking type should be "enabled"');
    }
    if (configured.thinking.budget_tokens !== 8000) {
      throw new Error(`EXPECTED: Budget should be 8000 for Opus, got ${configured.thinking.budget_tokens}`);
    }

    debugInfo('✓ Thinking enabled when thinkingEnabled is true');
  }
});

registerTest({
  id: 'claude-thinking-toggle-non-reasoning-model',
  name: 'Should not add thinking for non-reasoning models regardless of thinkingEnabled',
  fn: async () => {
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    // Haiku model with thinkingEnabled: true should STILL not have thinking
    const haikuParams = {
      model: 'claude-3-haiku-20240307',
      messages: [],
      max_tokens: 4096
    };

    const configured = reasoningModule.addThinkingConfigurationWithBudget(haikuParams, {
      thinkingEnabled: true
    });

    if (configured.thinking) {
      throw new Error('EXPECTED: Non-reasoning models should NOT get thinking config even with thinkingEnabled: true');
    }

    debugInfo('✓ Non-reasoning models do not get thinking config');
  }
});

registerTest({
  id: 'claude-thinking-toggle-preserves-other-params',
  name: 'Should preserve other request parameters when toggling thinking',
  fn: async () => {
    const reasoningModule = await import('../../services/anthropicReasoning.js');

    const originalParams = {
      model: 'claude-opus-4-1-20250805',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 32000,
      system: 'You are helpful'
    };

    // Disable thinking
    const configured = reasoningModule.addThinkingConfigurationWithBudget(originalParams, {
      thinkingEnabled: false
    });

    // Verify all original params are preserved
    if (configured.model !== originalParams.model) {
      throw new Error('EXPECTED: model should be preserved');
    }
    if (configured.max_tokens !== originalParams.max_tokens) {
      throw new Error('EXPECTED: max_tokens should be preserved');
    }
    if (configured.system !== originalParams.system) {
      throw new Error('EXPECTED: system should be preserved');
    }
    if (configured.messages !== originalParams.messages) {
      throw new Error('EXPECTED: messages should be preserved');
    }

    debugInfo('✓ Other parameters preserved when toggling thinking');
  }
});
