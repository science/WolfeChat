// Delete All Below — migrated from live with recorded fixtures.
// 1 test, 4 streaming messages → 4 fixtures.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/delete-all-below.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
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
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { streamText: 'Mock reply', titleText: 'Mock Title' });
    await page.goto('/');
  }
}

async function deleteAllBelowForMessage(page: import('@playwright/test').Page, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();
  await item.hover({ force: true });

  const deleteAllBtn = item.locator('button[aria-label="Delete all messages below"]').first();
  await expect(deleteAllBtn).toBeVisible();
  await deleteAllBtn.click({ force: true });

  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click({ force: true });
    }
  }
}

test.describe('Delete All Below', () => {
  test('deletes messages below pivot and remains usable', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetup(page);
    const { selectReasoningModelInQuickSettings, getVisibleMessages } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: [
        'delete-below-1-hello',
        'delete-below-2-math',
        'delete-below-3-montyhall',
        'delete-below-4-after-delete',
      ],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'delete all below flow',
    });

    await selectReasoningModelInQuickSettings(page);

    await sendPrompt(page, 'Say hello with one short sentence.');
    await waitForStreamIdle(page, 1);

    await sendPrompt(page, 'What is 2+2? Answer in one word.');
    await waitForStreamIdle(page, 2);

    await sendPrompt(
      page,
      'We are playing the Monty Hall problem with 3 doors. I choose door 1. Monty opens door 3 to reveal a goat. Should I switch? Explain briefly use careful logic. Think hard about your answer.',
    );
    await waitForStreamIdle(page, 3);

    // At least one reasoning panel must have appeared at some point.
    const maybeReasoning = page.locator(
      '[role="region"][aria-label~="Reasoning"], details[role="region"][aria-label="Reasoning"], summary:has-text("Reasoning")',
    );
    await expect(maybeReasoning.first()).toBeVisible({ timeout: 20_000 });

    let msgs = await getVisibleMessages(page);
    expect(msgs.length).toBeGreaterThanOrEqual(3);
    const pivotIndex = Math.floor((msgs.length - 1) / 2);
    const pivotText = msgs[pivotIndex].text;

    await deleteAllBelowForMessage(page, pivotIndex);

    msgs = await getVisibleMessages(page);
    const pivotNowIndex = msgs.findIndex(m =>
      m.text.includes(pivotText.slice(0, Math.min(20, pivotText.length))),
    );
    expect(pivotNowIndex).toBeGreaterThanOrEqual(0);
    expect(msgs.length - 1).toBe(pivotNowIndex);

    await sendPrompt(page, 'After deletion, can you still respond? Answer yes/no.');
    // After delete, assistant count resets then grows to pivotNowIndex+1 assistants(?)
    // Safer: just wait for idle with a generous target.
    await page.waitForTimeout(500);
    const assistants = await page.locator('[role="listitem"][data-message-role="assistant"]').count();
    await waitForStreamIdle(page, Math.max(1, assistants));

    const after = await getVisibleMessages(page);
    expect(after.length).toBeGreaterThan(msgs.length);

    if (RECORDING) await page.waitForTimeout(5_000);
  });
});
