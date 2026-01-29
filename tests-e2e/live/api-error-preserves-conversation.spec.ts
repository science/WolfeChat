import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  sendMessage,
  getVisibleMessages,
  waitForAssistantDone,
  openSettings
} from './helpers';
import { debugInfo, debugWarn } from '../debug-utils';

test.describe('API Error Handling', () => {
  test('Invalid API key preserves conversation history', async ({ page }) => {
    // Bootstrap with valid API key first
    await page.goto('http://localhost:5173');
    await bootstrapLiveAPI(page);

    // Send a message to build conversation history
    await sendMessage(page, "Hello, this is my first message");
    await waitForAssistantDone(page, { timeout: 30000 });

    // Get the current conversation state
    const messagesBeforeError = await getVisibleMessages(page);
    debugInfo(`Messages before error: ${messagesBeforeError.length}`);
    debugInfo(`Message details:`, { messages: messagesBeforeError.map(m => `${m.role}: ${m.text.substring(0, 50)}...`) });

    // Should have at least 2 messages (1 user + 1 assistant)
    expect(messagesBeforeError.length).toBeGreaterThanOrEqual(2);

    // Verify we have the expected conversation content
    const hasFirstMessage = messagesBeforeError.some(msg =>
      msg.role === 'user' && msg.text.includes('Hello, this is my first message')
    );
    const hasAssistantResponse = messagesBeforeError.some(msg =>
      msg.role === 'assistant' && msg.text.length > 0
    );

    expect(hasFirstMessage).toBe(true);
    expect(hasAssistantResponse).toBe(true);

    // Now change to an invalid API key to trigger an error
    await openSettings(page);

    // Find the API key input and replace with invalid key
    const apiInput = page.locator('#api-key');
    await expect(apiInput).toBeVisible();
    await apiInput.fill('sk-invalid-key-for-testing-error-handling');

    // Save and close settings
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });
    await expect(page.getByRole('heading', { name: /settings/i })).toBeHidden({ timeout: 5000 });

    // Send a message that will cause an API error
    await sendMessage(page, "This message should trigger an API error");

    // Wait for the error response (might take a bit for the API to reject)
    await waitForAssistantDone(page, { timeout: 15000 });

    // Get messages after the error
    const messagesAfterError = await getVisibleMessages(page);
    debugInfo(`Messages after error: ${messagesAfterError.length}`);
    debugInfo(`All messages after error:`, { messages: messagesAfterError.map(m => `${m.role}: "${m.text}"`) });

    // Test the behavior based on whether the fix is in place
    const hasErrorMessage = messagesAfterError.some(msg =>
      msg.role === 'assistant' &&
      (msg.text.includes('error') ||
       msg.text.includes('API key') ||
       msg.text.includes('wrong') ||
       msg.text.includes('servers could be down'))
    );

    if (hasErrorMessage) {
      // Fix is in place - verify proper error handling
      debugInfo('✓ Fix is in place - testing proper error handling');

      // Should have MORE messages than before (original + error message)
      expect(messagesAfterError.length).toBeGreaterThan(messagesBeforeError.length);

      // Original messages should still be preserved
      const stillHasFirstMessage = messagesAfterError.some(msg =>
        msg.role === 'user' && msg.text.includes('Hello, this is my first message')
      );
      const stillHasAssistantResponse = messagesAfterError.some(msg =>
        msg.role === 'assistant' && !msg.text.toLowerCase().includes('error') && msg.text.length > 0
      );

      expect(stillHasFirstMessage).toBe(true);
      expect(stillHasAssistantResponse).toBe(true);

      // Should have the user message that triggered the error
      const hasErrorTriggerMessage = messagesAfterError.some(msg =>
        msg.role === 'user' && msg.text.includes('This message should trigger an API error')
      );
      expect(hasErrorTriggerMessage).toBe(true);

      // Should have an appropriate error message from assistant
      expect(hasErrorMessage).toBe(true);

      debugInfo('✓ All error handling assertions passed - fix is working correctly');

    } else {
      // Fix is NOT in place - this demonstrates the bug
      debugWarn('❌ Bug detected: No error message found in conversation');

      // Without the fix, the conversation might be empty or missing messages
      // This proves the bug exists
      debugInfo('Messages before error:', { count: messagesBeforeError.length });
      debugInfo('Messages after error:', { count: messagesAfterError.length });

      // This assertion will fail when the bug exists, proving the bug
      expect(hasErrorMessage).toBe(true); // This will fail, proving the bug exists
    }
  });

  test('Network error during streaming preserves conversation', async ({ page }) => {
    // This test simulates what happens when streaming is interrupted
    await page.goto('http://localhost:5173');
    await bootstrapLiveAPI(page);

    // Build some conversation history first
    await sendMessage(page, "Tell me about the weather");
    await waitForAssistantDone(page, { timeout: 30000 });

    const messagesBeforeError = await getVisibleMessages(page);

    // Now set up an invalid API key to trigger streaming error
    await openSettings(page);
    const apiInput = page.locator('#api-key');
    await apiInput.fill('sk-definitely-invalid-key-123');

    // Save and close settings
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });
    await expect(page.getByRole('heading', { name: /settings/i })).toBeHidden({ timeout: 5000 });

    // Try to send a message that will fail during streaming
    await sendMessage(page, "This should fail during streaming");

    // Wait for the failure to be processed
    await waitForAssistantDone(page, { timeout: 15000 });

    const messagesAfterError = await getVisibleMessages(page);

    // Check if error handling is in place
    const hasErrorInConversation = messagesAfterError.some(msg =>
      msg.role === 'assistant' &&
      (msg.text.toLowerCase().includes('error') ||
       msg.text.toLowerCase().includes('api key'))
    );

    if (hasErrorInConversation) {
      // Fix is working - verify conversation preservation
      expect(messagesAfterError.length).toBeGreaterThan(messagesBeforeError.length);

      // Original weather message should still be there
      const hasWeatherMessage = messagesAfterError.some(msg =>
        msg.text.includes('Tell me about the weather')
      );
      expect(hasWeatherMessage).toBe(true);

      debugInfo('✓ Streaming error handled correctly - conversation preserved');
    } else {
      // Bug exists - streaming error caused conversation issues
      debugWarn('❌ Streaming error handling bug detected');

      // This will fail when bug exists, demonstrating the issue
      expect(hasErrorInConversation).toBe(true);
    }
  });
});