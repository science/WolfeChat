import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForAssistantDone } from './helpers';
import { debugInfo } from '../debug-utils';

/**
 * TDD Test: Anthropic reasoning windows should auto-close when reasoning completes
 *
 * This test demonstrates that Anthropic reasoning windows should automatically
 * collapse (close) when the main message content starts, just like OpenAI reasoning windows.
 *
 * Expected behavior:
 * - Reasoning window appears during thinking
 * - Window contains reasoning panel with thinking content
 * - When assistant message starts, window automatically collapses
 * - Window remains in DOM but is collapsed (details element has no [open] attribute)
 */

test.describe('Anthropic Reasoning Auto-Close', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('should auto-close reasoning window when assistant message starts', async ({ page }) => {
    test.setTimeout(120000);

    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'Anthropic');

    // Select Claude Sonnet 4.5 (supports reasoning)
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true
    });

    debugInfo('Sending message to trigger reasoning...');
    await sendMessage(page, 'What is 2+2? Think step by step.');

    // Wait for reasoning window to appear
    const reasoningWindow = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindow).toBeVisible({ timeout: 30000 });
    debugInfo('Reasoning window appeared');

    // Verify window is initially open
    const isOpenInitially = await reasoningWindow.getAttribute('open');
    expect(isOpenInitially).not.toBeNull();
    debugInfo('Reasoning window is initially open');

    // Wait for assistant message to complete
    await waitForAssistantDone(page);
    debugInfo('Assistant message completed');

    // Give a small buffer for the auto-close to trigger
    await page.waitForTimeout(1000);

    // ASSERTION: Reasoning window should now be collapsed (auto-closed)
    const isOpenAfterComplete = await reasoningWindow.getAttribute('open');

    if (isOpenAfterComplete === null) {
      debugInfo('✓ Reasoning window auto-closed successfully');
    } else {
      debugInfo('✗ Reasoning window is still open (BUG - should auto-close)');
    }

    expect(isOpenAfterComplete).toBeNull();
  });

  test('should auto-close for multiple consecutive Anthropic messages', async ({ page }) => {
    test.setTimeout(180000);

    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'Anthropic');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true
    });

    // Helper to verify auto-close behavior
    const verifyAutoClose = async (messageNum: number) => {
      const reasoningWindow = page.locator('details:has-text("Reasoning")').nth(messageNum - 1);
      await expect(reasoningWindow).toBeVisible({ timeout: 30000 });

      // Verify initially open
      const isOpenInitially = await reasoningWindow.getAttribute('open');
      expect(isOpenInitially).not.toBeNull();
      debugInfo(`Message ${messageNum}: Reasoning window opened`);

      await waitForAssistantDone(page);
      await page.waitForTimeout(1000);

      // Verify auto-closed
      const isOpenAfterComplete = await reasoningWindow.getAttribute('open');
      expect(isOpenAfterComplete).toBeNull();
      debugInfo(`Message ${messageNum}: Reasoning window auto-closed ✓`);
    };

    debugInfo('Sending message 1...');
    await sendMessage(page, '1+1');
    await verifyAutoClose(1);

    debugInfo('Sending message 2...');
    await sendMessage(page, '2+2');
    await verifyAutoClose(2);
  });
});
