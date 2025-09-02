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

// Live test 3: tolerant to reasoning behavior
// We do not assert reasoning events explicitly, only that completion occurs

test('Live SSE: completion without depending on reasoning events', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto(APP_URL);
  await bootstrapLiveAPI(page);
  await selectReasoningModelInQuickSettings(page);
  await bindWrapper(page); // after API bootstrap and model select

  const { finalText } = await page.evaluate(async () => {
    return await (window as any).__runBoundStream('Answer in one sentence. Do not include chain-of-thought.');
  });

  expect(finalText.trim().length).toBeGreaterThan(0);
});
