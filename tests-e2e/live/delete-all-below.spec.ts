// Live UAT for Delete All Below using Playwright
// DEBUG:
//   DEBUG_E2E=2 npx playwright test tests-e2e/live/delete-all-below.spec.ts
//   DEBUG_E2E=3 adds verbose SSE/browser logs via helpers

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings, waitForAssistantDone } from './helpers';

// Semantic locators used throughout
// (quick settings selectors centralized in helpers)
// chat input located via role+name pattern within sendMessage()
// const SEND_BUTTON = /send/i; // accessible name

// Helper: send a message via UI
async function sendMessage(page: import('@playwright/test').Page, text: string) {
  // Narrow to the actual chat input, following established e2e pattern
  let input = page.getByRole('textbox', { name: /chat input/i });
  if (!(await input.isVisible().catch(() => false))) {
    input = page.locator('textarea[aria-label="Chat input"]').first();
  }
  if (!(await input.isVisible().catch(() => false))) {
    const candidates = page.getByRole('textbox');
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
      const c = candidates.nth(i);
      const ph = (await c.getAttribute('placeholder')) || '';
      if (/type your message/i.test(ph)) { input = c; break; }
    }
  }
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(text);
  // Prefer Ctrl+Enter; fallback to clicking Send if needed
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
}

// Helper: wait for assistant streaming completion now imported from helpers.ts

// Returns ordered texts of chat messages visible
async function getVisibleMessages(page: import('@playwright/test').Page) {
  const items = page.locator('[role="listitem"]');
  const n = await items.count();
  const out: { text: string; idx: number }[] = [];
  for (let i = 0; i < n; i++) {
    const li = items.nth(i);
    const text = (await li.innerText()).trim();
    out.push({ text, idx: i });
  }
  return out;
}

// Open context/menu for a message at index and click Delete All Below
async function deleteAllBelowForMessage(page: import('@playwright/test').Page, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();

  // Hover to reveal the per-message toolbelt (buttons are hidden until hover)
  await item.hover();

  // Click the direct "Delete all messages below" button in the toolbelt
  const deleteAllBtn = item.locator('button[aria-label="Delete all messages below"]').first();
  await expect(deleteAllBtn).toBeVisible();
  await deleteAllBtn.click();

  // If a confirmation dialog appears, confirm
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
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

    // 2) Select reasoning-capable model (gpt-5-nano preferred)
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
