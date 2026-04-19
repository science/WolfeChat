/**
 * Migrated from tests-e2e/live/browser-live-smoke.spec.ts
 *
 * Basic smoke tests: input works, send works, response appears.
 * Uses mocked API responses.
 */

import { test, expect } from '@playwright/test';
import { seedAppState, mockResponsesEndpoint } from './mock-helpers';

test.describe('browser smoke tests (mocked)', () => {
  test('can type text into input field', async ({ page }) => {
    await seedAppState(page);
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /chat input/i });
    await expect(input).toBeVisible();
    await input.click({ force: true });

    await page.keyboard.type('H');
    await expect(input).toHaveValue('H');

    await page.keyboard.type('ello');
    await expect(input).toHaveValue('Hello');

    const sendBtn = page.getByRole('button', { name: /send/i });
    await expect(sendBtn).toBeEnabled();
  });

  test('can send a prompt and receive a mocked response', async ({ page }) => {
    await seedAppState(page);
    await mockResponsesEndpoint(page, { streamText: 'Hello there! How can I help?' });
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /chat input/i });
    await expect(input).toBeVisible();
    await input.fill('Say hello');

    const sendBtn = page.getByRole('button', { name: /send/i });
    await sendBtn.click({ force: true });

    // Verify assistant message appeared
    const assistantMsg = page.locator('[role="listitem"][data-message-role="assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 10000 });
  });
});
