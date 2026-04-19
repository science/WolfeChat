/**
 * Migrated from tests-e2e/live/input-clearing-test.spec.ts
 *
 * Tests that sequential message sends clear input correctly.
 * Uses mocked API responses — only cares about UI state, not response content.
 */

import { test, expect } from '@playwright/test';
import { seedAppState, mockResponsesEndpoint } from './mock-helpers';

test('sequential sends clear input after each message', async ({ page }) => {
  await seedAppState(page, { selectedModel: 'gpt-4.1-nano' });
  await mockResponsesEndpoint(page, { streamText: 'Mock response.' });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const input = page.getByRole('textbox', { name: /chat input/i });
  await expect(input).toBeVisible();

  const sendButton = page.getByRole('button', { name: /send/i });

  // Helper: send a message and wait for assistant response
  async function sendAndWait(text: string, expectedCount: number) {
    await input.fill(text);
    await sendButton.click({ force: true });

    // Wait for the expected number of assistant messages with content
    await expect(async () => {
      const count = await page.evaluate((min) => {
        const msgs = document.querySelectorAll('[role="listitem"][data-message-role="assistant"]');
        if (msgs.length < min) return 0;
        // Check last message has content
        const last = msgs[msgs.length - 1];
        return (last.textContent || '').trim().length > 0 ? msgs.length : 0;
      }, expectedCount);
      expect(count).toBeGreaterThanOrEqual(expectedCount);
    }).toPass({ timeout: 10000 });

    // Wait for input to be cleared (streaming complete)
    await expect(input).toHaveValue('', { timeout: 5000 });
  }

  // Send 1
  await sendAndWait('Explain Monty Hall in one sentence', 1);

  // Send 2
  await sendAndWait('Summarize in three words', 2);

  // Send 3
  await sendAndWait('Thank you', 3);

  const assistantCount = await page.evaluate(() =>
    document.querySelectorAll('[data-message-role="assistant"]').length
  );
  expect(assistantCount).toBeGreaterThanOrEqual(3);
});
