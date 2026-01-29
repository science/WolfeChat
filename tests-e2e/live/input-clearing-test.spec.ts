import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForAssistantDone } from './helpers';

/**
 * Tests that sequential message sends work correctly.
 * Root cause of previous failures: shouldSendOnEnter() blocks ctrl-enter
 * while isStreaming is true. sendMessage must wait for streaming to end.
 */
test('sequential sends clear input after each message', async ({ page }) => {
  await page.goto('/');
  await bootstrapLiveAPI(page, 'OpenAI');

  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: 'gpt-5-nano',
    reasoning: 'low',
    closeAfter: true
  });

  // Send 1
  await sendMessage(page, 'Explain Monty Hall in one sentence');
  await waitForAssistantDone(page, { expectedAssistantCount: 1 });

  // Send 2 — this previously failed because ctrl-enter was blocked by isStreaming
  await sendMessage(page, 'Summarize in three words');
  await waitForAssistantDone(page, { expectedAssistantCount: 2 });

  const assistantCount2 = await page.evaluate(() =>
    document.querySelectorAll('[data-message-role="assistant"]').length
  );
  expect(assistantCount2).toBeGreaterThanOrEqual(2);

  // Send 3
  await sendMessage(page, 'Thank you');
  await waitForAssistantDone(page, { expectedAssistantCount: 3 });

  const assistantCount3 = await page.evaluate(() =>
    document.querySelectorAll('[data-message-role="assistant"]').length
  );
  expect(assistantCount3).toBeGreaterThanOrEqual(3);
});
