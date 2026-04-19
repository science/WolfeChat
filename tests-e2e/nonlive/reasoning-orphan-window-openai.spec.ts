// Orphaned Reasoning Window bug — OpenAI half, replay-driven.
//
// The live spec (reasoning-orphan-window-bug.spec.ts) reproduces the exact
// bug path: STOP a live reasoning stream mid-flow, delete, resend. Replay
// cannot reproduce mid-stream because the fixture is fulfilled as a single
// buffered body. We migrate the broader cleanup invariant instead:
//   "After a reasoning message is deleted, a new reasoning message produces
//    exactly one reasoning window — no orphans from the prior message."
// The Anthropic half of the live spec still covers the mid-stream abort.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-orphan-window-openai.spec.ts --project=record
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
    await seedAppState(page, {
      provider: 'OpenAI',
      selectedModel: 'gpt-5.4-nano',
    });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { titleText: 'Orphan Window Test' });
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
  await page.waitForTimeout(200);
}

test('OpenAI: after deleting a reasoning message, a new one produces exactly one window', async ({ page }) => {
  test.setTimeout(120_000);

  await baseSetup(page);
  const { operateQuickSettings } = await import('../live/helpers');

  await fixturesRecordOrReplaySeq(page, {
    names: ['orphan-openai-1-monte-hall', 'orphan-openai-2-prime-101'],
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'orphan-openai two reasoning messages',
  });

  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /gpt-5\.4-nano/i,
    reasoningEffort: 'high',
    closeAfter: true,
  });

  // First reasoning message.
  await sendPrompt(page, 'Explain the Monty Hall problem step by step.');
  await waitForStreamIdle(page, 1);

  const reasoningWindows = page.locator('details[role="region"][aria-label*="Reasoning"]');
  await expect(reasoningWindows).not.toHaveCount(0, { timeout: 30_000 });

  // Delete the assistant message + any panel/window tied to it.
  await deleteAllBelowForMessage(page, 0);
  await expect(reasoningWindows).toHaveCount(0, { timeout: 10_000 });

  const storeAfterDelete = await page.evaluate(() => {
    const win = window as any;
    return {
      windows: win.__getReasoningWindows ? win.__getReasoningWindows().length : -1,
      panels: win.__getReasoningPanels ? win.__getReasoningPanels().length : -1,
    };
  });
  expect(storeAfterDelete.windows).toBe(0);
  expect(storeAfterDelete.panels).toBe(0);

  // Second reasoning message. Only 1 assistant remains (the deleted one is gone),
  // so we wait for >= 1 assistant, not 2.
  await sendPrompt(page, 'Find the smallest prime number greater than 100 and explain step by step why it is prime.');
  await waitForStreamIdle(page, 1);

  // Exactly one window for the new message — no orphans.
  await expect(reasoningWindows).toHaveCount(1, { timeout: 30_000 });

  const storeAfterNew = await page.evaluate(() => {
    const win = window as any;
    return {
      windows: win.__getReasoningWindows ? win.__getReasoningWindows().length : -1,
    };
  });
  expect(storeAfterNew.windows).toBe(1);

  if (RECORDING) {
    await page.waitForTimeout(5_000);
  }
});
