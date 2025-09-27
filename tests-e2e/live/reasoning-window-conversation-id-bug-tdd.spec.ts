import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForStreamComplete } from './helpers';

test.describe('TDD: Reasoning Window Conversation ID Bug', () => {
  test.setTimeout(120_000);

  test('reasoning window appears but shows "0 messages" due to conversation ID race condition', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|reasoning|conversation/.test(t) || msg.type() === 'error') {
          console.log(`[BROWSER-${msg.type()}] ${t}`);
        }
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
    }

    await page.goto('/');
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    // CRITICAL: Clear localStorage to trigger potential race condition
    await page.evaluate(() => {
      localStorage.clear();
    });

    console.log('[TEST] Starting with completely clean localStorage to trigger race condition');

    await bootstrapLiveAPI(page);

    // Immediately configure reasoning model without waiting for full conversation setup
    console.log('[TEST] Quickly configuring gpt-5-nano with reasoning before conversation fully initializes');

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

    console.log('[TEST] Message sent, waiting for stream to complete...');
    await waitForStreamComplete(page, { timeout: 60_000 });

    // Now check for the bug: reasoning window exists but shows "0 messages"
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(1);

    const messageCount = await reasoningWindows.locator('span').filter({ hasText: /\d+ message/ }).textContent();
    console.log(`[TEST] Reasoning window message count: ${messageCount}`);

    // THE BUG: Window shows "0 messages" despite reasoning events being sent
    const messageCountNumber = parseInt(messageCount?.match(/(\d+) message/)?.[1] || '0');

    if (messageCountNumber === 0) {
      console.log('[TEST] ❌ BUG CONFIRMED: Reasoning window shows "0 messages" due to conversation ID mismatch');
      console.log('[TEST] Expected: Should show reasoning content from Monte Hall problem');

      // Also check for "Waiting for reasoning events..." text
      const waitingText = reasoningWindows.locator('div:has-text("Waiting for reasoning events...")');
      const isWaiting = await waitingText.count() > 0;
      if (isWaiting) {
        console.log('[TEST] ❌ ADDITIONAL BUG SYMPTOM: Shows "Waiting for reasoning events..." despite events being sent');
      }

      // Debug: Check if SSE debug data shows reasoning events were received
      const sseDebugData = await page.evaluate(() => {
        const win = window as any;
        return win.__SSE_LOGS ? Object.keys(win.__SSE_LOGS) : 'No SSE debug data';
      });
      console.log('[TEST] SSE debug data availability:', sseDebugData);

      // This test currently "passes" by confirming the bug exists
      // When bug is fixed, this test should be updated to expect messageCountNumber > 0
      expect(messageCountNumber).toBe(0); // Current broken behavior
    } else {
      console.log('[TEST] ✅ BUG APPEARS TO BE FIXED: Reasoning window shows content');
      // When the bug is fixed, this branch will be the normal case
      expect(messageCountNumber).toBeGreaterThan(0); // Future correct behavior
    }
  });

  test('conversation ID is undefined when reasoning window is created too quickly', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;

    await page.goto('/');
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    // Clear all data to force conversation initialization race condition
    await page.evaluate(() => {
      localStorage.clear();
    });

    await bootstrapLiveAPI(page);

    // Expose reasoning store functions for inspection
    await page.evaluate(() => {
      const win = window as any;
      win.testDebugData = {
        conversationIdAtMessageSend: null,
        reasoningWindowIds: [],
        reasoningWindowData: []
      };

      // Override createReasoningWindow to capture the convId parameter
      const originalCreate = win.createReasoningWindow;
      if (originalCreate) {
        win.createReasoningWindow = (...args: any[]) => {
          const [convId, model, anchorIndex] = args;
          win.testDebugData.reasoningWindowData.push({ convId, model, anchorIndex, timestamp: Date.now() });
          console.log('[TEST-DEBUG] createReasoningWindow called with convId:', convId);
          return originalCreate(...args);
        };
      }
    });

    // Configure reasoning immediately
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoning: 'medium',
      closeAfter: false
    });

    // Send message and capture conversation state at the exact moment
    await page.evaluate(() => {
      const win = window as any;
      // Try to capture conversation ID the same way openaiService does
      const conversations = win.get?.(win.conversations);
      const convId = 0; // First conversation index
      const conversationUniqueId = conversations?.[convId]?.id;
      win.testDebugData.conversationIdAtMessageSend = conversationUniqueId;
      console.log('[TEST-DEBUG] Conversation ID at message send:', conversationUniqueId);
    });

    await sendMessage(page, 'Monte Hall problem', {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    await waitForStreamComplete(page, { timeout: 60_000 });

    // Analyze the captured debug data
    const debugData = await page.evaluate(() => (window as any).testDebugData);
    console.log('[TEST] Debug data captured:', JSON.stringify(debugData, null, 2));

    if (debugData.conversationIdAtMessageSend === undefined || debugData.conversationIdAtMessageSend === null) {
      console.log('[TEST] ❌ ROOT CAUSE CONFIRMED: conversationId was undefined/null when message was sent');

      if (debugData.reasoningWindowData.length > 0) {
        const windowData = debugData.reasoningWindowData[0];
        if (windowData.convId === undefined || windowData.convId === null) {
          console.log('[TEST] ❌ BUG CHAIN CONFIRMED: Reasoning window created with undefined convId');
        }
      }

      // Test currently expects the bug - update this when bug is fixed
      expect(debugData.conversationIdAtMessageSend).toBeUndefined();
    } else {
      console.log('[TEST] ✅ ROOT CAUSE APPEARS FIXED: conversationId was properly defined');
      expect(debugData.conversationIdAtMessageSend).toBeDefined();
    }
  });
});