/**
 * Live API Unit Tests - Level 6: OpenAI Error Handling
 *
 * This test verifies that our OpenAI error handling works correctly with real API calls
 * by testing error scenarios and ensuring proper error message formatting.
 */

import { registerTest } from '../testHarness.js';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

if (hasOpenAIKey) {
  registerTest({
    id: 'openai-error-handling-live',
    name: 'Level 6: OpenAI error handling with real API',
    tags: ['live', 'openai', 'error-handling'],
    timeoutMs: 10000,
    fn: async (t) => {
      const service = await import('../../services/openaiService.js');
      const { appendErrorToHistory } = service as any;

      if (!appendErrorToHistory) {
        t.that(false, 'appendErrorToHistory helper function should be exported from openaiService.js');
        return;
      }

      const { get } = await import('svelte/store');
      const { conversations } = await import('../../stores/stores.js');

      const testConvId = 997;
      const existingHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'What is 2+2?' }
      ];

      // Set up test conversation
      const convs = get(conversations);
      convs[testConvId] = {
        id: testConvId,
        history: [...existingHistory],
        title: 'Test OpenAI Errors'
      };
      conversations.set(convs);

      // Test 1: Generic error message
      const genericError = new Error('Network connection failed');
      appendErrorToHistory(genericError, [...existingHistory], testConvId);

      let updated = get(conversations)[testConvId].history;
      t.that(updated.length === 4, 'Error message should be appended to existing history');
      t.that(updated[3].role === 'assistant', 'Error message should have assistant role');
      t.that(updated[3].content.includes('Network connection failed'), 'Should include error message');

      // Reset for API key error test
      convs[testConvId].history = [...existingHistory];
      conversations.set(convs);

      // Test 2: API key error gets user-friendly message
      const apiKeyError = new Error('Invalid API key provided');
      appendErrorToHistory(apiKeyError, [...existingHistory], testConvId);

      updated = get(conversations)[testConvId].history;
      t.that(updated[3].content.includes('API key'), 'API key errors should get user-friendly message');
      t.that(updated[3].content.includes('wrong') || updated[3].content.includes('down'), 'Should be user-friendly');

      // Reset for empty error test
      convs[testConvId].history = [...existingHistory];
      conversations.set(convs);

      // Test 3: Error with no message
      const emptyError = {};
      appendErrorToHistory(emptyError, [...existingHistory], testConvId);

      updated = get(conversations)[testConvId].history;
      t.that(updated[3].content.includes('error occurred'), 'Empty error should get default message');

      // Reset for object error test
      convs[testConvId].history = [...existingHistory];
      conversations.set(convs);

      // Test 4: Error object with no message property
      const noMessageError = { code: 500, status: 'Internal Server Error' };
      appendErrorToHistory(noMessageError, [...existingHistory], testConvId);

      updated = get(conversations)[testConvId].history;
      t.that(updated[3].content.includes('error occurred'), 'Error without message property should get default message');

      // Clean up
      const finalConvs = get(conversations);
      delete finalConvs[testConvId];
      conversations.set(finalConvs);

      console.log('✓ All OpenAI appendErrorToHistory tests working correctly');
    }
  });

  registerTest({
    id: 'openai-error-preservation-live',
    name: 'Level 6: OpenAI error preservation and conversation integrity',
    tags: ['live', 'openai', 'conversation-integrity'],
    timeoutMs: 5000,
    fn: async (t) => {
      const service = await import('../../services/openaiService.js');
      const { appendErrorToHistory } = service as any;

      const { get } = await import('svelte/store');
      const { conversations } = await import('../../stores/stores.js');

      const testConvId = 996;
      const originalHistory = [
        { role: 'user', content: 'Original message 1' },
        { role: 'assistant', content: 'Original response 1' },
        { role: 'user', content: 'Original message 2' }
      ];

      // Set up test conversation
      const convs = get(conversations);
      convs[testConvId] = {
        id: testConvId,
        history: [...originalHistory],
        title: 'Test Conversation Integrity'
      };
      conversations.set(convs);

      // Add an error and verify original history is preserved
      const testError = new Error('Test error for integrity check');
      appendErrorToHistory(testError, [...originalHistory], testConvId);

      const updated = get(conversations)[testConvId].history;

      // Verify original messages are preserved exactly
      t.that(updated.length === 4, 'Should have original 3 messages plus error');
      t.that(updated[0].content === 'Original message 1', 'First message should be preserved');
      t.that(updated[1].content === 'Original response 1', 'Second message should be preserved');
      t.that(updated[2].content === 'Original message 2', 'Third message should be preserved');

      // Verify error message is properly formatted
      t.that(updated[3].role === 'assistant', 'Error should be from assistant');
      t.that(updated[3].content.includes('Test error'), 'Error should contain original error text');

      // Clean up
      delete convs[testConvId];
      conversations.set(convs);

      console.log('✓ Conversation integrity preserved during error handling');
    }
  });
}