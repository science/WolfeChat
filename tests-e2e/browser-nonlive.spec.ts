import { test, expect } from '@playwright/test';

test('browser-nonlive suite passes via in-page harness', async ({ page }) => {
  // Surface browser console/page errors in the test output
  page.on('console', (msg) => {
    // Include argument values if any
    const args = msg.args().map(a => a.toString()).join(' ');
    // eslint-disable-next-line no-console
    console.log(`[browser:${msg.type()}]`, msg.text(), args ? `| args: ${args}` : '');
  });
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log('[pageerror]', err?.message || String(err));
  });
  page.on('requestfailed', (req) => {
    // eslint-disable-next-line no-console
    console.log('[requestfailed]', req.url(), req.failure()?.errorText || '');
  });

  // Navigate and wait for app root to ensure mount
  await page.goto('/?testMode=1&suite=browser-nonlive');
  await page.waitForSelector('#app', { state: 'attached' });

  // Give early signal if harness fails to attach
  const ready = await page.waitForFunction(() => {
    // @ts-ignore
    return typeof (window as any).__wolfeRunTests === 'function';
  }, { timeout: 30000 }).catch(async (e) => {
    // Dump basic DOM state for diagnostics
    const html = await page.content();
    // eslint-disable-next-line no-console
    console.log('[diagnostics] __wolfeRunTests not found within timeout');
    // eslint-disable-next-line no-console
    console.log('[diagnostics] page content length:', html.length);
    throw e;
  });
  expect(ready).toBeTruthy();

  const result = await page.evaluate(async () => {
    // @ts-ignore
    return await (window as any).__wolfeRunTests?.();
  });
  // eslint-disable-next-line no-console
  console.log('Browser nonlive results:', result);
  expect(result && result.passed).toBeTruthy();
});
