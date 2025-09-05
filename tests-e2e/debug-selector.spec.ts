import { test, expect } from '@playwright/test';

test('Debug: which textarea is selected', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(500);
  
  // Count all textareas
  const allTextareas = await page.evaluate(() => {
    const tas = document.querySelectorAll('textarea');
    return Array.from(tas).map((ta, i) => ({
      index: i,
      placeholder: ta.placeholder,
      value: ta.value,
      className: ta.className
    }));
  });
  console.log('All textareas:', JSON.stringify(allTextareas, null, 2));
  
  // Now find the one with our placeholder
  const chatInput = page.locator('textarea[placeholder="Type your message..."]');
  const count = await chatInput.count();
  console.log('Textareas with "Type your message..." placeholder:', count);
  
  if (count > 0) {
    await chatInput.fill('Test text');
    const value = await chatInput.inputValue();
    console.log('After filling, value is:', value);
  }
  
  // Check what the test actually selects
  const selectedValue = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder="Type your message..."]') as HTMLTextAreaElement;
    return ta ? { value: ta.value, exists: true } : { exists: false };
  });
  console.log('Selected textarea:', selectedValue);
});