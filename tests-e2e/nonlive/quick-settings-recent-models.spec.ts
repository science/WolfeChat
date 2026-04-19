// Quick Settings recent-models — migrated from live with recorded fixtures.
// Verifies that sending a message with a model adds it to the "Recently used"
// optgroup; tests 2 and 3 replay recorded SSE for gpt-4.1-nano and gpt-5.4-nano.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/quick-settings-recent-models.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixtureRecordOrReplay,
  fixturesRecordOrReplaySeq,
  waitForStreamIdle,
} from './mock-helpers';

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
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-4.1-nano' });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { streamText: 'Mock reply', titleText: 'Mock Title' });
    await page.goto('/');
  }
  // Clear any stale recent_models regardless of mode.
  await page.evaluate(() => localStorage.removeItem('recent_models'));
}

test.describe('Quick Settings recent-models', () => {
  test.setTimeout(120_000);

  test('initial state has no recent models, all models in main list', async ({ page }) => {
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await operateQuickSettings(page, { mode: 'ensure-open' });

    const modelSelect = page.locator('#current-model-select');
    await expect(modelSelect).toBeVisible();

    const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
    expect(await recentOptgroup.isVisible().catch(() => false)).toBe(false);

    const allModelsOptgroup = modelSelect.locator('optgroup[label="All models"]');
    const hasAllModelsGroup = await allModelsOptgroup.isVisible().catch(() => false);
    const available = hasAllModelsGroup ? allModelsOptgroup.locator('option') : modelSelect.locator('option');
    expect(await available.count()).toBeGreaterThan(0);

    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });

  test('sending message with selected model adds it to recent models section', async ({ page }) => {
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixtureRecordOrReplay(page, {
      name: 'recent-models-2-gpt41nano',
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'recent models add gpt-4.1-nano',
    });

    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-4\.1-nano/i });
    const modelSelect = page.locator('#current-model-select');
    const selectedModel = await modelSelect.inputValue();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'Test message to add model to recent list');
    await waitForStreamIdle(page, 1);

    await operateQuickSettings(page, { mode: 'ensure-open' });
    await expect(modelSelect).toBeVisible();
    await page.waitForTimeout(500);

    const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
    const recentOptions = recentOptgroup.locator('option');
    const recentCount = await recentOptions.count();
    expect(recentCount).toBeGreaterThanOrEqual(1);

    const recentTexts: string[] = [];
    for (let i = 0; i < recentCount; i++) {
      recentTexts.push((await recentOptions.nth(i).textContent()) || '');
    }
    expect(recentTexts).toContain(selectedModel);

    const allModelsOptgroup = modelSelect.locator('optgroup[label="All models"]');
    const allOptions = allModelsOptgroup.locator('option');
    const allCount = await allOptions.count();
    const allTexts: string[] = [];
    for (let i = 0; i < allCount; i++) {
      allTexts.push((await allOptions.nth(i).textContent()) || '');
    }
    expect(allTexts).not.toContain(selectedModel);

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('switching models and sending messages builds recent models list', async ({ page }) => {
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: ['recent-models-3-gpt41nano', 'recent-models-3-gpt54nano'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'recent models two distinct',
    });

    const modelSelect = page.locator('#current-model-select');

    // First message with gpt-4.1-nano.
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-4\.1-nano/i });
    const firstModel = await modelSelect.inputValue();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'First test message with gpt-4.1-nano');
    await waitForStreamIdle(page, 1);

    // Switch to gpt-5.4-nano.
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.4-nano/i });
    const secondModel = await modelSelect.inputValue();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'Second test message with gpt-5.4-nano');
    await waitForStreamIdle(page, 2);

    await operateQuickSettings(page, { mode: 'ensure-open' });
    const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
    const recentOptions = recentOptgroup.locator('option');
    const recentCount = await recentOptions.count();
    expect(recentCount).toBeGreaterThanOrEqual(1);

    const recentTexts: string[] = [];
    for (let i = 0; i < recentCount; i++) {
      recentTexts.push((await recentOptions.nth(i).textContent()) || '');
    }

    // Most-recently-used goes first.
    expect(recentTexts[0]).toBe(secondModel);
    if (recentCount >= 2) {
      expect(recentTexts).toContain(firstModel);
      expect(recentTexts[1]).toBe(firstModel);
    }

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (RECORDING) await page.waitForTimeout(3_000);
  });
});
