import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, waitForStreamComplete, sendMessage } from './helpers';
import { debugInfo, debugErr, debugWarn } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

// This test demonstrates the reported bug: per-conversation Quick Settings appear correct in UI
// but are not honored in the outgoing request payload when sending a message.
// TDD: When fixed, the assertions on the captured request payload will pass.

test.describe('Live API: Quick Settings per-conversation settings honored on submit', () => {
  test.setTimeout(180_000);  // 3 sequential reasoning model sends need ample time

  test('Live: settings persist and are honored when submitting', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
      });
      page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
      page.on('request', req => { if (req.url().includes('api.openai.com')) debugInfo('[NET-REQ]', { method: req.method(), url: req.url() }); });
      page.on('response', res => { if (res.url().includes('api.openai.com')) debugInfo('[NET-RES]', { status: res.status(), url: res.url() }); });
    }

    await page.goto(APP_URL);
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

    await bootstrapLiveAPI(page);

    // Generate unique session ID for this test
    const sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    debugInfo(`[TEST] SSE Debug Session ID: ${sessionId}`);

    // Add browser-side monitoring for reasoning events and UI state
    await page.addInitScript((sessionId) => {
      const win = window as any;

      // Set up session-based SSE logging
      win.__SSE_DEBUG_SESSION = sessionId;
      win.__SSE_LOGS = win.__SSE_LOGS || {};
      win.__SSE_LOGS[sessionId] = {
        testStarted: new Date().toISOString(),
        testName: 'quick-settings-conversation-state-bug',
        apiCalls: []
      };

      win.__testDebugData = {
        reasoningEvents: [],
        uiStateChanges: [],
        assistantMessages: [],
        streamState: []
      };

      // Monitor reasoning store events
      if (win.__DEBUG && typeof win.reasoningSSEEvents?.subscribe === 'function') {
        win.reasoningSSEEvents.subscribe((events: any[]) => {
          const latest = events[events.length - 1];
          if (latest) {
            win.__testDebugData.reasoningEvents.push({
              ...latest,
              capturedAt: Date.now()
            });
            console.log('[TEST-BROWSER] SSE Event logged:', latest.type);
          }
        });
      }

      // Monitor DOM changes for assistant messages
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                if (el.matches('[role="listitem"][data-message-role="assistant"]') ||
                    el.querySelector('[role="listitem"][data-message-role="assistant"]')) {
                  win.__testDebugData.assistantMessages.push({
                    added: true,
                    textContent: el.textContent?.slice(0, 100) || '',
                    timestamp: Date.now()
                  });
                  console.log('[TEST-BROWSER] Assistant message DOM added');
                }
              }
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Monitor stream state changes
      const originalFetch = win.fetch;
      win.fetch = async (...args: any[]) => {
        const [url] = args;
        if (typeof url === 'string' && url.includes('api.openai.com/v1/responses')) {
          console.log('[TEST-BROWSER] Starting SSE request to:', url);
          win.__testDebugData.streamState.push({
            type: 'request_start',
            url,
            timestamp: Date.now()
          });
        }
        return originalFetch.apply(win, args);
      };
    });

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
      await newConvBtn.click({ force: true });
      await expect(rows).toHaveCount(before + 1);
    }
    // conv3
    {
      const before = await rows.count();
      await newConvBtn.click({ force: true });
      await expect(rows).toHaveCount(before + 1);
    }

    // rows order likely newest-first: 0->conv3, 1->conv2, 2->conv1

    // Configure per-conversation settings (Option A: reasoning-capable models only)
    // conv3 (rows.nth(0))
    await rows.nth(0).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'minimal', verbosity: 'low', summary: 'detailed' });
    // Ensure UI reflects model before proceeding
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // conv2 (rows.nth(1))
    await rows.nth(1).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'auto' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // conv1 (rows.nth(2))
    await rows.nth(2).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'null' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // Verify UI values stick when cycling (reasoning controls should be present for all)
    const verifyUiFor = async (idx: number, expected: { effort: string; verbosity: string; summary: string; }) => {
      await rows.nth(idx).click({ force: true });
      await operateQuickSettings(page, { mode: 'ensure-open' });
      await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5-nano/i);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expected.effort);
      await expect(page.locator('#verbosity')).toHaveValue(expected.verbosity);
      await expect(page.locator('#summary')).toHaveValue(expected.summary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });
    };

    await verifyUiFor(0, { effort: 'minimal', verbosity: 'low', summary: 'detailed' });
    await verifyUiFor(1, { effort: 'medium', verbosity: 'medium', summary: 'auto' });
    await verifyUiFor(2, { effort: 'medium', verbosity: 'medium', summary: 'null' });

    // Network capture: verify outgoing payload honors current conversation settings
    const captured: Array<{ url: string; body: any; when: number }> = [];
    const sseEvents: Array<{ type: string; data: any; when: number; raw?: string }> = [];

    // Capture request payloads
    await page.route('**/api.openai.com/**', async (route, req) => {
      if (DEBUG_LVL >= 2) debugInfo('[TEST] route hit', { method: req.method(), url: req.url() });

      if (req.method() === 'POST') {
        if (DEBUG_LVL >= 2) debugInfo('[TEST] POST body sniff attempt');
        try {
          const body = req.postDataJSON();
          if (DEBUG_LVL >= 2) debugInfo('[TEST] captured POST', { url: req.url(), body });
          captured.push({ url: req.url(), body, when: Date.now() });
        } catch {}
      }

      await route.continue();
    });

    // Capture SSE response data using response interception
    page.on('response', async (response) => {
      if (response.url().includes('api.openai.com/v1/responses') && response.status() === 200) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('text/plain') || contentType.includes('text/event-stream')) {
            const responseText = await response.text();
            if (DEBUG_LVL >= 1) debugInfo('[TEST-SSE] Response captured, length:', { length: responseText.length });

            // Parse SSE events from response
            const sseBlocks = responseText.split('\n\n').filter(block => block.trim());
            for (const block of sseBlocks) {
              const lines = block.split('\n');
              let eventType = 'message';
              const dataLines: string[] = [];

              for (const line of lines) {
                if (line.startsWith('event:')) {
                  eventType = line.slice('event:'.length).trim();
                } else if (line.startsWith('data:')) {
                  dataLines.push(line.slice('data:'.length).trim());
                }
              }

              if (dataLines.length > 0) {
                const dataStr = dataLines.join('\n');
                let parsedData: any = null;
                try {
                  if (dataStr !== '[DONE]') {
                    parsedData = JSON.parse(dataStr);
                  }
                } catch {}

                sseEvents.push({
                  type: eventType,
                  data: parsedData,
                  when: Date.now(),
                  raw: dataStr
                });

                if (DEBUG_LVL >= 1) {
                  debugInfo('[TEST-SSE] Event:', { type: eventType, hasData: !!parsedData, raw: dataStr.slice(0, 100) });
                }
              }
            }
          }
        } catch (e) {
          if (DEBUG_LVL >= 1) debugErr('[TEST-SSE] Failed to capture response:', { error: e });
        }
      }
    });

    // Using shared helper waitForAssistantDone from tests-e2e/live/helpers.ts

    // Track expected first user messages per conversation index (rows.nth order: 0->conv3, 1->conv2, 2->conv1)
    const expectedUserMsgs = [
      'Monte Hall 3 door problem',
      'Monte Hall 3 door problem',
      'Monte Hall 3 door problem',
    ];

    // Helper to send and assert
    const sendAndAssert = async (idx: number, label: string, expectModelRe: RegExp, expectEffort: string, expectVerbosity: string, expectSummary: string) => {
      captured.length = 0;
      if (DEBUG_LVL >= 2) debugInfo('[TEST] sendAndAssert start', { idx, label, expectModelRe: String(expectModelRe), expectEffort, expectVerbosity, expectSummary });
      await rows.nth(idx).click({ force: true });
      
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
              if (DEBUG_LVL >= 2) debugInfo('[TEST] Found expected message in conversation', { idx, label });
              break;
            }
          } else {
            // No messages yet - this is fine for new conversations
            if (DEBUG_LVL >= 2) debugInfo('[TEST] Empty conversation (new)', { idx, label });
            break;
          }
          await page.waitForTimeout(150);
        }
        
        // Only retry click if we have messages but they're wrong
        if (messageCount > 0) {
          const topText = await userItems.last().innerText().catch(() => '');
          if (!topText || !topText.includes(expectedTop)) {
            if (DEBUG_LVL >= 2) {
              debugWarn('[TEST] Wrong conversation detected, retrying click', {
                idx,
                label,
                expectedTop,
                actualText: (topText || '').slice(0, 120)
              });
            }
            await rows.nth(idx).click({ force: true });
            await page.waitForTimeout(500);
          }
        }
      } catch (e) {
        if (DEBUG_LVL >= 2) debugErr('[TEST] Error during conversation verification:', { error: e });
      }

      // Assert UI shows the expected quick settings prior to send
      await operateQuickSettings(page, { mode: 'ensure-open' });
      const curModel = await page.locator('#current-model-select').inputValue();
      if (DEBUG_LVL >= 2) debugInfo('[TEST] UI model before send', { label, curModel });
      await expect(page.locator('#current-model-select')).toHaveValue(expectModelRe);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expectEffort);
      await expect(page.locator('#verbosity')).toHaveValue(expectVerbosity);
      await expect(page.locator('#summary')).toHaveValue(expectSummary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

      // Add debugging to check what conversation we're actually in
      if (DEBUG_LVL >= 2) {
        const activeConv = await page.locator('.conversation.title-container.bg-hover2').count().catch(() => -1);
        const allConvs = await rows.count().catch(() => 0);
        debugInfo('[TEST] Before sending message', { idx, label, activeConv, allConvs });
      }
      
      const msg = `Explain the Monte Hall 3 door problem using logic (for ${label})`;
      await sendMessage(page, msg, { submitMethod: 'ctrl-enter', clearFirst: true, waitForEmpty: true });

      // Pre-wait diagnostics
      if (DEBUG_LVL >= 2) {
        const preCount = await page.locator('[role="listitem"][data-message-role="assistant"]').count().catch(() => 0);
        debugInfo('[TEST] Pre-wait assistant count:', { preCount });
      }

      // Wait for assistant response to complete streaming
      // Use shorter timeout for debugging (temporarily reduced from 45s)
      await waitForStreamComplete(page, { timeout: 45_000 });

      // Post-wait diagnostics
      if (DEBUG_LVL >= 2) {
        const assistants = page.locator('[role="listitem"][data-message-role="assistant"]').filter({ hasText: /(Monte Hall|\bAI Response\b|\w{3,})/i });
        const count = await assistants.count().catch(() => 0);
        debugInfo('[TEST] Post-wait assistant count (filtered):', { count });
        for (let i = 0; i < Math.min(count, 3); i++) {
          const item = assistants.nth(i);
          const header = await item.locator('.profile-picture .font-bold').innerText().catch(() => '');
          const text = await item.innerText().catch(() => '');
          debugInfo(`[TEST] Assistant ${i}:`, { header, text: (text||'').slice(0,150) });
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
            matchesLabel = typeof text === 'string' && text.includes(`Monte Hall 3 door problem`);
          } catch {}
        }
        return hasStream && (hasTextVerbosity || hasReasoning || matchesLabel);
      });
      expect(pick, 'expected to capture a chat send request').toBeTruthy();
      const req = pick!;
      if (DEBUG_LVL >= 2) debugInfo('[TEST] first captured req', { req: JSON.stringify(req, null, 2) });

      // Model may be under body.model for Responses API
      const modelStr: string = req.body?.model || '';
      if (DEBUG_LVL >= 2) debugInfo('[TEST] extracted modelStr', { modelStr });
      expect(modelStr).toMatch(expectModelRe);

      // Capture comprehensive debug data before final assertions
      if (DEBUG_LVL >= 1) {
        debugInfo('\n=== COMPREHENSIVE DEBUG DATA ANALYSIS ===');
        debugInfo(`[TEST-SUMMARY] Network SSE events captured: ${sseEvents.length}`);
        debugInfo('[TEST-SUMMARY] Network SSE event types:', { types: sseEvents.map(e => e.type) });

        try {
          // Get comprehensive debug data from our new layer system
          const comprehensiveDebugData = await page.evaluate(() => {
            const win = window as any;

            // Get data from our new debug infrastructure
            let layerDebugData = null;
            if (typeof win.getDebugData === 'function') {
              layerDebugData = win.getDebugData();
            }

            // Get browser-specific debug data
            const browserDebugData = win.__testDebugData;

            return {
              layerDebugData,
              browserDebugData,
              debugMode: win.__DEBUG,
              hasGetDebugData: typeof win.getDebugData === 'function'
            };
          });

          debugInfo(`[TEST-SUMMARY] Debug mode enabled: ${comprehensiveDebugData.debugMode}`);
          debugInfo(`[TEST-SUMMARY] Has getDebugData function: ${comprehensiveDebugData.hasGetDebugData}`);

          if (comprehensiveDebugData.layerDebugData) {
            const layers = comprehensiveDebugData.layerDebugData.layers;
            const timeline = comprehensiveDebugData.layerDebugData.timeline;

            debugInfo('[TEST-SUMMARY] === LAYER-BY-LAYER DEBUG ANALYSIS ===');
            debugInfo(`[TEST-SUMMARY] SSE Parser events: ${layers.sseParser?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Message Assembly events: ${layers.messageAssembly?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Store Update events: ${layers.storeUpdates?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Reasoning Store events: ${layers.reasoning?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Total timeline events: ${timeline?.length || 0}`);

            // Analyze critical checkpoints
            const sseEvents = layers.sseParser || [];
            const msgEvents = layers.messageAssembly || [];
            const storeEvents = layers.storeUpdates || [];
            const reasoningEvents = layers.reasoning || [];

            debugInfo('[TEST-SUMMARY] === CRITICAL CHECKPOINT ANALYSIS ===');

            // Check if SSE events arrived
            const sseChunks = sseEvents.filter(e => e.event === 'raw_chunk_received');
            const sseCompleted = sseEvents.filter(e => e.event === 'sse_stream_done');
            debugInfo(`[TEST-SUMMARY] ✓ SSE chunks received: ${sseChunks.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ SSE streams completed: ${sseCompleted.length}`);

            // Check if messages were assembled
            const textDeltas = msgEvents.filter(e => e.event === 'text_delta_received');
            const messagesCreated = msgEvents.filter(e => e.event === 'assistant_message_creating');
            const setHistoryCalls = msgEvents.filter(e => e.event.includes('setHistory_called'));
            debugInfo(`[TEST-SUMMARY] ✓ Text deltas received: ${textDeltas.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ Assistant messages created: ${messagesCreated.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ SetHistory calls from msg assembly: ${setHistoryCalls.length}`);

            // Check if store was updated
            const storeUpdates = storeEvents.filter(e => e.event === 'conversations_store_set');
            const storeCompleted = storeEvents.filter(e => e.event === 'setHistory_completed');
            debugInfo(`[TEST-SUMMARY] ✓ Store updates executed: ${storeUpdates.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ Store updates completed: ${storeCompleted.length}`);

            // Check reasoning events
            const windowsCreated = reasoningEvents.filter(e => e.event === 'window_creation_completed');
            const panelsCreated = reasoningEvents.filter(e => e.event === 'panel_creation_completed');
            const textUpdates = reasoningEvents.filter(e => e.event === 'text_content_updated');
            const panelsCompleted = reasoningEvents.filter(e => e.event === 'panel_completion_completed');
            debugInfo(`[TEST-SUMMARY] ✓ Reasoning windows created: ${windowsCreated.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ Reasoning panels created: ${panelsCreated.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ Reasoning text updates: ${textUpdates.length}`);
            debugInfo(`[TEST-SUMMARY] ✓ Reasoning panels completed: ${panelsCompleted.length}`);

            // Identify where the flow breaks
            debugInfo('[TEST-SUMMARY] === FAILURE POINT ANALYSIS ===');
            if (sseChunks.length === 0) {
              debugErr('[TEST-CRITICAL] 🚨 SSE events never arrived - network issue');
            } else if (textDeltas.length === 0) {
              debugErr('[TEST-CRITICAL] 🚨 SSE events arrived but text deltas not created - SSE parsing issue');
            } else if (messagesCreated.length === 0) {
              debugErr('[TEST-CRITICAL] 🚨 Text deltas created but assistant messages not assembled - message assembly issue');
            } else if (storeUpdates.length === 0) {
              debugErr('[TEST-CRITICAL] 🚨 Messages assembled but store not updated - store update issue');
            } else if (windowsCreated.length === 0 && panelsCreated.length === 0) {
              debugErr('[TEST-CRITICAL] 🚨 Store updated but reasoning windows/panels not created - reasoning store issue');
            } else if (textUpdates.length === 0 && panelsCreated.length > 0) {
              debugErr('[TEST-CRITICAL] 🚨 Reasoning panels created but never received text content - reasoning text flow issue');
            } else {
              debugInfo('[TEST-SUCCESS] ✅ All layers functioning - issue may be in DOM reactivity or component rendering');
            }

            // Show conversation context correlation
            const timelineByConv = timeline ? timeline.reduce((acc: any, event: any) => {
              const convId = event.conversationId || 'unknown';
              if (!acc[convId]) acc[convId] = [];
              acc[convId].push(event.event);
              return acc;
            }, {}) : {};

            debugInfo('[TEST-SUMMARY] === CONVERSATION CONTEXT TRACKING ===');
            Object.entries(timelineByConv).forEach(([convId, events]) => {
              debugInfo(`[TEST-SUMMARY] Conv ${convId}: ${(events as string[]).length} events - ${(events as string[]).slice(0, 5).join(', ')}${(events as string[]).length > 5 ? '...' : ''}`);
            });

          } else {
            debugWarn('[TEST-WARNING] ⚠️  Layer debug data not available - debug infrastructure may not be loaded');
          }

          const browserDebugData = comprehensiveDebugData.browserDebugData;
          if (browserDebugData) {
            debugInfo('[TEST-SUMMARY] === BROWSER-SPECIFIC DEBUG DATA ===');
            debugInfo(`[TEST-SUMMARY] Browser reasoning events: ${browserDebugData.reasoningEvents?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Browser assistant messages: ${browserDebugData.assistantMessages?.length || 0}`);
            debugInfo(`[TEST-SUMMARY] Browser stream state: ${browserDebugData.streamState?.length || 0}`);

            if (browserDebugData.reasoningEvents?.length > 0) {
              debugInfo('[TEST-SUMMARY] Browser reasoning event types:', { types: browserDebugData.reasoningEvents.map((e: any) => e.type) });
            }
          }
        } catch (e) {
          debugErr('[TEST-ERROR] ❌ Failed to get comprehensive debug data:', { error: e });
        }

        // Check reasoning window state in DOM
        const reasoningWindow = page.locator('[role="region"][aria-label*="Reasoning"], details:has-text("Reasoning")');
        const reasoningVisible = await reasoningWindow.isVisible().catch(() => false);
        const reasoningText = await reasoningWindow.innerText().catch(() => '');
        debugInfo(`[TEST-SUMMARY] === DOM REASONING WINDOW STATE ===`);
        debugInfo(`[TEST-SUMMARY] Reasoning window visible: ${reasoningVisible}`);
        debugInfo(`[TEST-SUMMARY] Reasoning window text length: ${reasoningText.length}`);
        debugInfo(`[TEST-SUMMARY] Reasoning window preview: ${reasoningText.slice(0, 200)}`);

        // Check for "0 messages" issue
        if (reasoningVisible && reasoningText.includes('0 messages')) {
          debugErr(`[TEST-CRITICAL] 🚨 CONFIRMED BUG: Reasoning window shows "0 messages" despite potential data`);
        }

        debugInfo('=== END COMPREHENSIVE DEBUG ANALYSIS ===\n');
      }

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
        debugInfo('[TEST] body keys', { keys: Object.keys(body||{}) });
        debugInfo('[TEST] meta keys', { keys: Object.keys(meta||{}) });
        debugInfo('[TEST] reasoning obj', { reasonObj });
        debugInfo('[TEST] text obj', { textObj });
        debugInfo('[TEST] fields', { reasonEffort, metaEff1, metaEff2, bodyEff1, bodyEff2, chosenEffort });
        debugInfo('[TEST] verbosity fields', { bodyVerbosity, metaVerbosity, topVerbosity, chosenVerbosity });
        debugInfo('[TEST] summary fields', { reasonSummary, metaSummary, bodySummary, rawSummary });
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
    await sendAndAssert(1, 'conv2', /gpt-5-nano/i, 'medium', 'medium', 'auto');
    await sendAndAssert(2, 'conv1', /gpt-5-nano/i, 'medium', 'medium', 'null');

    // Extract SSE debug data after test completion
    debugInfo(`[TEST] Extracting SSE debug data for session: ${sessionId}`);
    const sessionData = await page.evaluate((sessionId) => {
      const win = window as any;
      return win.__SSE_LOGS?.[sessionId] || null;
    }, sessionId);

    if (sessionData) {
      const fs = require('fs').promises;
      const debugFile = `/tmp/sse-debug-${sessionId}.json`;
      await fs.writeFile(debugFile, JSON.stringify(sessionData, null, 2));
      debugInfo(`[TEST] SSE debug data saved to: ${debugFile}`);
      debugInfo(`[TEST] API calls captured: ${sessionData.apiCalls?.length || 0}`);

      // Quick analysis
      const reasoningEventCalls = sessionData.apiCalls?.filter((call: any) =>
        call.response?.streamEvents?.some((evt: any) =>
          evt.parsed?.type?.includes('reasoning')
        )
      ) || [];
      debugInfo(`[TEST] API calls with reasoning events: ${reasoningEventCalls.length}`);
    } else {
      debugWarn(`[TEST] No SSE debug data found for session: ${sessionId}`);
    }

    // Clean up the session to avoid memory leaks
    await page.evaluate((sessionId) => {
      const win = window as any;
      delete win.__SSE_DEBUG_SESSION;
      if (win.__SSE_LOGS) {
        delete win.__SSE_LOGS[sessionId];
      }
    }, sessionId);
  });
});
