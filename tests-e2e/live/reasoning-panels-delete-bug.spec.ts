// TDD Test: Reasoning panels should be removed when messages are deleted
// This test demonstrates Issue #12: reasoning panels persist after "delete all below"
//
// DEBUG:
//   DEBUG=2 npx playwright test tests-e2e/live/reasoning-panels-delete-bug.spec.ts

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, waitForAssistantDone } from './helpers';

// Helper: send a message via UI
async function sendMessage(page: import('@playwright/test').Page, text: string) {
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
  await input.click({ force: true });
  await input.fill(text);
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
}

// Get visible messages
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

// Delete all messages below a specific index
async function deleteAllBelowForMessage(page: import('@playwright/test').Page, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();
  await item.hover({ force: true });

  const deleteAllBtn = item.locator('button[aria-label="Delete all messages below"]').first();
  await expect(deleteAllBtn).toBeVisible();
  await deleteAllBtn.click({ force: true });

  // Handle confirmation dialog if present
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click({ force: true });
    }
  }
}

// Check for reasoning WINDOWS in the DOM (not individual panels within)
async function getReasoningPanelCount(page: import('@playwright/test').Page): Promise<number> {
  // Look for reasoning window containers (details elements only, not summaries)
  const reasoningWindows = page.locator('details[role="region"][aria-label*="Reasoning"]');
  const count = await reasoningWindows.count();
  return count;
}

// Main test
test.describe('Issue #12: Reasoning panels should be deleted with messages', () => {
  test.setTimeout(240_000); // Allow up to 3 setup retries at ~60s each

  test('reasoning panels should be removed when delete-all-below is clicked', async ({ page }) => {
    // 1) Setup
    await page.goto('/');
    await bootstrapLiveAPI(page);

    // 2) Select gpt-5-nano with HIGH reasoning to ensure consistent reasoning window creation
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high',
      closeAfter: true
    });

    // 3) Produce at least one reasoning panel before testing delete behavior.
    //
    // OpenAI's gpt-5-nano does not deterministically emit `response.reasoning_summary_*`
    // SSE events — even at effort=high the API may skip reasoning output entirely for
    // prompts it considers trivial (verified: ~25% of runs of "What is 2 + 2?" emit
    // zero reasoning events). Without reasoning events the app cannot create a panel.
    //
    // Try a simple prompt first (fast, usually sufficient), then fall back to a
    // harder prompt that almost always triggers reasoning. Each attempt is wrapped
    // so a waitForAssistantDone timeout still counts as a failed attempt.
    const setupPrompts = [
      'What is 2 + 2? Think step by step.',
      'Compute 47 multiplied by 89 step by step, showing each partial product and sum explicitly.',
      'Is 91 prime? Explain step by step why or why not.'
    ];
    let panelsBeforeDeletion = 0;
    for (let attempt = 0; attempt < setupPrompts.length; attempt++) {
      if (attempt > 0) {
        // Clear Conversation creates a NEW conversation, which resets per-conversation
        // quick settings — re-apply the reasoning model + effort each retry.
        await page.locator('button[aria-label="Clear Conversation"]').click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        await operateQuickSettings(page, {
          mode: 'ensure-open',
          model: /gpt-5-nano/i,
          reasoningEffort: 'high',
          closeAfter: true
        });
      }
      try {
        await sendMessage(page, setupPrompts[attempt]);
        await waitForAssistantDone(page, { timeout: 60_000 });
        panelsBeforeDeletion = await getReasoningPanelCount(page);
        console.log(`Reasoning panels after setup prompt #${attempt + 1}: ${panelsBeforeDeletion}`);
        if (panelsBeforeDeletion > 0) break;
      } catch (err) {
        console.log(`Setup prompt #${attempt + 1} threw; trying next: ${(err as Error).message}`);
      }
    }
    expect(
      panelsBeforeDeletion,
      'setup: reasoning panel expected — the API emitted no reasoning events across all retry prompts'
    ).toBeGreaterThan(0);

    // 4) Debug: Check store state before deletion
    const storeBeforeDeletion = await page.evaluate(() => {
      const win = window as any;
      const panels = win.__getReasoningPanels ? win.__getReasoningPanels() : null;
      const windows = win.__getReasoningWindows ? win.__getReasoningWindows() : null;
      return {
        panelCount: panels?.length ?? -1,
        windowCount: windows?.length ?? -1,
        windows: windows?.map((w: any) => ({ id: w.id, convId: w.convId, anchorIndex: w.anchorIndex }))
      };
    });
    console.log('Store before deletion:', JSON.stringify(storeBeforeDeletion, null, 2));

    // 5) Get current message count
    const messagesBefore = await getVisibleMessages(page);
    console.log(`Messages before deletion: ${messagesBefore.length}`);
    expect(messagesBefore.length).toBe(2); // User message + assistant response

    // 6) Delete all messages below the USER message (index 0)
    // This deletes the assistant response and its reasoning window
    // Expected result: Only the user message at index 0 remains, no reasoning panels
    console.log('Deleting all messages below index 0 (the user message that triggered reasoning)...');
    await deleteAllBelowForMessage(page, 0);

    // Give UI a moment to update
    await page.waitForTimeout(500);

    // 7) Verify messages were deleted
    const messagesAfter = await getVisibleMessages(page);
    console.log(`Messages after deletion: ${messagesAfter.length}`);
    expect(messagesAfter.length).toBe(1); // Only the user message should remain

    // 8) Check store state after deletion (before checking UI)
    const storeAfterDeletion = await page.evaluate(() => {
      const win = window as any;
      const panels = win.__getReasoningPanels ? win.__getReasoningPanels() : null;
      const windows = win.__getReasoningWindows ? win.__getReasoningWindows() : null;
      return {
        panelCount: panels?.length ?? -1,
        windowCount: windows?.length ?? -1,
        windows: windows?.map((w: any) => ({ id: w.id, convId: w.convId, anchorIndex: w.anchorIndex })),
        panels: panels?.map((p: any) => ({ id: p.id, convId: p.convId, responseId: p.responseId, kind: p.kind }))
      };
    });
    console.log('Store AFTER deletion:', JSON.stringify(storeAfterDeletion, null, 2));

    // 9) Check UI: Reasoning panels should not be visible
    const panelsAfterDeletion = await getReasoningPanelCount(page);
    console.log(`Reasoning panels visible in UI after deletion: ${panelsAfterDeletion}`);

    expect(panelsAfterDeletion).toBe(0);

    // 10) Verify store state
    // Panels should be removed from the store, not just hidden in UI
    const storeState = await page.evaluate(() => {
      const win = window as any;

      // Access the Svelte stores via exposed getter functions
      const panels = win.__getReasoningPanels ? win.__getReasoningPanels() : null;
      const windows = win.__getReasoningWindows ? win.__getReasoningWindows() : null;

      return {
        panelCount: panels?.length ?? -1,
        windowCount: windows?.length ?? -1,
        panels: panels,
        windows: windows
      };
    });

    console.log(`Panels in store after deletion: ${storeState.panelCount}`);
    console.log(`Windows in store after deletion: ${storeState.windowCount}`);
    if (storeState.panelCount > 0) {
      console.log('Remaining panels:', JSON.stringify(storeState.panels, null, 2));
    }
    if (storeState.windowCount > 0) {
      console.log('Remaining windows:', JSON.stringify(storeState.windows, null, 2));
    }

    // BUG: Panels remain in the store even though windows are cleaned up
    expect(storeState.windowCount).toBe(0); // Windows should be cleaned (this should pass)
    expect(storeState.panelCount).toBe(0); // Panels should also be cleaned (this will FAIL)
  });
});
