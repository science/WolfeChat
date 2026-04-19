// Issue #12: reasoning panels should be removed when "delete all below" runs.
// Deterministic replay — the live spec needed retry logic to cope with the
// API sometimes skipping reasoning events; the fixture pins that variance.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-panels-delete-bug.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixturesRecordOrReplaySeq,
  waitForStreamIdle,
} from './mock-helpers';

const RECORDING = !!process.env.RECORD;
const REASONING_PROMPT = 'Is 91 prime? Explain step by step why or why not.';

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
    await mockResponsesEndpoint(page, { titleText: 'Delete Bug Test' });
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

test.describe('Issue #12: reasoning panels removed with messages', () => {
  test('reasoning panels should be removed when delete-all-below is clicked', async ({ page }) => {
    test.setTimeout(120_000);

    await baseSetup(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixturesRecordOrReplaySeq(page, {
      names: ['delete-bug-reasoning'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'Is 91 prime (reasoning)',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano/i,
      reasoningEffort: 'high',
      closeAfter: true,
    });

    await sendPrompt(page, REASONING_PROMPT);
    await waitForStreamIdle(page, 1);

    // Panel must exist before we can test deletion.
    const reasoningPanels = page.locator('details[role="region"][aria-label*="Reasoning"]');
    await expect(reasoningPanels).not.toHaveCount(0, { timeout: 30_000 });
    const panelsBefore = await reasoningPanels.count();
    expect(panelsBefore).toBeGreaterThan(0);

    // Store state before deletion (sanity).
    const storeBefore = await page.evaluate(() => {
      const win = window as any;
      const panels = win.__getReasoningPanels ? win.__getReasoningPanels() : null;
      const windows = win.__getReasoningWindows ? win.__getReasoningWindows() : null;
      return {
        panelCount: panels?.length ?? -1,
        windowCount: windows?.length ?? -1,
      };
    });
    expect(storeBefore.panelCount).toBeGreaterThan(0);
    expect(storeBefore.windowCount).toBeGreaterThan(0);

    // Verify messages present (user + assistant).
    const itemsBefore = page.locator('[role="listitem"]');
    expect(await itemsBefore.count()).toBe(2);

    // Trigger delete-all-below on the user message.
    await deleteAllBelowForMessage(page, 0);
    await page.waitForTimeout(300);

    // Only user message remains.
    const itemsAfter = page.locator('[role="listitem"]');
    expect(await itemsAfter.count()).toBe(1);

    // UI panels gone.
    await expect(reasoningPanels).toHaveCount(0);

    // Store panels + windows fully cleaned.
    const storeAfter = await page.evaluate(() => {
      const win = window as any;
      const panels = win.__getReasoningPanels ? win.__getReasoningPanels() : null;
      const windows = win.__getReasoningWindows ? win.__getReasoningWindows() : null;
      return {
        panelCount: panels?.length ?? -1,
        windowCount: windows?.length ?? -1,
      };
    });
    expect(storeAfter.windowCount).toBe(0);
    expect(storeAfter.panelCount).toBe(0);

    if (RECORDING) {
      await page.waitForTimeout(3_000);
    }
  });
});
