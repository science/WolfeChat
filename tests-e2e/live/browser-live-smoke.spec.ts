import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, sendMessage, waitForAssistantDone } from './helpers';

const hasKey = !!process.env.OPENAI_API_KEY;

(test as any)[hasKey ? 'describe' : 'skip']('live API basics', () => {
  test('can type text into input field', async ({ page }) => {
    await page.goto('/');
    await bootstrapLiveAPI(page);
    
    // Test basic input functionality first
    const input = page.getByRole('textbox', { name: /chat input/i });
    await expect(input).toBeVisible();
    await input.click();
    
    // Test character by character input
    await page.keyboard.type('H');
    await expect(input).toHaveValue('H');
    
    await page.keyboard.type('ello');
    await expect(input).toHaveValue('Hello');
    
    // Test that send button becomes enabled
    const sendBtn = page.getByRole('button', { name: /send/i });
    await expect(sendBtn).toBeEnabled();
  });

  test('can set API key and send a prompt', async ({ page }) => {
    await page.goto('/');
    await bootstrapLiveAPI(page);
    
    await sendMessage(page, 'Say hello', { submitMethod: 'click-button' });
    
    await waitForAssistantDone(page, { timeout: 60000 });
    
    // Verify assistant message appeared
    const assistantMsg = page.locator('[role="listitem"][data-message-role="assistant"]').first();
    await expect(assistantMsg).toBeVisible();
  });
});
