/**
 * Live API Unit Tests - Level 5: Anthropic Error Handling
 *
 * This test verifies that our error handling works correctly with real API calls
 * by testing with invalid API keys and network scenarios.
 */

import { registerTest } from '../testHarness.js';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (hasAnthropicKey) {
  registerTest({
    id: 'anthropic-error-handling-live',
    name: 'Level 5: Anthropic error handling with real API',
    tags: ['live', 'anthropic', 'error-handling'],
    timeoutMs: 10000,
    fn: async (t) => {
      const { appendAnthropicErrorToHistory } = await import('../../services/anthropicMessagingService.js');
      const { get } = await import('svelte/store');
      const { conversations } = await import('../../stores/stores.js');

      const testConvId = 999;
      const currentHistory = [{ role: 'user' as const, content: 'Test message' }];

      // Set up test conversation
      const convs = get(conversations);
      convs[testConvId] = {
        id: testConvId,
        history: [...currentHistory],
        title: 'Test Error Handling'
      };
      conversations.set(convs);

      // Test API key error scenario
      const apiKeyError = new Error('401 Unauthorized - Invalid API key');
      appendAnthropicErrorToHistory(apiKeyError, currentHistory, testConvId);

      // Check the error was properly added
      let updated = get(conversations)[testConvId].history;
      t.that(updated.length === 2, 'Should add error message');
      t.that(updated[1].role === 'assistant', 'Error should be from assistant');
      t.that(updated[1].content.includes('API'), 'Should mention API issue');

      // Reset for next test
      convs[testConvId].history = [...currentHistory];
      conversations.set(convs);

      // Test generic network error
      const networkError = new Error('Network timeout occurred');
      appendAnthropicErrorToHistory(networkError, currentHistory, testConvId);

      updated = get(conversations)[testConvId].history;
      t.that(updated.length === 2, 'Should add network error message');
      t.that(updated[1].content.includes('Network timeout'), 'Should include error details');

      // Reset for final test
      convs[testConvId].history = [...currentHistory];
      conversations.set(convs);

      // Test error with no message
      const emptyError = new Error();
      appendAnthropicErrorToHistory(emptyError, currentHistory, testConvId);

      updated = get(conversations)[testConvId].history;
      t.that(updated.length === 2, 'Should add default error message');
      t.that(updated[1].content.includes('error occurred'), 'Should have default error text');

      // Clean up
      const finalConvs = get(conversations);
      delete finalConvs[testConvId];
      conversations.set(finalConvs);

      console.log('✓ Anthropic error handling works with real API context');
    }
  });

  registerTest({
    id: 'anthropic-error-message-formatting-live',
    name: 'Level 5: Anthropic error message formatting',
    tags: ['live', 'anthropic', 'error-formatting'],
    timeoutMs: 5000,
    fn: async (t) => {
      const { appendAnthropicErrorToHistory } = await import('../../services/anthropicMessagingService.js');
      const { get } = await import('svelte/store');
      const { conversations } = await import('../../stores/stores.js');

      const testConvId = 998;
      const currentHistory = [{ role: 'user' as const, content: 'Hello' }];

      // Set up test conversation
      const convs = get(conversations);
      convs[testConvId] = {
        id: testConvId,
        history: [...currentHistory],
        title: 'Test Error Formatting'
      };
      conversations.set(convs);

      // Test API key error formatting - should get user-friendly message
      const apiKeyError = new Error('API key not found');
      appendAnthropicErrorToHistory(apiKeyError, [...currentHistory], testConvId);

      let updated = get(conversations)[testConvId].history;
      const errorMessage1 = updated[1];
      t.that(errorMessage1.role === 'assistant', 'Error message should be from assistant');
      t.that(errorMessage1.content.includes('API'), 'Should mention API in user-friendly way');
      t.that(errorMessage1.content.includes('wrong') || errorMessage1.content.includes('down'), 'Should be user-friendly');

      // Reset for generic error test
      convs[testConvId].history = [...currentHistory];
      conversations.set(convs);

      // Test generic error formatting - should include original message
      const genericError = new Error('Connection refused by server');
      appendAnthropicErrorToHistory(genericError, [...currentHistory], testConvId);

      updated = get(conversations)[testConvId].history;
      const errorMessage2 = updated[1];
      t.that(errorMessage2.content.includes('Connection refused'), 'Should include original error message');

      // Clean up
      delete convs[testConvId];
      conversations.set(convs);

      console.log('✓ Error message formatting working correctly');
    }
  });
}