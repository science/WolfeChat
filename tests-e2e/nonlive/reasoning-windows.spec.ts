// Reasoning window UI behavior — deterministic playback from recorded fixtures.
//
// This spec runs in two modes:
//   - Replay (default): serves pre-recorded SSE bodies from tests-e2e/fixtures/.
//     No network, <1s per test, 100% deterministic.
//   - Record (RECORD=1, --project=live): hits the real API and saves new fixtures.
//     Use when the app's SSE parsing OR the upstream event shape changes.
//
// Record ALL fixtures in this file:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-windows.spec.ts --project=live
//
// (Yes, we run in the `live` project to get API keys. The spec lives in
//  nonlive/ because that's where it runs on every suite-verify run.)
import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, waitForAssistantDone } from '../live/helpers';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixtureRecordOrReplay,
  fixturesRecordOrReplaySeq,
} from './mock-helpers';

async function sendPrompt(page: import('@playwright/test').Page, text: string) {
  const textarea = page.getByRole('textbox', { name: /chat input/i });
  await expect(textarea).toBeVisible();
  await textarea.fill(text);
  const sendBtn = page.getByRole('button', { name: /send/i });
  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click({ force: true });
  } else {
    await textarea.press('Enter');
  }
}

function reasoningRegion(page: import('@playwright/test').Page) {
  const byRole = page.getByRole('region', { name: /reasoning/i });
  const byAria = page.locator('details[role="region"][aria-label="Reasoning"]');
  const bySummaryParent = page.locator('summary', { hasText: 'Reasoning' }).locator('..');
  const byText = page.locator('details:has-text("Reasoning")');
  let combined = byRole.or(byAria);
  combined = combined.or(bySummaryParent);
  combined = combined.or(byText);
  return combined;
}

function panelsIn(details: import('@playwright/test').Locator) {
  const semanticPanels = details.locator('[role="article"][aria-label="Reasoning panel"]');
  const classPanels = details.locator('div.rounded.border.border-gray-500');
  return semanticPanels.or(classPanels);
}

function panelPre(panel: import('@playwright/test').Locator) {
  return panel.locator('pre');
}

function panelStatus(panel: import('@playwright/test').Locator) {
  return panel.locator('.text-xs');
}

const RECORDING = !!process.env.RECORD;

// Common setup for both modes: quick settings select a reasoning-capable
// OpenAI model with effort=high. In replay mode the selection just drives the
// UI; the actual API is intercepted.
async function setupReasoningModel(page: import('@playwright/test').Page) {
  if (RECORDING) {
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, {
      provider: 'OpenAI',
      selectedModel: 'gpt-5.4-nano',
    });
    await mockModelsEndpoint(page);
    // Fallback mock for any /v1/responses the fixture doesn't cover
    // (e.g. title-gen). The fixture-backed route is added AFTER and has
    // higher Playwright priority for matching requests.
    await mockResponsesEndpoint(page, { titleText: 'Recorded Reasoning Test' });
    await page.goto('/');
  }

  // In both modes we want the reasoning model + high effort applied in the UI.
  // Local import to avoid pulling live-only code into nonlive context.
  const { operateQuickSettings } = await import('../live/helpers');
  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /gpt-5\.4-nano/i,
    reasoningEffort: 'high',
    closeAfter: true,
  });
}

test('reasoning window renders and panel reaches done', async ({ page }) => {
  test.setTimeout(120_000);

  // setupReasoningModel registers a catch-all /v1/responses mock; the
  // fixture route must be registered AFTER it so Playwright's newest-
  // first handler lookup tries the fixture first for streaming requests.
  await setupReasoningModel(page);
  await fixtureRecordOrReplay(page, {
    name: 'reasoning-windows-renders',
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'Monty Hall switching 2/3 probability',
  });

  await sendPrompt(page, 'Work out step by step why the Monty Hall switching strategy gives 2/3 probability.');

  const details = reasoningRegion(page);
  await expect(details).toBeVisible({ timeout: 30_000 });

  // Use existence + attribute assertions rather than visibility —
  // auto-collapse races both live and replay mode. The test's real intent
  // is "panel exists, status reaches done, text is non-empty".
  const panels = panelsIn(details);
  await expect(panels).not.toHaveCount(0, { timeout: 30_000 });

  const firstPanel = panels.first();
  const status = panelStatus(firstPanel);
  await expect(status).toContainText(/done/i, { timeout: 30_000 });

  const pre = panelPre(firstPanel);
  await expect(pre).toHaveText(/\S+/, { timeout: 30_000 });

  // In record mode, let the stream fully flush to disk.
  if (RECORDING) {
    await waitForAssistantDone(page, { timeout: 90_000 });
    await page.waitForTimeout(1_500);
  }
});

test('reasoning window auto-minimizes after assistant starts replying', async ({ page }) => {
  test.setTimeout(120_000);

  await setupReasoningModel(page);
  await fixtureRecordOrReplay(page, {
    name: 'reasoning-windows-auto-minimize',
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'Three creative uses for a paperclip',
  });

  await sendPrompt(page, 'List three creative uses for a paperclip and think step-by-step.');

  const details = reasoningRegion(page);
  await expect(details).toBeVisible({ timeout: 30_000 });

  // After the assistant begins replying, the Reasoning details should collapse
  // on its own (auto-collapse behavior). In replay mode this happens quickly.
  const summary = details.locator('summary');
  const collapsed = async () => {
    const hasOpen = await details.getAttribute('open');
    const ariaExpanded = await summary.getAttribute('aria-expanded');
    return (!hasOpen || hasOpen === null) || ariaExpanded === 'false';
  };

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await collapsed()) break;
    await page.waitForTimeout(100);
  }
  expect(await collapsed()).toBeTruthy();

  if (RECORDING) {
    await waitForAssistantDone(page, { timeout: 90_000 });
    await page.waitForTimeout(1_500);
  }
});

test('reasoning window streams content and reaches done on a longer prompt', async ({ page }) => {
  test.setTimeout(150_000);

  await setupReasoningModel(page);
  await fixtureRecordOrReplay(page, {
    name: 'reasoning-windows-longer-prompt',
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'Kyoto 3-day itinerary planning',
  });

  await sendPrompt(page, 'Plan a simple 3-day itinerary for visiting Kyoto with constraints: low budget, avoid crowds, include cultural experiences. Think step-by-step.');

  const details = reasoningRegion(page);
  await expect(details).toBeVisible({ timeout: 40_000 });

  // Existence + text assertions (insensitive to auto-collapse visibility).
  const panels = panelsIn(details);
  await expect(panels).not.toHaveCount(0, { timeout: 40_000 });

  const firstPanel = panels.first();
  const pre = panelPre(firstPanel);
  await expect(pre).toHaveText(/\S+/, { timeout: 60_000 });

  const status = panelStatus(firstPanel);
  await expect(status).toContainText(/done/i, { timeout: 75_000 });

  if (RECORDING) {
    await waitForAssistantDone(page, { timeout: 90_000 });
    await page.waitForTimeout(1_500);
  }
});

test('reasoning window reopens and minimizes correctly for consecutive messages', async ({ page }) => {
  test.setTimeout(180_000);

  await setupReasoningModel(page);
  await fixturesRecordOrReplaySeq(page, {
    names: ['reasoning-windows-consecutive-1', 'reasoning-windows-consecutive-2'],
    urlSubstring: 'api.openai.com/v1/responses',
    matchBody: '"stream":true',
    promptPreview: 'Fibonacci memoization walkthrough',
  });

  const assertReasoningDone = async () => {
    await waitForAssistantDone(page);
    const allDetails = reasoningRegion(page);
    const count = await allDetails.count();
    expect(count).toBeGreaterThan(0);
    const lastDetails = allDetails.last();
    await expect(lastDetails).toBeVisible({ timeout: 30_000 });

    const panels = panelsIn(lastDetails);
    await expect(panels).not.toHaveCount(0, { timeout: 30_000 });
    const status = panelStatus(panels.first());
    await expect(status).toContainText(/done/i, { timeout: 75_000 });
  };

  await sendPrompt(page, 'Explain dynamic programming by working through the memoized Fibonacci example step by step.');
  await assertReasoningDone();

  await sendPrompt(page, 'Now walk through how to implement memoized Fibonacci in Python step by step, explaining each design choice.');
  await assertReasoningDone();

  if (RECORDING) {
    // The 2nd SSE body is ~350KB; response.text() in the recorder takes a
    // few seconds to fully resolve after status=done is observed in the UI.
    await page.waitForTimeout(8_000);
  }
});
