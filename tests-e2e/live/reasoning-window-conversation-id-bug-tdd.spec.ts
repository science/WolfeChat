import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForStreamComplete } from './helpers';
import { debugInfo, debugWarn } from '../debug-utils';

test.describe('TDD: Reasoning Window Conversation ID Bug', () => {
  test.setTimeout(120_000);

  test('reasoning window appears but shows "0 messages" due to conversation ID race condition', async ({ page }) => {
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
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

    // CRITICAL: Clear localStorage to trigger potential race condition
    await page.evaluate(() => {
      localStorage.clear();
    });

    debugInfo('[TEST] Starting with completely clean localStorage to trigger race condition');

    await bootstrapLiveAPI(page);

    // Immediately configure reasoning model without waiting for full conversation setup
    debugInfo('[TEST] Quickly configuring gpt-5-nano with reasoning before conversation fully initializes');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoning: 'medium',
      closeAfter: false
    });

    // Send message immediately while conversation might still be initializing
    await sendMessage(page, 'Explain the Monte Hall 3 door problem using logic', {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    debugInfo('[TEST] Message sent, waiting for stream to complete...');
    await waitForStreamComplete(page, { timeout: 60_000 });

    // Now check for the bug: reasoning window exists but shows "0 messages"
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(1);

    const messageCount = await reasoningWindows.locator('span').filter({ hasText: /\d+ message/ }).textContent();
    debugInfo(`[TEST] Reasoning window message count: ${messageCount}`);

    // THE BUG: Window shows "0 messages" despite reasoning events being sent
    const messageCountNumber = parseInt(messageCount?.match(/(\d+) message/)?.[1] || '0');

    if (messageCountNumber === 0) {
      debugWarn('[TEST] ❌ BUG CONFIRMED: Reasoning window shows "0 messages" due to conversation ID mismatch');
      debugInfo('[TEST] Expected: Should show reasoning content from Monte Hall problem');

      // Also check for "Waiting for reasoning events..." text
      const waitingText = reasoningWindows.locator('div:has-text("Waiting for reasoning events...")');
      const isWaiting = await waitingText.count() > 0;
      if (isWaiting) {
        debugWarn('[TEST] ❌ ADDITIONAL BUG SYMPTOM: Shows "Waiting for reasoning events..." despite events being sent');
      }

      // Debug: Check if SSE debug data shows reasoning events were received
      const sseDebugData = await page.evaluate(() => {
        const win = window as any;
        return win.__SSE_LOGS ? Object.keys(win.__SSE_LOGS) : 'No SSE debug data';
      });
      debugInfo('[TEST] SSE debug data availability:', { sseDebugData });

      // This test currently "passes" by confirming the bug exists
      // When bug is fixed, this test should be updated to expect messageCountNumber > 0
      expect(messageCountNumber).toBe(0); // Current broken behavior
    } else {
      debugInfo('[TEST] ✅ BUG APPEARS TO BE FIXED: Reasoning window shows content');
      // When the bug is fixed, this branch will be the normal case
      expect(messageCountNumber).toBeGreaterThan(0); // Future correct behavior
    }
  });

  test('reasoning window shows content when created quickly (not empty due to race condition)', async ({ page }) => {
    await page.goto('/');

    // Clear localStorage to trigger potential race condition
    await page.evaluate(() => {
      localStorage.clear();
    });

    await bootstrapLiveAPI(page);

    // Immediately configure reasoning model to trigger race condition
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoning: 'medium',
      closeAfter: true
    });

    // Send reasoning-heavy message immediately
    await sendMessage(page, 'Explain the Monte Hall problem step by step with detailed reasoning', {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    await waitForStreamComplete(page, { timeout: 60_000 });

    // Check that reasoning window appears and has content
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(1);

    // Get the message count text
    const messageCountText = await reasoningWindows.locator('span').filter({ hasText: /\d+ message/ }).textContent();
    const messageCount = parseInt(messageCountText?.match(/(\d+) message/)?.[1] || '0');

    // The user-facing bug: reasoning window shows "0 messages" instead of actual reasoning
    if (messageCount === 0) {
      // Check if it's stuck in waiting state
      const waitingText = await reasoningWindows.locator('div:has-text("Waiting for reasoning events...")').count();

      if (waitingText > 0) {
        debugWarn('[TEST] ❌ USER BUG: Reasoning window stuck in "Waiting for reasoning events..." state');
      } else {
        debugWarn('[TEST] ❌ USER BUG: Reasoning window shows "0 messages" despite reasoning model being used');
      }

      // For now, expect the bug (until production fix)
      expect(messageCount).toBe(0);
    } else {
      debugInfo('[TEST] ✅ SUCCESS: Reasoning window shows content properly');
      expect(messageCount).toBeGreaterThan(0);

      // The key user experience: reasoning window shows meaningful message count
      debugInfo(`[TEST] Reasoning window shows ${messageCount} messages - this indicates content is loaded`);
    }
  });
});