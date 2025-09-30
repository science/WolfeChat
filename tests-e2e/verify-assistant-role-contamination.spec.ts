import { test, expect } from '@playwright/test';
import { debugInfo } from './debug-utils';

// Verifies whether textarea starts with assistant role text instead of empty
test('Verify: textarea starts with assistant role text instead of empty', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  const textarea = page.locator('textarea[placeholder="Type your message..."]');
  await expect(textarea).toBeVisible();

  const initialValue = await textarea.inputValue();
  debugInfo('Initial textarea value:', { value: JSON.stringify(initialValue) });
  debugInfo('Is empty?:', { isEmpty: initialValue === '' });
  debugInfo('Contains assistant role?:', { containsAssistantRole: initialValue.includes("Don't provide compliments") });

  // Expected behavior: should be empty
  await expect(textarea).toHaveValue('');
});
