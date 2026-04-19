// Quick Settings per-conversation bug — migrated from live with recorded fixtures.
//
// The test captures the outgoing request payload and asserts it reflects the
// per-conversation reasoning effort / verbosity / summary. Replay fulfills
// the response via fixture but the request-payload capture still runs,
// because our capture route is registered AFTER the fixture route (newest
// route = highest priority in Playwright) and delegates via route.fallback().
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/quick-settings-conversation-state-bug.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixturesRecordOrReplaySeq,
  waitForStreamIdle,
} from './mock-helpers';

const RECORDING = !!process.env.RECORD;

async function baseSetup(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { streamText: 'Mock reply', titleText: 'Mock Title' });
    await page.goto('/');
  }
}

test.describe('Quick Settings per-conversation settings honored on submit', () => {
  test.setTimeout(180_000);

  test('settings persist and are honored when submitting', async ({ page }) => {
    await baseSetup(page);
    const { operateQuickSettings, sendMessage } = await import('../live/helpers');

    // Register fixtures BEFORE the payload-capture route so capture sits on
    // top of the LIFO stack and runs first — it records, then falls back
    // to the fixture route which fulfills.
    await fixturesRecordOrReplaySeq(page, {
      names: ['qs-conv-state-1', 'qs-conv-state-2', 'qs-conv-state-3'],
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'per-conv settings: 3 reasoning sends',
    });

    // Start QS with a reasoning-capable model as default.
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5\.4-nano|gpt-5/i,
      reasoningEffort: 'low',
      verbosity: 'low',
      summary: 'auto',
      closeAfter: true,
    });

    // Create 3 conversations (the default + 2 new).
    const sidebar = page.locator('nav').first();
    const newConvBtn = sidebar.getByRole('button', { name: /^new conversation$/i });
    const rows = page.locator('.conversation.title-container');

    {
      const before = await rows.count();
      await newConvBtn.click({ force: true });
      await expect(rows).toHaveCount(before + 1);
    }
    {
      const before = await rows.count();
      await newConvBtn.click({ force: true });
      await expect(rows).toHaveCount(before + 1);
    }

    // rows order: 0→conv3 (newest), 1→conv2, 2→conv1

    // Configure per-conv settings.
    await rows.nth(0).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.4-nano/i, reasoningEffort: 'low', verbosity: 'low', summary: 'detailed' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5\.4-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    await rows.nth(1).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.4-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'auto' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5\.4-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    await rows.nth(2).click({ force: true });
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.4-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'null' });
    await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5\.4-nano/i);
    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // Verify UI persists across conversation switches.
    const verifyUiFor = async (idx: number, expected: { effort: string; verbosity: string; summary: string }) => {
      await rows.nth(idx).click({ force: true });
      await operateQuickSettings(page, { mode: 'ensure-open' });
      await expect(page.locator('#current-model-select')).toHaveValue(/gpt-5\.4-nano/i);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expected.effort);
      await expect(page.locator('#verbosity')).toHaveValue(expected.verbosity);
      await expect(page.locator('#summary')).toHaveValue(expected.summary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });
    };
    await verifyUiFor(0, { effort: 'low', verbosity: 'low', summary: 'detailed' });
    await verifyUiFor(1, { effort: 'medium', verbosity: 'medium', summary: 'auto' });
    await verifyUiFor(2, { effort: 'medium', verbosity: 'medium', summary: 'null' });

    // Now register the payload-capture route. Because it's registered AFTER
    // the fixture route (and newer = higher priority), it runs first, captures
    // the POST body, then calls route.fallback() which delegates to the
    // fixture route → route.fulfill() sends the canned SSE to the browser.
    const captured: Array<{ url: string; body: any }> = [];
    await page.route('**/api.openai.com/**', async (route, req) => {
      if (req.method() === 'POST') {
        try { captured.push({ url: req.url(), body: req.postDataJSON() }); } catch {}
      }
      await route.fallback();
    });

    const sendAndAssert = async (
      idx: number,
      label: string,
      expectModelRe: RegExp,
      expectEffort: string,
      expectVerbosity: string,
      expectSummary: string,
      expectedAssistantCount: number,
    ) => {
      captured.length = 0;
      await rows.nth(idx).click({ force: true });
      await page.waitForTimeout(300);
      await expect(rows.nth(idx)).toHaveClass(/bg-hover2/, { timeout: 3000 });

      // Assert QS UI shows expected values before send.
      await operateQuickSettings(page, { mode: 'ensure-open' });
      await expect(page.locator('#current-model-select')).toHaveValue(expectModelRe);
      await expect(page.locator('#reasoning-effort')).toHaveValue(expectEffort);
      await expect(page.locator('#verbosity')).toHaveValue(expectVerbosity);
      await expect(page.locator('#summary')).toHaveValue(expectSummary);
      await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

      const msg = `Explain the Monte Hall 3 door problem using logic (for ${label})`;
      await sendMessage(page, msg, { submitMethod: 'ctrl-enter', clearFirst: true, waitForEmpty: true });
      await waitForStreamIdle(page, expectedAssistantCount, 45_000);

      expect(captured.length).toBeGreaterThan(0);
      const pick = [...captured].reverse().find(r => {
        const b = r.body || {};
        const hasStream = b.stream === true;
        const hasTextVerbosity = !!b.text && typeof b.text === 'object' && 'verbosity' in b.text;
        const hasReasoning = !!b.reasoning && typeof b.reasoning === 'object' && ('effort' in b.reasoning || 'summary' in b.reasoning);
        const inArr = b.input;
        let matchesLabel = false;
        if (Array.isArray(inArr)) {
          try {
            const userMsg = inArr.find((m: any) => m && m.role === 'user');
            const content = userMsg?.content;
            const text = Array.isArray(content) ? content.find((c: any) => c && c.type === 'input_text')?.text : undefined;
            matchesLabel = typeof text === 'string' && text.includes('Monte Hall 3 door problem');
          } catch {}
        }
        return hasStream && (hasTextVerbosity || hasReasoning || matchesLabel);
      });
      expect(pick, 'expected to capture a chat send request').toBeTruthy();
      const body = pick!.body || {};
      const modelStr: string = body.model || '';
      expect(modelStr).toMatch(expectModelRe);

      const reasonObj = body.reasoning;
      const textObj = body.text;
      const effort = reasonObj?.effort ?? body.metadata?.reasoning_effort ?? body.reasoning_effort;
      const verbosity = textObj?.verbosity ?? body.metadata?.verbosity ?? body.verbosity;
      const rawSummary =
        reasonObj && Object.prototype.hasOwnProperty.call(reasonObj, 'summary') ? reasonObj.summary
        : body.metadata && Object.prototype.hasOwnProperty.call(body.metadata, 'summary') ? body.metadata.summary
        : Object.prototype.hasOwnProperty.call(body, 'summary') ? body.summary
        : undefined;
      const expectedSummary = expectSummary === 'null' ? null : expectSummary;

      expect(effort).toBe(expectEffort);
      expect(verbosity).toBe(expectVerbosity);
      expect(rawSummary).toBe(expectedSummary);
    };

    await sendAndAssert(0, 'conv3', /gpt-5/i, 'low', 'low', 'detailed', 1);
    await sendAndAssert(1, 'conv2', /gpt-5\.4-nano/i, 'medium', 'medium', 'auto', 1);
    await sendAndAssert(2, 'conv1', /gpt-5\.4-nano/i, 'medium', 'medium', 'null', 1);

    if (RECORDING) await page.waitForTimeout(5_000);
  });
});
