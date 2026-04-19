// PHASE 0 SMOKE — delete after validated.
//
// Proves the fixture harness works for Anthropic too. Critical because the
// Anthropic SDK parses the SSE body internally; page.route must be able to
// intercept the SDK's fetch() call at the HTTP layer.
import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForAssistantDone } from './helpers';
import { fixtureRecordOrReplay } from '../nonlive/mock-helpers';

test('fixture harness: record+replay Anthropic reasoning stream', async ({ page }) => {
  test.setTimeout(120_000);

  const mode = await fixtureRecordOrReplay(page, {
    name: 'probe-reasoning-anthropic',
    urlSubstring: 'api.anthropic.com/v1/messages',
    // Filter out title-gen requests if they exist.
    matchBody: '"stream":true',
    promptPreview: 'Monty Hall Anthropic reasoning',
  });

  await page.goto('/');
  await bootstrapLiveAPI(page, 'Anthropic');
  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /claude-sonnet-4-5-20250929/i,
    closeAfter: true,
  });
  await sendMessage(page, 'Work out step by step why the Monty Hall switching strategy gives 2/3 probability.');

  const reasoningWindow = page.locator('details:has-text("Reasoning")').first();
  await expect(reasoningWindow).toBeVisible({ timeout: 30_000 });

  await waitForAssistantDone(page, { timeout: 90_000 });
  if (mode === 'record') {
    await page.waitForTimeout(1_500);
  }

  // eslint-disable-next-line no-console
  console.log(`[probe-anthropic] mode=${mode} — reasoning panel rendered`);
});
