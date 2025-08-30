import { test, expect } from '@playwright/test';

test('browser-nonlive suite passes via in-page harness', async ({ page }) => {
  await page.goto('/?testMode=1&suite=browser-nonlive');
  await page.waitForFunction(() => typeof (window as any).__wolfeRunTests === 'function');
  const result = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).__wolfeRunTests?.();
  });
  console.log('Browser nonlive results:', result);
  expect(result && result.passed).toBeTruthy();
});
