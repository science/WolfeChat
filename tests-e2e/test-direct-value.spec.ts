import { test, expect } from '@playwright/test';
import { debugInfo } from './debug-utils';

test('Test direct value manipulation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  
  // Try to set value directly via JavaScript
  const result = await page.evaluate(() => {
    const textarea = document.querySelector('textarea[placeholder="Type your message..."]') as HTMLTextAreaElement;
    if (!textarea) return { error: 'Textarea not found' };
    
    // Set value directly
    textarea.value = 'Direct value set';
    
    // Trigger input event manually
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    
    return {
      value: textarea.value,
      disabled: textarea.disabled,
      readOnly: textarea.readOnly
    };
  });
  
  debugInfo('Result:', { result });

  // Check if the value stuck
  const textarea = page.locator('textarea[placeholder="Type your message..."]');
  const finalValue = await textarea.inputValue();
  debugInfo('Final value from locator:', { finalValue });
});
