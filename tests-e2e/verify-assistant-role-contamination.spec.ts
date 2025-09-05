import { test, expect } from '@playwright/test';

// Verifies whether textarea starts with assistant role text instead of empty
test('Verify: textarea starts with assistant role text instead of empty', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  const textarea = page.locator('textarea[placeholder="Type your message..."]');
  await expect(textarea).toBeVisible();

  const initialValue = await textarea.inputValue();
  console.log('Initial textarea value:', JSON.stringify(initialValue));
  console.log('Is empty?:', initialValue === '');
  console.log('Contains assistant role?:', initialValue.includes("Don't provide compliments"));

  // Expected behavior: should be empty
  await expect(textarea).toHaveValue('');
});
