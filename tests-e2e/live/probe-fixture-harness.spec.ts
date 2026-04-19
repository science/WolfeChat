// PHASE 0 SMOKE — delete after validated.
//
// Proves the plain-text fixture harness in nonlive/mock-helpers.ts can
// record an OpenAI reasoning SSE stream and replay it such that the
// app renders a reasoning panel exactly as it would with the live API.
//
// Record:  RECORD=1 npx playwright test tests-e2e/live/probe-fixture-harness.spec.ts --project=live
// Replay:  npx playwright test tests-e2e/live/probe-fixture-harness.spec.ts --project=live
//
// (Both run in the `live` project for path-matching reasons; the replay
//  run *doesn't* use the network because the fixture intercepts first.)
import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForAssistantDone } from './helpers';
import { fixtureRecordOrReplay } from '../nonlive/mock-helpers';

test('fixture harness: record+replay OpenAI reasoning SSE', async ({ page }) => {
  test.setTimeout(120_000);

  // Fixture captures only the streaming reasoning request (not title-gen).
  // The conversation system prompt is a stable substring we can filter on.
  const mode = await fixtureRecordOrReplay(page, {
    name: 'probe-reasoning-openai',
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'Monty Hall reasoning stream',
  });

  await page.goto('/');
  await bootstrapLiveAPI(page, 'OpenAI');
  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /gpt-5\.4-nano/i,
    reasoningEffort: 'high',
    closeAfter: true,
  });
  await sendMessage(page, 'Work out step by step why the Monty Hall switching strategy gives 2/3 probability.');

  const reasoningWindow = page.locator('details:has-text("Reasoning")').first();
  await expect(reasoningWindow).toBeVisible({ timeout: 30_000 });

  // In record mode, wait for the full stream to land so response.text() in
  // the recorder resolves before the page tears down. In replay mode this is
  // near-instant (local fulfill).
  await waitForAssistantDone(page, { timeout: 90_000 });
  if (mode === 'record') {
    // Extra settle so page.on('response') body write completes.
    await page.waitForTimeout(1_500);
  }

  // eslint-disable-next-line no-console
  console.log(`[probe] mode=${mode} — reasoning panel rendered`);
});
