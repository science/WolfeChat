import { test, expect } from '@playwright/test';
import { debugInfo } from './debug-utils';

test('Count textareas', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  
  const allTextareas = await page.locator('textarea').count();
  const chatTextareas = await page.locator('textarea[placeholder="Type your message..."]').count();
  
  debugInfo('Total textareas:', { allTextareas });
  debugInfo('Chat textareas:', { chatTextareas });
  
  // Get all textarea values
  const textareas = await page.locator('textarea').all();
  for (let i = 0; i < textareas.length; i++) {
    const value = await textareas[i].inputValue();
    const placeholder = await textareas[i].getAttribute('placeholder');
    debugInfo(`Textarea ${i}:`, { placeholder, value });
  }
});
