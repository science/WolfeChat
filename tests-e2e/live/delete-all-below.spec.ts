// Live UAT for Delete All Below using Playwright
// DEBUG:
//   DEBUG=2 npx playwright test tests-e2e/live/delete-all-below.spec.ts
//   DEBUG=3 adds verbose SSE/browser logs via helpers

import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  selectReasoningModelInQuickSettings,
  waitForAssistantDone,
  sendMessage,
  getVisibleMessages
} from './helpers';

// Open context/menu for a message at index and click Delete All Below
async function deleteAllBelowForMessage(page: import('@playwright/test').Page, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();

  // Hover to reveal the per-message toolbelt (buttons are hidden until hover)
  await item.hover({ force: true });

  // Click the direct "Delete all messages below" button in the toolbelt
  const deleteAllBtn = item.locator('button[aria-label="Delete all messages below"]').first();
  await expect(deleteAllBtn).toBeVisible();
  await deleteAllBtn.click({ force: true });

  // If a confirmation dialog appears, confirm
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click({ force: true });
    }
  }
}

// Reasoning windows resilience: we only assert that at least one reasoning panel appears for a Monte Hall prompt
// Number can vary. We avoid counting exact panels; we gate on existence.
async function expectAtLeastOneReasoningPanel(page: import('@playwright/test').Page) {
  const maybeReasoning = page.locator('[role="region"][aria-label~="Reasoning"], details[role="region"][aria-label="Reasoning"], summary:has-text("Reasoning")');
  await expect(maybeReasoning.first()).toBeVisible({ timeout: 20_000 });
}

// Main UAT
// Creates 3 exchanges, deletes all below the middle message, validates state, and continues chatting.
test.describe('Delete All Below - live UAT', () => {
  test.setTimeout(60_000);

  test('deletes messages below pivot and remains usable', async ({ page }) => {
    // 1) Boot and configure live API
    await page.goto('/');
    await bootstrapLiveAPI(page);

    // 2) Select reasoning-capable model (TEST_MODEL — see selectReasoningModelInQuickSettings)
    await selectReasoningModelInQuickSettings(page);

    // 3) Seed conversation: three messages
    await sendMessage(page, 'Say hello with one short sentence.');
    await waitForAssistantDone(page);

    await sendMessage(page, 'What is 2+2? Answer in one word.');
    await waitForAssistantDone(page);

    // Monte Hall style to trigger reasoning windows (medium default assumed)
    await sendMessage(page, 'We are playing the Monty Hall problem with 3 doors. I choose door 1. Monty opens door 3 to reveal a goat. Should I switch? Explain briefly use careful logic. Think hard about your answer.');
    await waitForAssistantDone(page);

    // 4) Expect at least one reasoning panel was shown at some point (robust to variable count)
    await expectAtLeastOneReasoningPanel(page);

    // 5) Capture messages, choose pivot index (middle)
    let msgs = await getVisibleMessages(page);
    expect(msgs.length).toBeGreaterThanOrEqual(3);
    const pivotIndex = Math.floor((msgs.length - 1) / 2);
    const pivotText = msgs[pivotIndex].text;

    // 6) Delete all below pivot
    await deleteAllBelowForMessage(page, pivotIndex);

    // 7) Validate: pivot still exists; nothing below remains
    msgs = await getVisibleMessages(page);
    const pivotNowIndex = msgs.findIndex(m => m.text.includes(pivotText.slice(0, Math.min(20, pivotText.length))));
    expect(pivotNowIndex).toBeGreaterThanOrEqual(0);
    // Ensure no messages appear after pivot index
    expect(msgs.length - 1).toBe(pivotNowIndex);

    // 8) Continue usage: send another message and receive response
    await sendMessage(page, 'After deletion, can you still respond? Answer yes/no.');
    await waitForAssistantDone(page);

    // Expect latest assistant reply exists
    const after = await getVisibleMessages(page);
    expect(after.length).toBeGreaterThan(msgs.length);
  });
});
