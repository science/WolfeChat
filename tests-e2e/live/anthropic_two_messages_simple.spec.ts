import { test, expect } from '@playwright/test';
import { operateQuickSettings, bootstrapLiveAPI, sendMessage, waitForAssistantDone } from './helpers';
import { debugInfo } from '../debug-utils';

/**
 * SIMPLE TEST: Verify 2 Anthropic reasoning messages work correctly
 * Waits adequately between messages to match real UAT usage
 */

test('Two Anthropic reasoning messages with adequate wait', async ({ page }) => {
  await page.goto('/');
  await bootstrapLiveAPI(page, 'Anthropic');

  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /claude-sonnet-4-5-20250929/i,
    closeAfter: true
  });

  // First message - wait 2 seconds after completion
  debugInfo('Sending message 1...');
  await sendMessage(page, '1+1');
  await waitForAssistantDone(page);
  debugInfo('Message 1 done, waiting 2 seconds...');
  await page.waitForTimeout(2000);

  // Check state after first message
  const after1 = await page.locator('details:has-text("Reasoning")').count();
  debugInfo(`After message 1: ${after1} reasoning windows`);
  expect(after1).toBe(1);

  // Second message - wait 2 seconds after completion
  debugInfo('Sending message 2...');
  await sendMessage(page, '2+2');
  await waitForAssistantDone(page);
  debugInfo('Message 2 done, waiting 2 seconds...');
  await page.waitForTimeout(2000);

  // Check final state
  const after2 = await page.locator('details:has-text("Reasoning")').count();
  debugInfo(`After message 2: ${after2} reasoning windows`);
  expect(after2).toBe(2);
});