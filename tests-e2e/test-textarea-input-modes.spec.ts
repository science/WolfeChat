import { test, expect } from '@playwright/test';

// These tests validate reliable ways to set a Svelte-bound textarea value
// and ensure the app reacts (send button enabled) and value is observable.

const selector = 'textarea[placeholder="Type your message..."]';
const sendBtn = 'textarea[placeholder="Type your message..."] + button';

async function gotoApp(page) {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
}

test.describe('Textarea input modes with Svelte', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('mode: elementHandle.type triggers input and enables send', async ({ page }) => {
    const ta = page.locator(selector);
    await ta.click();
    await ta.type('Hello via type');
    await expect(ta).toHaveValue('Hello via type');
    await expect(page.locator(sendBtn)).toBeEnabled();
  });

  test('mode: keyboard.press produces characters (focused)', async ({ page }) => {
    const ta = page.locator(selector);
    await ta.click();
    await page.keyboard.type('Hello via keyboard');
    await expect(ta).toHaveValue('Hello via keyboard');
    await expect(page.locator(sendBtn)).toBeEnabled();
  });

  test('mode: dispatch input event after direct value set', async ({ page }) => {
    // Set value and dispatch input event in page context
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLTextAreaElement;
      el.value = 'Hello via dispatchEvent';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, selector);

    const ta = page.locator(selector);
    await expect(ta).toHaveValue('Hello via dispatchEvent');
    await expect(page.locator(sendBtn)).toBeEnabled();
  });

  test('mode: fill() followed by manual input event works reliably', async ({ page }) => {
    const ta = page.locator(selector);
    await ta.fill('Hello via fill');
    // Manually force input event to ensure Svelte on:input runs
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLTextAreaElement;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, selector);

    await expect(ta).toHaveValue('Hello via fill');
    await expect(page.locator(sendBtn)).toBeEnabled();
  });
});
