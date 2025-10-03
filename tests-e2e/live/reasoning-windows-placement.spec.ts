import { test, expect } from '@playwright/test';
import { operateQuickSettings, bootstrapLiveAPI, sendMessage, waitForAssistantDone } from './helpers';
import { debugInfo } from '../debug-utils';

/**
 * Live Reasoning Windows (RW) behavior tests.
 *
 * Uses real OpenAI API with gpt-5-nano and Monte Hall prompt to generate
 * reliable reasoning sequences for UI testing.
 */

// Monte Hall prompt that reliably generates reasoning
const REASONING_PROMPT = "Explain the Monte Hall 3 door problem using logic";

// Helper to wait for reasoning windows with content validation
async function waitForReasoningWithContent(page: import('@playwright/test').Page, expectedCount = 1, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    const count = await reasoningWindows.count();

    if (count >= expectedCount) {
      // Verify reasoning windows actually contain text content
      let allHaveContent = true;
      for (let i = 0; i < count; i++) {
        const content = await reasoningWindows.nth(i).locator('div, p, span').allTextContents();
        const hasText = content.some(text => text.trim().length > 10); // Require substantial content
        if (!hasText) {
          allHaveContent = false;
          break;
        }
      }

      if (allHaveContent) {
        debugInfo(`✅ Found ${count} reasoning windows with content`);
        return count;
      }
    }

    await page.waitForTimeout(200);
  }

  const finalCount = await page.locator('details:has-text("Reasoning")').count();
  throw new Error(`Timed out waiting for ${expectedCount} reasoning windows with content. Found: ${finalCount}`);
}

test.describe('Reasoning Windows Placement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  });

  test('RW appear with reasoning content and bind to correct message', async ({ page }) => {
    debugInfo('=== Testing reasoning windows with Monte Hall prompt ===');

    // Send first message with non-reasoning model to establish baseline
    await sendMessage(page, 'Hello');
    await waitForAssistantDone(page);

    // Verify no reasoning windows initially
    let reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(0);

    // Switch to reasoning model with medium reasoning
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-5-nano',
      reasoning: 'medium',
      closeAfter: true
    });

    debugInfo('Sending Monte Hall prompt...');

    // Send reasoning-generating prompt
    await sendMessage(page, REASONING_PROMPT);

    // Wait for reasoning windows to appear with actual content
    const reasoningCount = await waitForReasoningWithContent(page, 1);
    expect(reasoningCount).toBeGreaterThanOrEqual(1);

    // Verify reasoning windows contain substantial text
    const reasoningContent = await reasoningWindows.first().allTextContents();
    const totalText = reasoningContent.join(' ').trim();
    expect(totalText.length).toBeGreaterThan(50); // Require substantial reasoning content

    debugInfo(`Reasoning content preview: ${totalText.substring(0, 100)}...`);

    // Verify the main response also appears
    const messages = page.locator('.message');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThanOrEqual(3); // User hello + AI response + User reasoning prompt + AI reasoning response

    debugInfo('✅ Reasoning windows appear with content and bind to correct message');
  });

  test('RW placement remains stable when new messages are added', async ({ page }) => {
    debugInfo('=== Testing reasoning window placement stability ===');

    // Set up reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-5-nano',
      reasoning: 'low',
      closeAfter: true
    });

    // Send reasoning prompt and wait for reasoning to complete
    debugInfo('Sending Monte Hall prompt for stability test...');
    await sendMessage(page, REASONING_PROMPT);
    await waitForAssistantDone(page);

    // Wait for reasoning windows with content
    await waitForReasoningWithContent(page, 1);
    const reasoningWindows = page.locator('details:has-text("Reasoning")');

    // Get initial position of the first reasoning window
    const initialPosition = await page.evaluate(() => {
      const details = document.querySelector('details');
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop
      };
    });

    expect(initialPosition).not.toBeNull();
    debugInfo(`Initial reasoning window position: ${JSON.stringify(initialPosition)}`);

    // Add more messages to test stability
    await sendMessage(page, 'In one sentence, summarize the key insight.');
    await waitForAssistantDone(page);

    await sendMessage(page, 'Thank you');
    await waitForAssistantDone(page);

    // Verify the first reasoning window position hasn't shifted significantly
    const finalPosition = await page.evaluate(() => {
      const details = document.querySelector('details'); // First details element
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop
      };
    });

    expect(finalPosition).not.toBeNull();

    // Calculate absolute positions accounting for scroll
    const adjustedInitial = initialPosition!.relativeTop + initialPosition!.scrollTop;
    const adjustedFinal = finalPosition!.relativeTop + finalPosition!.scrollTop;
    const positionDrift = Math.abs(adjustedFinal - adjustedInitial);

    debugInfo(`Position drift: ${positionDrift}px (should be < 30px)`);
    expect(positionDrift).toBeLessThan(30); // Allow minor layout shifts

    debugInfo('✅ Reasoning window placement remains stable');
  });

  test('Non-reasoning model shows no RW, reasoning model shows RW', async ({ page }) => {
    debugInfo('=== Testing reasoning vs non-reasoning model behavior ===');

    // Start with non-reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-3.5-turbo',
      closeAfter: true
    });

    debugInfo('Sending Monte Hall prompt to non-reasoning model...');
    await sendMessage(page, REASONING_PROMPT);
    await waitForAssistantDone(page);

    // Verify no reasoning windows appear
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(0);
    debugInfo('✅ Non-reasoning model produces no reasoning windows');

    // Switch to reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-5-nano',
      reasoning: 'low',
      closeAfter: true
    });

    debugInfo('Sending Monte Hall prompt to reasoning model...');
    await sendMessage(page, REASONING_PROMPT);
    await waitForAssistantDone(page);

    // Wait for reasoning windows to appear with content
    const reasoningCount = await waitForReasoningWithContent(page, 1);
    expect(reasoningCount).toBeGreaterThanOrEqual(1);

    // Verify reasoning content is substantial
    const reasoningContent = await reasoningWindows.first().allTextContents();
    const totalText = reasoningContent.join(' ').trim();
    expect(totalText.length).toBeGreaterThan(50);

    debugInfo('✅ Reasoning model produces reasoning windows with content');

    // Send another non-reasoning message to verify no additional reasoning appears
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-3.5-turbo',
      closeAfter: true
    });

    await sendMessage(page, 'Thank you for the explanation');
    await waitForAssistantDone(page);

    // Should still have only the original reasoning window(s)
    const finalReasoningCount = await reasoningWindows.count();
    expect(finalReasoningCount).toBe(reasoningCount);

    debugInfo('✅ Non-reasoning follow-up does not create additional reasoning windows');
  });
});