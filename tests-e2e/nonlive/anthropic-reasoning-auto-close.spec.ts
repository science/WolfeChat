// Anthropic reasoning auto-close — migrated from live with recorded fixtures.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/anthropic-reasoning-auto-close.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
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
    await bootstrapLiveAPI(page, 'Anthropic');
  } else {
    await seedAppState(page, { provider: 'Anthropic', selectedModel: 'claude-sonnet-4-5-20250929' });
    await page.goto('/');
  }
}

test.describe('Anthropic Reasoning Auto-Close', () => {
  test('should auto-close reasoning window when assistant message starts', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixtureRecordOrReplay(page, {
      name: 'anthropic-autoclose-1-single',
      urlSubstring: 'api.anthropic.com/v1/messages',
      matchBody: '"stream":true',
      promptPreview: 'single message auto-close',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true,
    });

    await sendPrompt(page, 'What is 2+2? Think step by step.');

    const reasoningWindow = page.locator('details:has-text("Reasoning")');
    // Skip the "initially open" assertion: in replay the stream completes
    // before the assertion can observe the transient open state.
    await waitForStreamIdle(page, 1);
    await page.waitForTimeout(500);

    expect(await reasoningWindow.getAttribute('open')).toBeNull();

    if (RECORDING) await page.waitForTimeout(5_000);
  });

  test('should auto-close for multiple consecutive Anthropic messages', async ({ page }) => {
    test.setTimeout(180_000);
    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: ['anthropic-autoclose-2-msg1', 'anthropic-autoclose-2-msg2'],
      urlSubstring: 'api.anthropic.com/v1/messages',
      matchBody: '"stream":true',
      promptPreview: 'consecutive auto-close',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true,
    });

    const verifyAutoClose = async (messageNum: number) => {
      const reasoningWindow = page.locator('details:has-text("Reasoning")').nth(messageNum - 1);
      await waitForStreamIdle(page, messageNum);
      await page.waitForTimeout(500);
      expect(await reasoningWindow.getAttribute('open')).toBeNull();
    };

    await sendPrompt(page, 'Explain the Monty Hall problem in one sentence.');
    await verifyAutoClose(1);

    await sendPrompt(page, 'Why does the prisoner dilemma matter in game theory?');
    await verifyAutoClose(2);

    if (RECORDING) await page.waitForTimeout(5_000);
  });
});
