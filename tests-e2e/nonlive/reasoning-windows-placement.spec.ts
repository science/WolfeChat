// Reasoning window placement UI behaviour — deterministic playback from fixtures.
//
// Replay mode (default): serves pre-recorded SSE bodies from tests-e2e/fixtures/.
// Record mode (RECORD=1, --project=record): hits the real API and regenerates.
//
// Record ALL fixtures in this file:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-windows-placement.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixturesRecordOrReplaySeq,
  waitForStreamIdle,
} from './mock-helpers';

const REASONING_PROMPT = 'Explain the Monte Hall 3 door problem using logic';
const RECORDING = !!process.env.RECORD;

async function sendPrompt(page: import('@playwright/test').Page, text: string) {
  const textarea = page.getByRole('textbox', { name: /chat input/i });
  await expect(textarea).toBeVisible();
  await textarea.fill(text);
  const sendBtn = page.getByRole('button', { name: /send/i });
  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click({ force: true });
  } else {
    await textarea.press('Enter');
  }
}

async function baseSetup(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, {
      provider: 'OpenAI',
      selectedModel: 'gpt-5.4-nano',
    });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { titleText: 'Placement Test' });
    await page.goto('/');
  }
}

test.describe('Reasoning Windows Placement', () => {
  test('RW appear with reasoning content and bind to correct message', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    // Fixtures AFTER baseSetup so LIFO priority gives them to the streaming
    // requests before the catch-all in mockResponsesEndpoint can claim them.
    await fixturesRecordOrReplaySeq(page, {
      names: ['rw-placement-1-hello', 'rw-placement-1-monte-hall-heavy'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'T1 hello+monte-hall',
    });

    // Baseline: 'Hello' with whatever the initial model/effort is (no reasoning panels).
    await sendPrompt(page, 'Hello');
    await waitForStreamIdle(page, 1);
    let reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(0);

    // Switch to reasoning-heavy and send Monte Hall.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'high',
      closeAfter: true,
    });
    await sendPrompt(page, REASONING_PROMPT);

    // Reasoning region appears with content.
    await expect(reasoningWindows).not.toHaveCount(0, { timeout: 30_000 });
    const firstRW = reasoningWindows.first();
    await expect(firstRW.locator('pre').first()).toHaveText(/\S+/, { timeout: 30_000 });

    // Main assistant response is in place too.
    await waitForStreamIdle(page, 2);
    const messages = page.locator('.message');
    expect(await messages.count()).toBeGreaterThanOrEqual(3);

    if (RECORDING) {
      await page.waitForTimeout(8_000);
    }
  });

  test('RW placement remains stable when new messages are added', async ({ page }) => {
    test.setTimeout(150_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: [
        'rw-placement-2-monte-hall-heavy',
        'rw-placement-2-summary-heavy',
        'rw-placement-2-thanks-heavy',
      ],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'T2 stability',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'high',
      closeAfter: true,
    });

    await sendPrompt(page, REASONING_PROMPT);
    await waitForStreamIdle(page, 1);

    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).not.toHaveCount(0, { timeout: 30_000 });
    await expect(reasoningWindows.first().locator('pre').first()).toHaveText(/\S+/, { timeout: 30_000 });

    const initialPosition = await page.evaluate(() => {
      const details = document.querySelector('details');
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop,
      };
    });
    expect(initialPosition).not.toBeNull();

    await sendPrompt(page, 'In one sentence, summarize the key insight.');
    await waitForStreamIdle(page, 2);

    await sendPrompt(page, 'Thank you');
    await waitForStreamIdle(page, 3);

    const finalPosition = await page.evaluate(() => {
      const details = document.querySelector('details');
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop,
      };
    });
    expect(finalPosition).not.toBeNull();

    const adjustedInitial = initialPosition!.relativeTop + initialPosition!.scrollTop;
    const adjustedFinal = finalPosition!.relativeTop + finalPosition!.scrollTop;
    const positionDrift = Math.abs(adjustedFinal - adjustedInitial);
    expect(positionDrift).toBeLessThan(30);

    if (RECORDING) {
      await page.waitForTimeout(8_000);
    }
  });

  test('Non-reasoning model shows no RW, reasoning model shows RW', async ({ page }) => {
    test.setTimeout(150_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: [
        'rw-placement-3-monte-hall-off',
        'rw-placement-3-monte-hall-heavy',
        'rw-placement-3-thanks-off',
      ],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'T3 off/on/off',
    });

    // Reasoning OFF first — expect no panels.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'none',
      closeAfter: true,
    });
    await sendPrompt(page, REASONING_PROMPT);
    await waitForStreamIdle(page, 1);

    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(0);

    // Reasoning HEAVY — expect ≥1 panel with content.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'high',
      closeAfter: true,
    });
    await sendPrompt(page, REASONING_PROMPT);
    await waitForStreamIdle(page, 2);

    await expect(reasoningWindows).not.toHaveCount(0, { timeout: 30_000 });
    const initialCount = await reasoningWindows.count();
    await expect(reasoningWindows.first().locator('pre').first()).toHaveText(/\S+/, { timeout: 30_000 });

    // Reasoning OFF again — panel count must NOT grow.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'none',
      closeAfter: true,
    });
    await sendPrompt(page, 'Thank you for the explanation');
    await waitForStreamIdle(page, 3);

    const finalCount = await reasoningWindows.count();
    expect(finalCount).toBe(initialCount);

    if (RECORDING) {
      await page.waitForTimeout(8_000);
    }
  });
});
