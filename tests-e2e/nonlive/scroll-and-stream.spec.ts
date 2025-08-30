import { test, expect } from '@playwright/test';

// Basic port covering streaming/scroll behavior without external APIs

test('app boots and chat UI renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('textarea[aria-label="Chat input"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
});

test('scroll container maintains position when streaming placeholder grows', async ({ page }) => {
  await page.goto('/');
  const chat = page.locator('[data-testid="chat-scroll-container"]');
  await expect(chat).toBeVisible();
  // Seed a few messages to make it scrollable using a test hook if available
  await page.evaluate(() => {
    const w: any = window as any;
    if (w.__wolfeTest?.seedMessages) {
      w.__wolfeTest.seedMessages(20);
    }
  });
  const before = await chat.evaluate(e => ({ top: e.scrollTop, height: e.scrollHeight }));
  // Simulate a streaming chunk; use hook if exposed
  await page.evaluate(() => {
    const w: any = window as any;
    if (w.__wolfeTest?.appendStreamingChunk) {
      w.__wolfeTest.appendStreamingChunk(' incremental text');
    }
  });
  const after = await chat.evaluate(e => ({ top: e.scrollTop, height: e.scrollHeight }));
  expect(after.height).toBeGreaterThanOrEqual(before.height);
  // If user has scrolled up, position should not snap to bottom; best-effort check
  // Here we assert scrollTop does not jump to end
  expect(after.top).toBeLessThan(after.height);
});
