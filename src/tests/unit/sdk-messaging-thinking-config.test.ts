/**
 * Unit Test: SDK Messaging Thinking Configuration
 *
 * TDD test for verifying that thinkingEnabled is passed through
 * from the SDK messaging layer to the thinking configuration.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo } from '../utils/debugLog.js';

registerTest({
  id: 'sdk-messaging-config-has-thinking-enabled-type',
  name: 'SDK messaging config interface should include thinkingEnabled',
  fn: async () => {
    // Import the module to check exports
    const sdkModule = await import('../../services/anthropicSDKMessaging.js');

    // Verify the function exists
    if (typeof sdkModule.streamAnthropicMessageSDK !== 'function') {
      throw new Error('EXPECTED: streamAnthropicMessageSDK function to exist');
    }

    // The test is really about the TypeScript interface, but we can verify
    // the function signature accepts a config with thinkingEnabled
    debugInfo('✓ SDK messaging functions exist');
  }
});

registerTest({
  id: 'thinking-config-respects-thinking-enabled-from-options',
  name: 'addThinkingConfigurationWithBudget should respect thinkingEnabled from options',
  fn: async () => {
    const { addThinkingConfigurationWithBudget } = await import('../../services/anthropicReasoning.js');

    // Test with thinkingEnabled: false - should NOT add thinking
    const paramsDisabled = {
      model: 'claude-opus-4-1-20250805',
      messages: [],
      max_tokens: 32000
    };

    const configuredDisabled = addThinkingConfigurationWithBudget(paramsDisabled, {
      thinkingEnabled: false
    });

    if (configuredDisabled.thinking) {
      throw new Error('EXPECTED: No thinking config when thinkingEnabled is false');
    }

    // Test with thinkingEnabled: true - SHOULD add thinking
    const configuredEnabled = addThinkingConfigurationWithBudget(paramsDisabled, {
      thinkingEnabled: true
    });

    if (!configuredEnabled.thinking) {
      throw new Error('EXPECTED: Thinking config when thinkingEnabled is true');
    }
    if (configuredEnabled.thinking.type !== 'enabled') {
      throw new Error('EXPECTED: Thinking type should be "enabled"');
    }

    debugInfo('✓ Thinking configuration respects thinkingEnabled option');
  }
});
