import { test, expect } from '@playwright/test';

const hasKey = !!process.env.OPENAI_API_KEY;

(test as any)[hasKey ? 'describe' : 'skip']('live API basics', () => {
  test('can set API key and send a prompt', async ({ page }) => {
    await page.goto('/');
    // Inject API key via helper or localStorage
    const key = process.env.OPENAI_API_KEY!;
    await page.addInitScript((k) => localStorage.setItem('api_key', JSON.stringify(k)), key);
    await page.reload();

    await expect(page.locator('textarea[aria-label="Chat input"]')).toBeVisible();
    await page.locator('textarea[aria-label="Chat input"]').fill('Say hello');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for some assistant content to appear
    const assistantMsg = page.locator('[data-testid="assistant-message"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60000 });
  });
});
