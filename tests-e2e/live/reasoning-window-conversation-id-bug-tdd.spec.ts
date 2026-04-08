import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForStreamComplete } from './helpers';
import { debugInfo, debugWarn } from '../debug-utils';

test.describe('TDD: Reasoning Window Conversation ID Bug', () => {
  test.setTimeout(120_000);

  test('reasoning window should show content after fresh localStorage clear', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|reasoning|conversation/.test(t) || msg.type() === 'error') {
          debugInfo(`[BROWSER-${msg.type()}] ${t}`);
        }
      });
      page.on('pageerror', err => debugWarn('[BROWSER-PAGEERROR]', { error: err.message }));
    }

    await page.goto('/');

    // Clear localStorage AND reload to fully reset in-memory Svelte stores.
    // Without reload, reasoningStore retains stale windows from module init,
    // causing convId mismatches when new conversations are created.
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

    debugInfo('[TEST] Starting with clean localStorage + reloaded page');

    await bootstrapLiveAPI(page);

    // Use gpt-5-nano with HIGH reasoning effort for reliable reasoning event production.
    // Medium effort sometimes doesn't produce reasoning events under API load.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high',
      closeAfter: true
    });

    await sendMessage(page, 'What is 2+2? Think step by step.', {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    debugInfo('[TEST] Message sent, waiting for stream to complete...');
    await waitForStreamComplete(page, { timeout: 60_000 });

    // Reasoning window should appear with content
    const reasoningWindows = page.locator('details[role="region"][aria-label*="Reasoning"]');
    await expect(reasoningWindows).toHaveCount(1);

    const messageCountText = await reasoningWindows.locator('span').filter({ hasText: /\d+ message/ }).textContent();
    debugInfo(`[TEST] Reasoning window message count: ${messageCountText}`);

    const messageCountNumber = parseInt(messageCountText?.match(/(\d+) message/)?.[1] || '0');
    expect(messageCountNumber).toBeGreaterThan(0);

    debugInfo(`[TEST] Reasoning window shows ${messageCountNumber} messages - content loaded correctly`);
  });
});
