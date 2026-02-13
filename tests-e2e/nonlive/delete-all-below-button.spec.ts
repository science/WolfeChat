/**
 * Delete All Below Button Presence Test (nonlive)
 *
 * Verifies that the "Delete all messages below" button is present on all
 * non-last messages, including summary messages. Uses localStorage injection
 * so no API key is needed.
 *
 * This test exists because the live E2E test (tests-e2e/live/delete-all-below.spec.ts)
 * only covers regular messages and requires an API key. The SummaryMessage component
 * was originally shipped without this button, and the live test didn't catch it.
 */

import { test, expect } from '@playwright/test';

/** Inject a conversation with the given history into localStorage and reload. */
async function injectConversation(
  page: import('@playwright/test').Page,
  history: Array<{ role: string; content: string; model?: string; type?: string; summaryActive?: boolean }>
) {
  await page.evaluate((hist) => {
    const conversations = [{
      id: 'test-conv-delete-below',
      title: 'Delete Below Test',
      history: hist,
    }];
    localStorage.setItem('conversations', JSON.stringify(conversations));
    localStorage.setItem('chosenConversationId', '0');
  }, history);
  await page.reload();
  await page.waitForTimeout(1500);
}

test.describe('Delete All Below button presence', () => {

  test('regular messages: button present on all but last message', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await injectConversation(page, [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!', model: 'gpt-4' },
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: 'The answer is 4.', model: 'gpt-4' },
    ]);

    const listitems = page.locator('[role="listitem"]');
    const count = await listitems.count();
    expect(count).toBe(4); // 4 non-system messages

    // All but last should have the button
    for (let i = 0; i < count - 1; i++) {
      const btn = listitems.nth(i).locator('button[aria-label="Delete all messages below"]');
      await expect(btn, `Message ${i} should have delete-all-below button`).toBeVisible();
    }

    // Last message should NOT have it
    const lastBtn = listitems.nth(count - 1).locator('button[aria-label="Delete all messages below"]');
    await expect(lastBtn).toHaveCount(0);
  });

  test('summary messages: button present on summary when not last', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await injectConversation(page, [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!', model: 'gpt-4' },
      { role: 'system', content: 'Summary of earlier conversation.', type: 'summary', summaryActive: true },
      { role: 'user', content: 'Follow-up question' },
      { role: 'assistant', content: 'Follow-up answer.', model: 'gpt-4' },
    ]);

    const listitems = page.locator('[role="listitem"]');
    const count = await listitems.count();
    expect(count).toBe(5); // user, assistant, summary, user, assistant

    // Summary message (index 2) should have the button
    const summaryItem = listitems.nth(2);
    await expect(summaryItem).toHaveAttribute('aria-label', 'Conversation summary');
    const summaryBtn = summaryItem.locator('button[aria-label="Delete all messages below"]');
    await expect(summaryBtn, 'Summary message should have delete-all-below button').toBeVisible();

    // Last message should NOT have it
    const lastBtn = listitems.nth(count - 1).locator('button[aria-label="Delete all messages below"]');
    await expect(lastBtn).toHaveCount(0);
  });

  test('single message: no delete-all-below button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await injectConversation(page, [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Only message' },
    ]);

    const listitems = page.locator('[role="listitem"]');
    await expect(listitems).toHaveCount(1);

    // Single message = last message, should not have the button
    const btn = listitems.first().locator('button[aria-label="Delete all messages below"]');
    await expect(btn).toHaveCount(0);
  });
});
