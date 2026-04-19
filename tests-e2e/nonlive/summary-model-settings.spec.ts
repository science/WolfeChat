// Summary model settings — migrated from live/summary-model-settings.spec.ts.
//
// 4 tests. Test 3 is pure UI (Settings panel introspection); tests 1/2/4 use
// recorded SSE fixtures for both the assistant reply and the summary stream.
//
// Record all fixtures:
//   RECORD=1 npx playwright test tests-e2e/nonlive/summary-model-settings.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixturesRecordOrReplaySeq,
  waitForStreamIdle,
} from './mock-helpers';
import {
  clickSummarizeButton,
  waitForSummaryComplete,
  getSummaryCount,
  getSummaryModel,
} from '../live/summary-helpers';

const RECORDING = !!process.env.RECORD;

async function sendPrompt(page: import('@playwright/test').Page, text: string) {
  const textarea = page.getByRole('textbox', { name: /chat input/i });
  await expect(textarea).toBeVisible();
  await textarea.click({ force: true });
  await textarea.fill(text);
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
}

async function baseSetup(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI, disableAutoTitleGeneration } = await import('../live/helpers');
    await disableAutoTitleGeneration(page);
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await page.addInitScript(() => {
      try { localStorage.setItem('title_generation_enabled', 'false'); } catch {}
    });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { streamText: 'Mock assistant response.', titleText: 'Mock Title' });
    await page.goto('/');
  }
}

test.describe('Summary Model Settings', () => {
  test('summary should display model name in header', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await fixturesRecordOrReplaySeq(page, {
      names: ['summary-model-1-reply', 'summary-model-1-summary'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'summary model name header',
    });

    await sendPrompt(page, 'Hello, how are you today?');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const modelName = await getSummaryModel(page, 0);
    expect(modelName.length).toBeGreaterThan(0);
    expect(modelName).toMatch(/^(gpt-|claude-)/);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('summary should use conversation model by default', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await fixturesRecordOrReplaySeq(page, {
      names: ['summary-model-2-reply', 'summary-model-2-summary'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'summary uses conversation model',
    });

    await sendPrompt(page, 'What is 2 plus 2?');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const summaryModel = await getSummaryModel(page, 0);
    expect(summaryModel.length).toBeGreaterThan(0);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('summary model setting should appear in Settings menu', async ({ page }) => {
    // UI-only — no fixtures needed.
    test.setTimeout(60_000);
    await baseSetup(page);
    const { openSettings, saveAndCloseSettings } = await import('../live/helpers');

    await openSettings(page);

    const summaryModelSection = page.locator('h3:has-text("Summary Generation")');
    await expect(summaryModelSection).toBeVisible({ timeout: 5_000 });

    const summaryModelSelect = page.locator('#summary-model-selection');
    await expect(summaryModelSelect).toBeVisible();

    const defaultOption = summaryModelSelect.locator('option:has-text("Use conversation model")');
    expect(await defaultOption.count()).toBeGreaterThan(0);

    await saveAndCloseSettings(page);
  });

  test('summary should include message count in header', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await fixturesRecordOrReplaySeq(page, {
      names: [
        'summary-model-4-reply-1',
        'summary-model-4-reply-2',
        'summary-model-4-summary',
      ],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'summary message count in header',
    });

    await sendPrompt(page, 'Hello!');
    await waitForStreamIdle(page, 1);

    await sendPrompt(page, 'How are you?');
    await waitForStreamIdle(page, 2);

    await clickSummarizeButton(page, 3);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const count = await getSummaryCount(page);
    expect(count).toBe(1);

    const summary = page.locator('[data-testid="summary-message"]').first();
    const headerText = await summary.locator('[data-testid="summary-header"]').innerText();
    expect(headerText).toMatch(/\d+ message/);

    if (RECORDING) await page.waitForTimeout(3_000);
  });
});
