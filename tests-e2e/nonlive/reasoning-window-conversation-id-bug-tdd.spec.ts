// TDD: Reasoning Window Conversation ID Bug — migrated from live.
// Uses a recorded reasoning SSE fixture so the test is deterministic in replay.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-window-conversation-id-bug-tdd.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixtureRecordOrReplay,
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

async function pregoto(page: import('@playwright/test').Page) {
  // Route/init-script setup only — we defer page.goto() until after the
  // clear+reload dance below so the ordering matches the original live spec.
  if (!RECORDING) {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { streamText: 'Mock answer', titleText: 'Mock Title' });
  }
}

test.describe('TDD: Reasoning Window Conversation ID Bug', () => {
  test('reasoning window should show content after fresh localStorage clear', async ({ page }) => {
    test.setTimeout(120_000);
    await pregoto(page);

    await fixtureRecordOrReplay(page, {
      name: 'reasoning-conv-id-bug-tdd',
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'what is 2+2 reasoning',
    });

    // The ordering below mirrors the original live spec: goto → clear →
    // reload → apply API-key/state. In nonlive that "apply" step is
    // satisfied by seedAppState's addInitScript auto-rerunning on reload.
    // In record mode we call bootstrapLiveAPI after reload, matching the
    // live test exactly so the fixture captures a fresh-state scenario.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    if (RECORDING) {
      const { bootstrapLiveAPI } = await import('../live/helpers');
      await bootstrapLiveAPI(page, 'OpenAI');
    }

    const { operateQuickSettings } = await import('../live/helpers');
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'high',
      closeAfter: true,
    });

    await sendPrompt(page, 'What is 2+2? Think step by step.');
    await waitForStreamIdle(page, 1);

    const reasoningWindows = page.locator('details[role="region"][aria-label*="Reasoning"]');
    await expect(reasoningWindows).toHaveCount(1);

    const messageCountText = await reasoningWindows
      .locator('span')
      .filter({ hasText: /\d+ message/ })
      .textContent();
    const messageCountNumber = parseInt(messageCountText?.match(/(\d+) message/)?.[1] || '0');
    expect(messageCountNumber).toBeGreaterThan(0);

    if (RECORDING) await page.waitForTimeout(3_000);
  });
});
