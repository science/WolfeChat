import { test, expect, Page } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';

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
      streamResponseViaResponsesAPI(prompt, undefined, callbacks).catch(console.error);
      const out = await outP;
      await doneP;
      return out;
    };
  `});
 }
 
 // Expose richer hook-based runner for TDD on event utilities
 async function bindHookedRunner(page: Page) {
   await page.addScriptTag({ type: 'module', content: `
     import { bindToCallbacks } from '/src/tests/helpers/TestSSEEvents.ts';
     import { streamResponseViaResponsesAPI } from '/src/services/openaiService.ts';
     window.__runHookedStream = async function(prompt) {
       const { callbacks, bus } = bindToCallbacks();
       const summaryP = bus.waitForReasoningSummaryDone(60000).catch(() => null);
       const textP = bus.waitForReasoningTextDone(60000).catch(() => null);
       const completedP = bus.waitForOutputCompleted(60000);
       const allDoneP = bus.waitForAllDone(60000);
       streamResponseViaResponsesAPI(prompt, undefined, callbacks).catch(console.error);
       const [summary, text, completed] = await Promise.all([summaryP, textP, completedP]);
       await allDoneP;
       return { summary, reasoning: text, completed };
     };
   `});
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
  await page.goto(APP_URL);
  await bootstrapLiveAPI(page);
  await selectReasoningModelInQuickSettings(page);
  await bindHookedRunner(page);

  const result = await page.evaluate(async () => {
    return await (window as any).__runHookedStream('Briefly explain what an API is.');
  });

  // completed must be present
  expect(result?.completed?.finalText?.length || 0).toBeGreaterThan(0);
  // reasoning fields may or may not exist depending on model/response; tolerate null
  if (result.summary != null) expect(String(result.summary).length).toBeGreaterThan(0);
  if (result.reasoning != null) expect(String(result.reasoning).length).toBeGreaterThan(0);
});

