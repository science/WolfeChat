/**
 * Migrated from tests-e2e/live/clear-new-chat-input.spec.ts
 *
 * Tests Clear Chat and New Chat button input clearing behavior.
 * No real API calls needed — one test sends a message (mocked).
 */

import { test, expect } from '@playwright/test';
import { seedAppState, mockResponsesEndpoint } from './mock-helpers';

test.describe('Clear/New Chat Input Box Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppState(page);
    await mockResponsesEndpoint(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  async function getChatInput(page: any) {
    const selectors = [
      () => page.getByRole('textbox', { name: /chat input/i }),
      () => page.locator('textarea[aria-label="Chat input"]').first(),
      () => page.locator('textarea[placeholder*="Type your message"]').first(),
    ];

    for (const selector of selectors) {
      const locator = await selector();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    throw new Error('Could not find chat input textbox');
  }

  test.describe('Clear Chat Button Tests', () => {
    test('should clear input when clicking Clear Chat button in sidebar', async ({ page }) => {
      const input = await getChatInput(page);
      const testMessage = 'Test message that should be cleared';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await expect(clearButton).toBeVisible();
      await clearButton.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should clear input when clicking Clear Chat button in QuickSettings', async ({ page }) => {
      const input = await getChatInput(page);
      const testMessage = 'Another test message for QuickSettings';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);

      const quickSettingsToggle = page.locator('button[aria-controls="quick-settings-body"]');
      if (await quickSettingsToggle.isVisible().catch(() => false)) {
        await quickSettingsToggle.click({ force: true });
        {
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            const visible = await page.locator('#quick-settings-body').isVisible().catch(() => false);
            if (visible) break;
            await page.waitForTimeout(200);
          }
        }
      }

      const clearButtonQuickSettings = page.locator('#quick-settings-body button[aria-label="Clear Conversation"]').first();
      await expect(clearButtonQuickSettings).toBeVisible();
      await clearButtonQuickSettings.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should clear input with partially typed message', async ({ page }) => {
      const input = await getChatInput(page);
      const partialMessage = 'This is a partial mes';
      await input.fill(partialMessage);
      await expect(input).toHaveValue(partialMessage);

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await clearButton.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should clear input with multi-line text', async ({ page }) => {
      const input = await getChatInput(page);
      const multiLineMessage = 'Line 1\nLine 2\nLine 3 with more text';
      await input.fill(multiLineMessage);
      await expect(input).toHaveValue(multiLineMessage);

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await clearButton.click({ force: true });

      await expect(input).toHaveValue('');
    });
  });

  test.describe('New Chat Button Tests', () => {
    test('should clear input when clicking New Chat button in sidebar', async ({ page }) => {
      const input = await getChatInput(page);
      const testMessage = 'Test message for new chat';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await expect(newChatButton).toBeVisible();
      await newChatButton.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should clear input when clicking New Chat button in mobile topbar', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const input = await getChatInput(page);
      const testMessage = 'Mobile test message';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);

      const newChatTopbar = page.locator('button:has(img[alt="+"])').first();
      await expect(newChatTopbar).toBeVisible();
      await newChatTopbar.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should clear input after conversation with messages', async ({ page }) => {
      const input = await getChatInput(page);
      await input.fill('Hello, this is my first message');

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click({ force: true });

      // Wait for mock response to complete
      await page.waitForTimeout(1000);

      const newMessage = 'This should be cleared when starting new chat';
      await input.fill(newMessage);
      await expect(input).toHaveValue(newMessage);

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click({ force: true });

      await expect(input).toHaveValue('');
    });
  });

  test.describe('Edge Cases', () => {
    test('should clear input with special characters and emojis', async ({ page }) => {
      const input = await getChatInput(page);
      const specialMessage = 'Special chars: !@#$%^&*()_+ émojis: 🚀🎉💻 unicode: αβγδε';
      await input.fill(specialMessage);
      await expect(input).toHaveValue(specialMessage);

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await clearButton.click({ force: true });

      await expect(input).toHaveValue('');
    });

    test('should maintain input box state after rapid button clicks', async ({ page }) => {
      const input = await getChatInput(page);
      const testMessage = 'Test rapid clicks';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await clearButton.click({ force: true });
      await clearButton.click({ force: true });
      await clearButton.click({ force: true });

      await page.waitForTimeout(500);

      await expect(input).toHaveValue('');

      await input.fill('Can still type after rapid clicks');
      await expect(input).toHaveValue('Can still type after rapid clicks');
    });
  });
});
