import { test, expect } from '@playwright/test';

test('Count textareas', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  
  const allTextareas = await page.locator('textarea').count();
  const chatTextareas = await page.locator('textarea[placeholder="Type your message..."]').count();
  
  console.log('Total textareas:', allTextareas);
  console.log('Chat textareas:', chatTextareas);
  
  // Get all textarea values
  const textareas = await page.locator('textarea').all();
  for (let i = 0; i < textareas.length; i++) {
    const value = await textareas[i].inputValue();
    const placeholder = await textareas[i].getAttribute('placeholder');
    console.log(`Textarea ${i}: placeholder="${placeholder}", value="${value}"`);
  }
});
