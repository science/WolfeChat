import { test, expect } from '@playwright/test';

const API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_GPT || '';

test.skip(API_KEY === '', 'OPENAI_API_KEY not set');

test('browser-live suite passes via in-page harness', async ({ page }) => {
  page.on('console', (msg) => {
    const args = msg.args().map(a => a.toString()).join(' ');
    console.log(`[browser:${msg.type()}]`, msg.text(), args ? `| args: ${args}` : '');
  });
  page.on('pageerror', (err) => {
    console.log('[pageerror]', err?.message || String(err));
  });
  page.on('requestfailed', (req) => {
    console.log('[requestfailed]', req.url(), req.failure()?.errorText || '');
  });

  await page.goto('/?testMode=1&suite=browser-live');
  await page.waitForSelector('#app', { state: 'attached' });

  await page.waitForFunction(() => typeof (window as any).__wolfeSetApiKey === 'function');
  await page.evaluate((key) => (window as any).__wolfeSetApiKey(key), API_KEY);

  // Optional: preload models if supported
  try {
    await page.waitForFunction(() => typeof (window as any).__wolfePreloadModels === 'function', { timeout: 5000 });
    await page.evaluate(() => (window as any).__wolfePreloadModels());
  } catch {}

  await page.waitForFunction(() => typeof (window as any).__wolfeRunTests === 'function');
  const result = await page.evaluate(async () => {
    return await (window as any).__wolfeRunTests?.();
  });
  console.log('Browser live results:', result);
  expect(result && result.passed).toBeTruthy();
});
