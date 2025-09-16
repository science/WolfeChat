import { registerTest } from '../testHarness.js';

// Note: appendErrorToHistory was added as part of the fix but is not currently available
// This test will verify the helper function works correctly when the fix is applied

registerTest({
  id: 'api-error-appends-to-history',
  name: 'appendErrorToHistory preserves conversation and adds error message',
  tags: ['non-api', 'error-handling'],
  timeoutMs: 5000,
  fn: async t => {
    // Mock the setHistory function to capture what gets passed to it
    let capturedHistory: any[] = [];
    let capturedConvId: number = -1;

    const mockSetHistory = (history: any[], convId: number) => {
      capturedHistory = history;
      capturedConvId = convId;
      return Promise.resolve();
    };

    // Try to import the helper function that should exist after the fix
    let appendErrorToHistory: any;
    try {
      const service = await import('../../services/openaiService.js');
      appendErrorToHistory = (service as any).appendErrorToHistory;
    } catch (error) {
      // Function doesn't exist - this proves we need the fix
      t.that(false, 'appendErrorToHistory helper function should exist in openaiService.js');
      return;
    }

    if (!appendErrorToHistory) {
      t.that(false, 'appendErrorToHistory helper function should be exported from openaiService.js');
      return;
    }

    // Mock conversation history with some existing messages
    const existingHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'What is 2+2?' }
    ];

    const convId = 0;

    // Replace the real setHistory temporarily
    const originalSetHistory = (await import('../../managers/conversationManager.js')).setHistory;
    (await import('../../managers/conversationManager.js')).setHistory = mockSetHistory as any;

    try {
      // Test 1: Generic error message
      const genericError = new Error('Network connection failed');
      appendErrorToHistory(genericError, existingHistory, convId);

      t.that(capturedHistory.length === existingHistory.length + 1, 'Error message should be appended to existing history');
      t.that(capturedHistory.slice(0, -1).every((msg, i) => msg === existingHistory[i]), 'Original history should be preserved');
      t.that(capturedHistory[capturedHistory.length - 1].role === 'assistant', 'Error message should have assistant role');
      t.that(capturedHistory[capturedHistory.length - 1].content.includes('There was an error: Network connection failed'), 'Generic error should include error message');
      t.that(capturedConvId === convId, 'Conversation ID should be passed correctly');

      // Test 2: API key error gets user-friendly message
      const apiKeyError = new Error('Invalid API key provided');
      appendErrorToHistory(apiKeyError, existingHistory, convId);

      t.that(capturedHistory[capturedHistory.length - 1].content === 'There was an error. Maybe the API key is wrong? Or the servers could be down?', 'API key errors should get user-friendly message');

      // Test 3: Error with no message
      const emptyError = {};
      appendErrorToHistory(emptyError, existingHistory, convId);

      t.that(capturedHistory[capturedHistory.length - 1].content === 'An error occurred while processing your request.', 'Empty error should get default message');

      // Test 4: Error object with no message property
      const noMessageError = { code: 500, status: 'Internal Server Error' };
      appendErrorToHistory(noMessageError, existingHistory, convId);

      t.that(capturedHistory[capturedHistory.length - 1].content === 'An error occurred while processing your request.', 'Error without message property should get default message');

    } finally {
      // Restore original setHistory
      (await import('../../managers/conversationManager.js')).setHistory = originalSetHistory;
    }
  }
});