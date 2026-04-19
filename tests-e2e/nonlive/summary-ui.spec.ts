// Summary UI — migrated from live/summary-ui.spec.ts.
//
// Replay uses recorded SSE fixtures because the tests assert on real
// summary content / streaming completion. 8 tests, 16 fixtures total.
//
// Record all fixtures:
//   RECORD=1 npx playwright test tests-e2e/nonlive/summary-ui.spec.ts --project=record
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
  getSummaryContent,
  toggleSummaryActive,
  isSummaryActive,
  editSummaryContent,
  clickSummaryDeleteButton,
  getShadowedMessageCount,
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

// Most tests register ≥1 fixture for the assistant reply + 1 for the summary.
// Centralising the route registration keeps each test focused on its assertion.
async function registerFixtures(page: import('@playwright/test').Page, names: string[], promptPreview: string) {
  await fixturesRecordOrReplaySeq(page, {
    names,
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview,
  });
}

test.describe('Summary UI', () => {
  test('should show summarize button in message toolbelt', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-1-hello'], 'summarize button toolbelt');

    await sendPrompt(page, 'Hello, how are you?');
    await waitForStreamIdle(page, 1);

    const messages = page.locator('[role="listitem"]');
    const firstMessage = messages.first();
    await expect(firstMessage).toBeVisible();
    await firstMessage.hover({ force: true });
    const summarizeBtn = firstMessage.locator('button[aria-label="Summarize up to here"]');
    await expect(summarizeBtn).toBeVisible({ timeout: 2000 });

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should create and display summary when button clicked', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-2-reply', 'summary-ui-2-summary'], 'create and display summary');

    await sendPrompt(page, 'What is 2+2?');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    const content = await getSummaryContent(page, 0);
    expect(content.length).toBeGreaterThan(0);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should display summary with distinct visual styling', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-3-reply', 'summary-ui-3-summary'], 'summary visual styling');

    await sendPrompt(page, 'Hello');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const summary = page.locator('[data-testid="summary-message"]').first();
    await expect(summary).toBeVisible();

    const header = summary.locator('[data-testid="summary-header"]');
    await expect(header).toContainText(/summary/i);

    const checkbox = summary.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should toggle summary active state via checkbox', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-4-reply', 'summary-ui-4-summary'], 'toggle active state');

    await sendPrompt(page, 'Test message');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    let isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(true);

    await toggleSummaryActive(page, 0);
    isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(false);

    await toggleSummaryActive(page, 0);
    isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(true);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should show message count in summary', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, [
      'summary-ui-5-reply-1',
      'summary-ui-5-reply-2',
      'summary-ui-5-summary',
    ], 'message count in summary');

    await sendPrompt(page, 'First message');
    await waitForStreamIdle(page, 1);

    await sendPrompt(page, 'Second message');
    await waitForStreamIdle(page, 2);

    const messages = page.locator('[role="listitem"]');
    expect(await messages.count(), 'expected 4 messages (user/assistant × 2) before summarize').toBe(4);
    const lastMessageIndex = 3;

    await clickSummarizeButton(page, lastMessageIndex);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const count = await getShadowedMessageCount(page, 0);
    expect(count).toBeGreaterThan(0);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should edit summary content', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-6-reply', 'summary-ui-6-summary'], 'edit summary content');

    await sendPrompt(page, 'Original message');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const newContent = 'This is my custom edited summary text.';
    await editSummaryContent(page, 0, newContent);
    const content = await getSummaryContent(page, 0);
    expect(content).toBe(newContent);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should delete summary', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-7-reply', 'summary-ui-7-summary'], 'delete summary');

    await sendPrompt(page, 'Test for deletion');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    let summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    await clickSummaryDeleteButton(page, 0);
    await page.waitForTimeout(300);

    summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(0);

    if (RECORDING) await page.waitForTimeout(3_000);
  });

  test('should persist summary across page reload', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    await registerFixtures(page, ['summary-ui-8-reply', 'summary-ui-8-summary'], 'persist across reload');

    await sendPrompt(page, 'Persistence test');
    await waitForStreamIdle(page, 1);

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 30_000 });

    const originalContent = await getSummaryContent(page, 0);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    const reloadedContent = await getSummaryContent(page, 0);
    expect(reloadedContent).toBe(originalContent);

    if (RECORDING) await page.waitForTimeout(3_000);
  });
});
