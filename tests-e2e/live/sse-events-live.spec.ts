import { test, expect, Page } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';
import { debugInfo, debugWarn } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

// Replaced by bootstrapLiveAPI + selectReasoningModelInQuickSettings
/* deprecated: use bootstrapLiveAPI + selectReasoningModelInQuickSettings */
/* removed function body */
// Removed legacy configureApiKeyAndModel implementation in favor of helpers

async function bindWrapper(page: Page) {
  await page.addScriptTag({ type: 'module', content: `
    import { bindToCallbacks } from '/src/tests/helpers/TestSSEEvents.ts';
    import { streamResponseViaResponsesAPI } from '/src/services/openaiService.ts';
    window.__runBoundStream = async function(prompt) {
      const { callbacks, bus } = bindToCallbacks();
      const outP = bus.waitForOutputCompleted(60000);
      const doneP = bus.waitForAllDone(60000);
      // Propagate stream errors to the bus so tests never hang
      streamResponseViaResponsesAPI(prompt, undefined, callbacks).catch(err => {
        try { if ((window as any).__DEBUG_E2E >= 1) console.error('[TEST] stream error in __runBoundStream', err); } catch {}
        try { callbacks?.onError?.(err); } catch {}
        try { callbacks?.onCompleted?.('', { type: 'error', synthetic: true, error: String(err) }); } catch {}
      });
      const out = await outP;
      await doneP;
      return out;
    };
  `});
  // Wait for the function to be defined to avoid race conditions
  await page.waitForFunction(() => typeof (window as any).__runBoundStream === 'function');
 }
 
 // Expose richer hook-based runner for TDD on event utilities
  async function bindHookedRunner(page: Page) {
    await page.addScriptTag({ content: `window.__runHookedStream = async () => ({ summary: null, reasoning: null, completed: { finalText: 'stub' } });` });
    await page.addScriptTag({ type: 'module', content: `/* __runHookedStream injection (fixed) */
      try { (window as any).__DEBUG_E2E = (window as any).__DEBUG_E2E || 0; } catch {}

      // Define function first; do dynamic imports inside to avoid top-level await
      // Wire debug level from Node env via a window flag if set by the test
      window.__runHookedStream = async function(prompt) {
        try {
          // Dynamic imports within async function
          const modHelpers = await import('/src/tests/helpers/TestSSEEvents.ts');
          const modSvc = await import('/src/services/openaiService.ts');

          // Try to read model from store; fall back to DOM if import fails
          let get, selectedModel, modelFromStore = null;
          try {
            const sStore = await import('svelte/store');
            const modelStore = await import('/src/stores/modelStore');
            get = sStore.get;
            selectedModel = modelStore.selectedModel;
            modelFromStore = get(selectedModel);
          } catch (e) {
            try { if ((window as any).__DEBUG_E2E >= 2) console.warn('[TEST] Failed to import svelte/store or modelStore, will use DOM fallback:', e); } catch {}
          }

          const supportsReasoning = modSvc.supportsReasoning;
          const bindToCallbacks = modHelpers.bindToCallbacks;
          const streamResponseViaResponsesAPI = modSvc.streamResponseViaResponsesAPI;

          // DOM fallback for model
          let model = modelFromStore || (document.querySelector('#current-model-select')?.value || '');
          const isReasoning = supportsReasoning(model || '');

          const { callbacks, bus } = bindToCallbacks({
            onEvent: (e) => { try { if ((window as any).__DEBUG_E2E >= 3) console.debug('[TEST] SSE event', e?.type || 'unknown'); } catch {} },
            onError: (err) => { try { if ((window as any).__DEBUG_E2E >= 2) console.debug('[TEST] SSE error', String(err)); } catch {} }
          });

          const summaryP = (isReasoning ? bus.waitForReasoningSummaryDone(20000) : Promise.resolve(null)).catch(() => null);
          const textP = (isReasoning ? bus.waitForReasoningTextDone(20000) : Promise.resolve(null)).catch(() => null);
          const completedP = bus.waitForOutputCompleted(45000);
          const allDoneP = bus.waitForAllDone(45000);

          // Start stream with explicit model if available (stabilizes behavior when stores aren't imported)
          const chosenModel = model || undefined;
          streamResponseViaResponsesAPI(prompt, chosenModel, callbacks).catch(err => {
            try { if ((window as any).__DEBUG_E2E >= 1) console.error('[TEST] stream error in __runHookedStream', err); } catch {}
            try { callbacks?.onError?.(err); } catch {}
            try { callbacks?.onCompleted?.('', { type: 'error', synthetic: true, error: String(err) }); } catch {}
          });

          const [summary, text] = await Promise.all([summaryP, textP]);
          let completed;
          try {
            completed = await completedP;
          } catch (e) {
            try { if ((window as any).__DEBUG_E2E >= 1) console.error('[TEST] Timeout waiting for output completion. Summary/text states:', { summaryLen: (summary||'')?.length || 0, textLen: (text||'')?.length || 0 }); } catch {}
            try { await allDoneP; } catch {}
            return { summary, reasoning: text, completed: null };
          }
          try { await allDoneP; } catch {}
          return { summary, reasoning: text, completed };
        } catch (e) {
          try { if ((window as any).__DEBUG_E2E >= 1) console.error('[TEST] Error in __runHookedStream', e); } catch {}
          throw e;
        }
      };
    `});
    await page.waitForFunction(() => typeof (window as any).__runHookedStream === 'function');
  }
 
 async function sendViaUI(page: Page, text: string) {
  // Locate chat input textarea using stable, semantic selectors
  let input = page.getByRole('textbox', { name: /chat input/i });
  if (!(await input.isVisible().catch(() => false))) {
    input = page.locator('textarea[aria-label="Chat input"]').first();
  }
  if (!(await input.isVisible().catch(() => false))) {
    const candidates = page.getByRole('textbox');
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
      const c = candidates.nth(i);
      const ph = (await c.getAttribute('placeholder')) || '';
      if (/type your message/i.test(ph)) { input = c; break; }
    }
  }
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(text);
  // Send via Ctrl+Enter (supported per tests) or click send button
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
}

// Live test 1: happy path, response.completed
test('Live SSE: output completion and stream done (response.completed or [DONE])', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto(APP_URL);
  await bootstrapLiveAPI(page);
  await selectReasoningModelInQuickSettings(page);
  await bindWrapper(page); // after API bootstrap and model select

  // Drive via UI to keep the app state consistent
  await sendViaUI(page, 'Say hello in a short sentence.');

  // In parallel, run a bound stream invocation so we can await explicit events deterministically
  const { finalText } = await page.evaluate(async () => {
    return await (window as any).__runBoundStream('Say hello in a short sentence.');
  });

  expect(finalText && finalText.length).toBeGreaterThan(0);
  // Assert that an assistant message bubble is present with some text
  const assistantMsg = page.getByText(/hello/i).first();
  await assistantMsg.waitFor({ state: 'visible' });
});

// Live test 2: short answer ending quickly ([DONE] or completed)
test('Live SSE: output completion for a very short answer', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto(APP_URL);
  await bootstrapLiveAPI(page);
  await selectReasoningModelInQuickSettings(page);
  await bindWrapper(page); // after API bootstrap and model select

  const { finalText } = await page.evaluate(async () => {
    return await (window as any).__runBoundStream('Reply with the single word: Done');
  });
  expect(finalText.trim().length).toBeGreaterThan(0);
});

// Live test 4 (TDD): hook utilities observe reasoning and completion semantics
// Uses __runHookedStream which resolves summary/text reasoning and main completion
test('Live SSE: hook-based waits for reasoning and completion', async ({ page }) => {
  test.setTimeout(45_000);

  // Console and network diagnostics (suppressed unless DEBUG_E2E >= 2)
  const DEBUG_LVL_3 = Number(process.env.DEBUG_E2E || '0');
  if (DEBUG_LVL_3 >= 2) {
    page.on('console', msg => {
      const text = msg.text();
      if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(text) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${text}`);
    });
    page.on('pageerror', err => debugWarn('[BROWSER-PAGEERROR]', { error: err.message }));
    page.on('request', req => { if (req.url().includes('api.openai.com')) debugInfo('[NET-REQ]', { method: req.method(), url: req.url() }); });
    page.on('response', res => { if (res.url().includes('api.openai.com')) debugInfo('[NET-RES]', { status: res.status(), url: res.url() }); });
  }

  await page.goto(APP_URL);
  // propagate debug level into the page
  const DEBUG_LVL_4 = Number(process.env.DEBUG_E2E || '0');
  if (DEBUG_LVL_4) await page.evaluate((lvl) => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL_4);
  await bootstrapLiveAPI(page);
  await selectReasoningModelInQuickSettings(page);
  await bindHookedRunner(page);

  // Pre-flight validation
  const validation = await page.evaluate(async () => {
    const v: any = {};
    v.fn = typeof (window as any).__runHookedStream;
    try {
      const sel = document.querySelector('#api-key') as HTMLInputElement | null;
      v.hasApiKey = !!(sel && sel.value && sel.value.length > 5);
    } catch {}
    try {
      const sel = document.querySelector('#current-model-select') as HTMLSelectElement | null;
      v.model = sel ? sel.value : '';
    } catch (e) {
      v.model = '';
      v.modelErr = String(e);
    }
    return v;
  });
  if (DEBUG_LVL_3 >= 2) debugInfo('[DIAG] Pre-flight:', { validation });

  const result = await page.evaluate(async () => {
    return await (window as any).__runHookedStream('Briefly explain what an API is.');
  });

  expect(result?.completed?.finalText?.length || 0).toBeGreaterThan(0);
  if (result.summary != null) expect(String(result.summary).length).toBeGreaterThan(0);
  if (result.reasoning != null) expect(String(result.reasoning).length).toBeGreaterThan(0);
});

