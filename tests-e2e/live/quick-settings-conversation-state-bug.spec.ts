import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, waitForStreamComplete, sendMessage } from './helpers';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

// This test demonstrates the reported bug: per-conversation Quick Settings appear correct in UI
// but are not honored in the outgoing request payload when sending a message.
// TDD: When fixed, the assertions on the captured request payload will pass.

test.describe('Live API: Quick Settings per-conversation settings honored on submit', () => {
  test.setTimeout(60_000);  // Reduced from 120s - should be sufficient with improved timeout logic

  test('Live: settings persist and are honored when submitting', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') console.log(`[BROWSER-${msg.type()}] ${t}`);
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
      page.on('request', req => { if (req.url().includes('api.openai.com')) console.log('[NET-REQ]', req.method(), req.url()); });
      page.on('response', res => { if (res.url().includes('api.openai.com')) console.log('[NET-RES]', res.status(), res.url()); });
    }

    await page.goto(APP_URL);
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    await bootstrapLiveAPI(page);

    // Ensure quick settings is functional and selects a reasoning-capable model by default
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano|gpt-5/i, reasoningEffort: 'minimal', verbosity: 'low', summary: 'auto', closeAfter: true });

    // Chat input will be resolved by helper when sending messages

    // Create total of 3 conversations
    const sidebar = page.locator('nav').first();
    const newConvBtn = sidebar.getByRole('button', { name: /^new conversation$/i });
    const rows = page.locator('.conversation.title-container');

    // conv2
    {
      const before = await rows.count();
      await newConvBtn.click();
      await expect(rows).toHaveCount(before + 1);
    }
    // conv3
    {
      const before = await rows.count();
      await newConvBtn.click();
      await expect(rows).toHaveCount(before + 1);
    }

    // rows order likely newest-first: 0->conv3, 1->conv2, 2->conv1

    // Configure per-conversation settings (Option A: reasoning-capable models only)
    // conv3 (rows.nth(0))
    await rows.nth(0).click();
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'minimal', verbosity: 'low', summary: 'detailed' });
    // Ensure UI reflects model before proceeding
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // conv2 (rows.nth(1))
    await rows.nth(1).click();
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'high', verbosity: 'high', summary: 'auto' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // conv1 (rows.nth(2))
    await rows.nth(2).click();
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'null' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // Verify UI values stick when cycling (reasoning controls should be present for all)
    const verifyUiFor = async (idx: number, expected: { effort: string; verbosity: string; summary: string; }) => {
      await rows.nth(idx).click();
      await operateQuickSettings(page, { mode: 'ensure-open' });
      await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expected.effort);
      await expect(page.locator('#verbosity')).toHaveValue(expected.verbosity);
      await expect(page.locator('#summary')).toHaveValue(expected.summary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });
    };

    await verifyUiFor(0, { effort: 'minimal', verbosity: 'low', summary: 'detailed' });
    await verifyUiFor(1, { effort: 'high', verbosity: 'high', summary: 'auto' });
    await verifyUiFor(2, { effort: 'medium', verbosity: 'medium', summary: 'null' });

    // Network capture: verify outgoing payload honors current conversation settings
    const captured: Array<{ url: string; body: any; when: number }> = [];
    await page.route('**/api.openai.com/**', async (route, req) => { if (DEBUG_LVL >= 2) console.log('[TEST] route hit', req.method(), req.url());
      if (req.method() === 'POST') { if (DEBUG_LVL >= 2) console.log('[TEST] POST body sniff attempt');
        try {
          const body = req.postDataJSON(); if (DEBUG_LVL >= 2) console.log('[TEST] captured POST', { url: req.url(), body });
          captured.push({ url: req.url(), body, when: Date.now() });
        } catch {}
      }
      await route.continue();
    });

    // Using shared helper waitForAssistantDone from tests-e2e/live/helpers.ts

    // Track expected first user messages per conversation index (rows.nth order: 0->conv3, 1->conv2, 2->conv1)
    const expectedUserMsgs = [
      'QuickSettings-state-check conv3',
      'QuickSettings-state-check conv2',
      'QuickSettings-state-check conv1',
    ];

    // Helper to send and assert
    const sendAndAssert = async (idx: number, label: string, expectModelRe: RegExp, expectEffort: string, expectVerbosity: string, expectSummary: string) => {
      captured.length = 0;
      if (DEBUG_LVL >= 2) console.log('[TEST] sendAndAssert start', { idx, label, expectModelRe: String(expectModelRe), expectEffort, expectVerbosity, expectSummary });
      await rows.nth(idx).click();
      
      // Wait for conversation to actually switch
      await page.waitForTimeout(500);
      
      // Verify the right conversation is selected
      await expect(rows.nth(idx)).toHaveClass(/bg-hover2/, { timeout: 3000 });

      // Verify active conversation by checking if we already have messages from this conv
      // For new conversations, we expect no messages yet
      try {
        const expectedTop = expectedUserMsgs[idx];
        const userItems = page.locator('[role="listitem"][data-message-role="user"]');
        const deadline = Date.now() + 2000; // Reduced timeout since we may have empty convs
        let messageCount = 0;
        
        while (Date.now() < deadline) {
          messageCount = await userItems.count().catch(() => 0);
          if (messageCount > 0) {
            // If we have messages, verify we're in the right conversation
            const topText = await userItems.last().innerText().catch(() => '');
            if (topText && topText.includes(expectedTop)) {
              if (DEBUG_LVL >= 2) console.log('[TEST] Found expected message in conversation', { idx, label });
              break;
            }
          } else {
            // No messages yet - this is fine for new conversations
            if (DEBUG_LVL >= 2) console.log('[TEST] Empty conversation (new)', { idx, label });
            break;
          }
          await page.waitForTimeout(150);
        }
        
        // Only retry click if we have messages but they're wrong
        if (messageCount > 0) {
          const topText = await userItems.last().innerText().catch(() => '');
          if (!topText || !topText.includes(expectedTop)) {
            if (DEBUG_LVL >= 2) {
              console.log('[TEST] Wrong conversation detected, retrying click', { 
                idx, 
                label,
                expectedTop, 
                actualText: (topText || '').slice(0, 120) 
              });
            }
            await rows.nth(idx).click();
            await page.waitForTimeout(500);
          }
        }
      } catch (e) {
        if (DEBUG_LVL >= 2) console.log('[TEST] Error during conversation verification:', e);
      }

      // Assert UI shows the expected quick settings prior to send
      await operateQuickSettings(page, { mode: 'ensure-open' });
      const curModel = await page.locator('#current-model-select').inputValue();
      if (DEBUG_LVL >= 2) console.log('[TEST] UI model before send', { label, curModel });
      await expect(page.locator('#current-model-select')).toHaveValue(expectModelRe);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expectEffort);
      await expect(page.locator('#verbosity')).toHaveValue(expectVerbosity);
      await expect(page.locator('#summary')).toHaveValue(expectSummary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

      // Add debugging to check what conversation we're actually in
      if (DEBUG_LVL >= 2) {
        const activeConv = await page.locator('.conversation.title-container.bg-hover2').count().catch(() => -1);
        const allConvs = await rows.count().catch(() => 0);
        console.log('[TEST] Before sending message', { idx, label, activeConv, allConvs });
      }
      
      const msg = `QuickSettings-state-check ${label}`;
      await sendMessage(page, msg, { submitMethod: 'ctrl-enter', clearFirst: true, waitForEmpty: true });

      // Pre-wait diagnostics
      if (DEBUG_LVL >= 2) {
        const preCount = await page.locator('[role="listitem"][data-message-role="assistant"]').count().catch(() => 0);
        console.log('[TEST] Pre-wait assistant count:', preCount);
      }

      // Wait for assistant response to complete streaming
      // Use shorter timeout to ensure we complete before test timeout (60s)
      await waitForStreamComplete(page, { timeout: 45_000 });

      // Post-wait diagnostics
      if (DEBUG_LVL >= 2) {
        const assistants = page.locator('[role="listitem"][data-message-role="assistant"]').filter({ hasText: /(QuickSettings-state-check|\bAI Response\b|\w{3,})/i });
        const count = await assistants.count().catch(() => 0);
        console.log('[TEST] Post-wait assistant count (filtered):', count);
        for (let i = 0; i < Math.min(count, 3); i++) {
          const item = assistants.nth(i);
          const header = await item.locator('.profile-picture .font-bold').innerText().catch(() => '');
          const text = await item.innerText().catch(() => '');
          console.log(`[TEST] Assistant ${i}: header="${header}" text="${(text||'').slice(0,150)}"`);
        }
      }

      expect(captured.length).toBeGreaterThan(0);
      // Pick latest matching chat send (stream: true and has text/reasoning or matches our message)
      const pick = [...captured].reverse().find(r => {
        const b = r.body || {};
        const hasStream = b.stream === true;
        const hasTextVerbosity = !!b.text && typeof b.text === 'object' && 'verbosity' in b.text;
        const hasReasoning = !!b.reasoning && typeof b.reasoning === 'object' && ('effort' in b.reasoning || 'summary' in b.reasoning);
        // Also try to match the exact user message we just sent
        const inArr = b.input;
        let matchesLabel = false;
        if (Array.isArray(inArr)) {
          try {
            const userMsg = inArr.find((m: any) => m && m.role === 'user');
            const content = userMsg?.content;
            const text = Array.isArray(content) ? content.find((c: any) => c && c.type === 'input_text')?.text : undefined;
            matchesLabel = typeof text === 'string' && text.includes(`QuickSettings-state-check ${label}`);
          } catch {}
        }
        return hasStream && (hasTextVerbosity || hasReasoning || matchesLabel);
      });
      expect(pick, 'expected to capture a chat send request').toBeTruthy();
      const req = pick!;
      if (DEBUG_LVL >= 2) console.log('[TEST] first captured req', JSON.stringify(req, null, 2));

      // Model may be under body.model for Responses API
      const modelStr: string = req.body?.model || '';
      if (DEBUG_LVL >= 2) console.log('[TEST] extracted modelStr', modelStr);
      expect(modelStr).toMatch(expectModelRe);

      // The assistant response should already be visible from waitForAssistantDone
      const assistants = page.locator('[role="listitem"][data-message-role="assistant"]');
      const lastAssistant = assistants.last();
      await expect(lastAssistant).toBeVisible({ timeout: 5_000 });
      const header = lastAssistant.locator('.profile-picture .font-bold');
      const headerText = await header.innerText();
      let displayedModel: string | null = null;
      const m = headerText.match(/\bAI Response\s*\(([^)]+)\)/i);
      if (m) displayedModel = m[1]?.trim() ?? null;
      expect(displayedModel, 'displayed assistant model should match sent model').toBe(modelStr);


       // Reasoning params for Responses API live under body.reasoning/text; keep fallbacks for legacy shapes
      const meta = req.body?.metadata || {};
      const body = req.body || {};
      // Break apart extraction with detailed debug
      const reasonObj = body && typeof body === 'object' ? (body as any).reasoning : undefined;
      const textObj = body && typeof body === 'object' ? (body as any).text : undefined;
      const bodyVerbosity = textObj && typeof textObj === 'object' ? (textObj as any).verbosity : undefined;
      const metaVerbosity = (meta as any)?.verbosity;
      const topVerbosity = (body as any)?.verbosity;
      const chosenVerbosity = (bodyVerbosity ?? metaVerbosity ?? topVerbosity);

      const reasonEffort = reasonObj && typeof reasonObj === 'object' ? (reasonObj as any).effort : undefined;
      const metaEff1 = (meta as any)?.reasoning_effort;
      const metaEff2 = (meta as any)?.reasoningEffort;
      const bodyEff1 = (body as any)?.reasoning_effort;
      const bodyEff2 = (body as any)?.reasoningEffort;
      const chosenEffort = (reasonEffort ?? metaEff1 ?? metaEff2 ?? bodyEff1 ?? bodyEff2);

      const reasonHasSummary = reasonObj && typeof reasonObj === 'object' && Object.prototype.hasOwnProperty.call(reasonObj, 'summary');
      const metaHasSummary = meta && typeof meta === 'object' && Object.prototype.hasOwnProperty.call(meta, 'summary');
      const bodyHasSummary = body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'summary');

      const reasonSummary = reasonHasSummary ? (reasonObj as any).summary : undefined;
      const metaSummary = metaHasSummary ? (meta as any).summary : undefined;
      const bodySummary = bodyHasSummary ? (body as any).summary : undefined;
      // Preserve intentional nulls; fall back only when key is absent
      const rawSummary = reasonHasSummary ? reasonSummary
        : metaHasSummary ? metaSummary
        : bodyHasSummary ? bodySummary
        : undefined;

      if (DEBUG_LVL >= 2) {
        console.log('[TEST] body keys', Object.keys(body||{}));
        console.log('[TEST] meta keys', Object.keys(meta||{}));
        console.log('[TEST] reasoning obj', reasonObj);
        console.log('[TEST] text obj', textObj);
        console.log('[TEST] fields', { reasonEffort, metaEff1, metaEff2, bodyEff1, bodyEff2, chosenEffort });
        console.log('[TEST] verbosity fields', { bodyVerbosity, metaVerbosity, topVerbosity, chosenVerbosity });
        console.log('[TEST] summary fields', { reasonSummary, metaSummary, bodySummary, rawSummary });
      }

      const effort = chosenEffort;
      const verbosity = chosenVerbosity;
      const expectedSummary = expectSummary === 'null' ? null : expectSummary;
      expect(effort).toBe(expectEffort);
      expect(verbosity).toBe(expectVerbosity);
      // For reasoning-capable models (gpt-5*), summary lives under reasoning and may be null
      expect(rawSummary).toBe(expectedSummary);
    };

    // Assertions for each conversation
    await sendAndAssert(0, 'conv3', /gpt-5/i, 'minimal', 'low', 'detailed');
    await sendAndAssert(1, 'conv2', /gpt-5-nano/i, 'high', 'high', 'auto');
    await sendAndAssert(2, 'conv1', /gpt-5-nano/i, 'medium', 'medium', 'null');
  });
});
