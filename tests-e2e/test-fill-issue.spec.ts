import { test, expect } from '@playwright/test';
import { debugInfo } from './debug-utils';

test('Test fill vs type', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  
  const textarea = page.locator('textarea[placeholder="Type your message..."]');
  
  // Try fill
  await textarea.fill('Test with fill');
  const valueAfterFill = await textarea.inputValue();
  debugInfo('After fill:', { valueAfterFill });

  // Check if input event was triggered
  const draftAfterFill = await page.evaluate(() => {
    return (window as any).drafts?.getDraft?.((window as any).$conversations?.[0]?.id) || 'no draft';
  });
  debugInfo('Draft after fill:', { draftAfterFill });
  
  // Try type instead
  await textarea.clear();
  await textarea.type('Test with type');
  const valueAfterType = await textarea.inputValue();
  debugInfo('After type:', { valueAfterType });

  // Check if input event was triggered
  const draftAfterType = await page.evaluate(() => {
    return (window as any).drafts?.getDraft?.((window as any).$conversations?.[0]?.id) || 'no draft';
  });
  debugInfo('Draft after type:', { draftAfterType });
});
