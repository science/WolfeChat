// Two Anthropic reasoning messages — migrated from live with recorded fixtures.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/anthropic_two_messages_simple.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
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
    await bootstrapLiveAPI(page, 'Anthropic');
  } else {
    await seedAppState(page, { provider: 'Anthropic', selectedModel: 'claude-sonnet-4-5-20250929' });
    await page.goto('/');
  }
}

test.describe('Anthropic Two Messages Test', () => {
  test('Two Anthropic reasoning messages with adequate wait', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: ['anthropic-2msg-1', 'anthropic-2msg-2'],
      urlSubstring: 'api.anthropic.com/v1/messages',
      matchBody: '"stream":true',
      promptPreview: 'anthropic two reasoning messages',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true,
    });

    await sendPrompt(page, '1+1');
    await waitForStreamIdle(page, 1);

    const after1 = await page.locator('details:has-text("Reasoning")').count();
    expect(after1).toBe(1);

    await sendPrompt(page, '2+2');
    await waitForStreamIdle(page, 2);

    const after2 = await page.locator('details:has-text("Reasoning")').count();
    expect(after2).toBe(2);

    if (RECORDING) await page.waitForTimeout(5_000);
  });
});
