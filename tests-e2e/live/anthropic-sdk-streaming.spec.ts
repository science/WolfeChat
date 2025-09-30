/**
 * Live E2E Test: Anthropic SDK Streaming with Reasoning
 *
 * Tests the SDK-based streaming implementation with real API calls
 * Verifies reasoning window functionality for supported models
 *
 * TDD Approach: These tests describe the EXPECTED behavior
 * If they fail initially, that proves the bug exists and guides the fix
 */

import { test, expect } from '@playwright/test';
import {
  sendMessage,
  waitForAssistantDone,
  getVisibleMessages,
  setProviderApiKey,
  bootstrapLiveAPI,
  operateQuickSettings,
  waitForStreamComplete
} from './helpers';
import { debugInfo } from '../debug-utils';

test.describe('Anthropic SDK Streaming with Reasoning', () => {

  test('should stream response and show reasoning window with Sonnet 4.5', async ({ page }) => {
    // This test describes EXPECTED behavior: Sonnet 4.5 should show reasoning window
    debugInfo('🧪 Starting streaming test with reasoning model (Sonnet 4.5)');

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Sonnet 4.5 model (supports reasoning)
    await operateQuickSettings(page, { model: /claude-sonnet-4-5-20250929/i });
    debugInfo('🔧 Selected Claude Sonnet 4.5 model (reasoning supported)');

    // Send a message that should trigger reasoning
    const testMessage = 'What is 2+2? Think step by step before answering.';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent test message to trigger reasoning');

    // Wait for the streaming to complete first
    await waitForAssistantDone(page, { timeout: 30000 });
    debugInfo('✅ Streaming completed');

    // EXPECTED: Reasoning window should appear for Sonnet 4.5
    // Check for reasoning window using semantic ARIA selector
    const reasoningWindow = await page.locator('[role="region"][aria-label*="Reasoning window"]').first();
    const isVisible = await reasoningWindow.isVisible().catch(() => false);

    // Assert: Reasoning window SHOULD appear for Sonnet 4.5
    expect(isVisible).toBe(true);
    debugInfo('✅ Reasoning window appeared as expected');

    // Check if reasoning text is being populated
    if (isVisible) {
      const reasoningText = await reasoningWindow.textContent();
      debugInfo(`📝 Reasoning text content: ${reasoningText?.slice(0, 100)}...`);

      // Assert: Reasoning text should not be empty
      expect(reasoningText).toBeTruthy();
      expect(reasoningText!.length).toBeGreaterThan(10);
    }

    // Verify we got a response
    const messages = await getVisibleMessages(page);
    const assistantMessage = messages.find(msg => msg.role === 'assistant');

    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.text).toContain('4');

    debugInfo('✅ Sonnet 4.5 streaming with reasoning completed successfully');
  });

  test('should stream without reasoning window for Haiku model', async ({ page }) => {
    // This test verifies that non-reasoning models don't show reasoning window
    debugInfo('🧪 Starting streaming test with non-reasoning model (Haiku)');

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Haiku model (does NOT support reasoning)
    await operateQuickSettings(page, { model: /claude-3-haiku-20240307/i });
    debugInfo('🔧 Selected Claude Haiku model (no reasoning support)');

    // Send a simple message
    const testMessage = 'Say "Hello streaming!" and nothing else.';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent test message');

    // EXPECTED: No reasoning window should appear for Haiku
    // Check that reasoning window does NOT appear
    const reasoningWindow = await page.waitForSelector(
      '[data-testid="reasoning-window"], .reasoning-window, [class*="reasoning"]',
      {
        timeout: 3000,
        state: 'visible'
      }
    ).catch(() => null);

    // Assert: Reasoning window should NOT appear for Haiku
    expect(reasoningWindow).toBeNull();
    debugInfo('✅ No reasoning window appeared (correct for Haiku)');

    // Wait for streaming to complete
    await waitForStreamComplete(page, { timeout: 30000 });

    // Verify we got the expected response
    const messages = await getVisibleMessages(page);
    const assistantMessage = messages.find(msg => msg.role === 'assistant');

    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.text).toContain('Hello streaming!');

    debugInfo('✅ Haiku streaming without reasoning completed successfully');
  });

  test('should show progressive text accumulation during streaming', async ({ page }) => {
    // This test verifies that text appears progressively during streaming
    debugInfo('🧪 Testing progressive text accumulation during streaming');

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Haiku for faster streaming
    await operateQuickSettings(page, { model: /claude-3-haiku-20240307/i });

    // Send a message that will produce a longer response
    const testMessage = 'Count from 1 to 10, one number per line.';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent message for progressive streaming test');

    // Track text accumulation
    const textSnapshots: string[] = [];
    let previousText = '';

    // Monitor assistant message for changes
    const checkInterval = setInterval(async () => {
      const messages = await getVisibleMessages(page);
      const assistantMessage = messages.find(msg => msg.role === 'assistant');

      if (assistantMessage && assistantMessage.text !== previousText) {
        textSnapshots.push(assistantMessage.text);
        previousText = assistantMessage.text;
        debugInfo(`📊 Text snapshot ${textSnapshots.length}: ${assistantMessage.text.length} chars`);
      }
    }, 500);

    // Wait for streaming to complete
    await waitForStreamComplete(page, { timeout: 30000 });
    clearInterval(checkInterval);

    // Assert: We should have captured multiple snapshots showing progressive text
    expect(textSnapshots.length).toBeGreaterThan(2);
    debugInfo(`✅ Captured ${textSnapshots.length} text snapshots during streaming`);

    // Verify text was accumulated progressively (each snapshot longer than previous)
    for (let i = 1; i < textSnapshots.length; i++) {
      expect(textSnapshots[i].length).toBeGreaterThanOrEqual(textSnapshots[i - 1].length);
    }

    debugInfo('✅ Progressive text accumulation verified');
  });

  test('should handle stream interruption gracefully', async ({ page }) => {
    // This test verifies that streaming can be interrupted
    debugInfo('🧪 Testing stream interruption handling');

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Haiku for testing
    await operateQuickSettings(page, { model: /claude-3-haiku-20240307/i });

    // Send a message that will produce a long response
    const testMessage = 'Write a detailed 500-word essay about artificial intelligence.';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent message for stream interruption test');

    // Wait for streaming to start
    await page.waitForTimeout(2000);

    // Check if stop button exists (common pattern for streaming UIs)
    const stopButton = await page.$('[data-testid="stop-streaming"], button:has-text("Stop"), .stop-button');

    if (stopButton) {
      debugInfo('🛑 Found stop button, clicking to interrupt stream');
      await stopButton.click();

      // Wait a moment for stream to stop
      await page.waitForTimeout(1000);

      // Verify streaming has stopped
      const messages = await getVisibleMessages(page);
      const assistantMessage = messages.find(msg => msg.role === 'assistant');

      expect(assistantMessage).toBeDefined();
      // Message should exist but likely be incomplete
      expect(assistantMessage!.text.length).toBeGreaterThan(0);
      expect(assistantMessage!.text.length).toBeLessThan(2000); // Should be interrupted, not full essay

      debugInfo('✅ Stream interruption handled successfully');
    } else {
      // If no stop button, verify streaming completes normally
      await waitForStreamComplete(page, { timeout: 45000 });
      debugInfo('⚠️ No stop button found, stream completed normally');
    }
  });

  test('should properly display reasoning summary in collapsible format', async ({ page }) => {
    // This test verifies the reasoning display format for Sonnet 4.5
    debugInfo('🧪 Testing reasoning display format with Sonnet 4.5');

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bootstrap the live API environment with Anthropic
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Sonnet 4.5 model (supports reasoning)
    await operateQuickSettings(page, { model: /claude-sonnet-4-5-20250929/i });

    // Send a complex message that requires reasoning
    const testMessage = 'Solve this step by step: If a train travels 60 mph for 2 hours, then 80 mph for 1 hour, what is the total distance?';
    await sendMessage(page, testMessage);

    debugInfo('📤 Sent complex problem requiring reasoning');

    // Wait for reasoning to appear
    const reasoningElement = await page.waitForSelector(
      '[data-testid="reasoning-window"], .reasoning-window, .reasoning-collapsible, [class*="reasoning"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (reasoningElement) {
      // Check if reasoning is collapsible
      const isCollapsible = await reasoningElement.evaluate(el => {
        return el.classList.contains('collapsible') ||
               el.classList.contains('reasoning-collapsible') ||
               el.querySelector('[data-testid="expand-reasoning"]') !== null;
      });

      debugInfo(`📋 Reasoning element found, collapsible: ${isCollapsible}`);

      // If collapsible, try to expand it
      if (isCollapsible) {
        const expandButton = await page.$('[data-testid="expand-reasoning"], .expand-reasoning, button:has-text("Show reasoning")');
        if (expandButton) {
          await expandButton.click();
          await page.waitForTimeout(500);
          debugInfo('🔽 Expanded reasoning section');
        }
      }

      // Check reasoning content
      const reasoningText = await reasoningElement.textContent();
      expect(reasoningText).toBeTruthy();
      expect(reasoningText!.toLowerCase()).toMatch(/step|think|calculate|reason/);

      debugInfo('✅ Reasoning display format verified');
    } else {
      // Fail the test if reasoning should appear but doesn't
      throw new Error('Expected reasoning window for Sonnet 4.5 model but none appeared');
    }

    // Wait for final response
    await waitForStreamComplete(page, { timeout: 30000 });

    // Verify the calculation is correct
    const messages = await getVisibleMessages(page);
    const assistantMessage = messages.find(msg => msg.role === 'assistant');

    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.text).toContain('200'); // 60*2 + 80*1 = 200 miles

    debugInfo('✅ Reasoning with calculation completed successfully');
  });
});