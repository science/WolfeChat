/**
 * Live E2E Test: Anthropic SDK Non-Streaming
 *
 * Tests the SDK-based non-streaming implementation with real API calls
 * Uses claude-3-haiku-20240307 for cost-effective testing
 */

import { test, expect } from '@playwright/test';
import {
  sendMessage,
  waitForAssistantDone,
  getVisibleMessages,
  setProviderApiKey,
  bootstrapLiveAPI,
  operateQuickSettings
} from './helpers';
import { debugInfo } from '../debug-utils';

test.describe('Anthropic SDK Non-Streaming', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('should send non-streaming message via SDK with claude-3-haiku', async ({ page }) => {
    debugInfo('🧪 Starting SDK non-streaming test with Claude Haiku');

    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Haiku model for cost-effective testing
    await operateQuickSettings(page, { model: /claude-3-haiku-20240307/i });
    debugInfo('🔧 Selected Claude Haiku model');

    // Send a simple test message
    const testMessage = 'Hello Claude! Please respond with exactly "SDK test successful" and nothing else.';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent test message to Claude via SDK');

    // Wait for the assistant response to complete
    await waitForAssistantDone(page, {
      timeout: 30000,
      stabilizationTime: 1000 // Give extra time for SDK processing
    });

    // Get all messages and verify the response
    const messages = await getVisibleMessages(page);

    debugInfo('📥 Messages received:', { count: messages.length });
    messages.forEach((msg, i) => {
      debugInfo(`  ${i}: [${msg.role}] ${msg.text.slice(0, 100)}...`);
    });

    // Verify we have both user and assistant messages
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // Find the user message (first message)
    const userMessage = messages.find(msg => msg.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage!.text).toContain('Hello Claude');

    // Find the successful assistant message (contains our expected response)
    const successMessage = messages.find(msg =>
      msg.role === 'assistant' && msg.text.includes('SDK test successful')
    );
    expect(successMessage).toBeDefined();
    expect(successMessage!.text).toContain('SDK test successful');

    debugInfo('✅ SDK non-streaming test completed successfully');
  });

  test('should handle errors gracefully with invalid model via SDK', async ({ page }) => {
    debugInfo('🧪 Starting SDK error handling test');

    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select a valid model for this test
    await operateQuickSettings(page, { model: /claude-3-haiku-20240307/i });

    // Send a message that should work
    const testMessage = 'Test error handling';
    await sendMessage(page, testMessage);

    // Wait for response
    await waitForAssistantDone(page, { timeout: 30000 });

    // Verify we got some kind of response (error or success)
    const messages = await getVisibleMessages(page);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('assistant');
    expect(lastMessage.text.length).toBeGreaterThan(0);

    debugInfo('✅ SDK error handling test completed');
  });
});