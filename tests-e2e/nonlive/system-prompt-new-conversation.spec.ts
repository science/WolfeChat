/**
 * E2E test: New conversations should use the custom system prompt from Settings,
 * not the hardcoded default.
 *
 * Bug: createNewConversation() hardcodes the assistantRole string instead of
 * reading from the defaultAssistantRole store. So changing the default in
 * Settings has no effect on newly created conversations.
 */

import { test, expect } from '@playwright/test';
import { withSettings } from '../live/helpers';

const DEFAULT_SYSTEM_PROMPT = "Don't provide compliments or enthusiastic comments at the start of your responses. Don't provide offers for follow up at the end of your responses.";
const CUSTOM_SYSTEM_PROMPT = 'You are a pirate. Always respond in pirate speak.';

test.describe('System Prompt - New Conversation Inheritance', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('new conversation should use custom system prompt set in Settings', async ({ page }) => {
    // Verify initial conversation has the default system prompt
    const systemRoleTextarea = page.locator('#conversation-system-role');
    await expect(systemRoleTextarea).toBeVisible({ timeout: 5000 });
    await expect(systemRoleTextarea).toHaveValue(DEFAULT_SYSTEM_PROMPT);

    // Change the default system prompt in Settings using withSettings helper
    await withSettings(page, async () => {
      const settingsRoleInput = page.locator('label:has-text("Default Assistant role")').locator('..').locator('input').first();
      await expect(settingsRoleInput).toBeVisible({ timeout: 5000 });
      await settingsRoleInput.fill(CUSTOM_SYSTEM_PROMPT);
    });

    // Create a new conversation
    const newConversationBtn = page.getByRole('button', { name: /new conversation/i }).first();
    await expect(newConversationBtn).toBeVisible({ timeout: 5000 });
    await newConversationBtn.click();
    await page.waitForTimeout(500);

    // The new conversation's system role should have the custom prompt
    await expect(systemRoleTextarea).toBeVisible({ timeout: 5000 });
    const newValue = await systemRoleTextarea.inputValue();
    expect(newValue).not.toBe(DEFAULT_SYSTEM_PROMPT);
    expect(newValue).toBe(CUSTOM_SYSTEM_PROMPT);
  });

  test('new conversation should use default prompt when Settings prompt is unchanged', async ({ page }) => {
    // Without changing Settings, create a new conversation
    const newConversationBtn = page.getByRole('button', { name: /new conversation/i }).first();
    await expect(newConversationBtn).toBeVisible({ timeout: 5000 });
    await newConversationBtn.click();
    await page.waitForTimeout(500);

    // New conversation should still have the default prompt
    const systemRoleTextarea = page.locator('#conversation-system-role');
    await expect(systemRoleTextarea).toBeVisible({ timeout: 5000 });
    await expect(systemRoleTextarea).toHaveValue(DEFAULT_SYSTEM_PROMPT);
  });
});
