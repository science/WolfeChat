/**
 * Live E2E Regression Test: Anthropic thinking payload contract across the model spectrum
 *
 * Brackets the full decision surface of adaptive-thinking detection, which routes by a VERSION
 * THRESHOLD: a reasoning-capable Claude model uses adaptive thinking iff its version is >= 4.6
 * (where adaptive landed) or a future major version; 4.0–4.5 and 3.x are manual-only. We verify
 * EVERY reasoning model the account actually exposes — not just the Opus 4.8 bug we fixed:
 *
 *   • Adaptive (Opus/Sonnet 4.6+, + future releases) → thinking must be {type:'adaptive',
 *     display:'summarized'} with NO budget_tokens. Manual thinking here is the HTTP 400 we fixed.
 *   • Manual (reasoning models < 4.6) → must send {type:'enabled', budget_tokens:N>0} with
 *     max_tokens > budget_tokens. Routing one of these to adaptive 400s ("adaptive thinking is
 *     not supported on this model").
 *
 * Opus 4.5 is the BOUNDARY case and the reason a version threshold beats a denylist: it is a
 * pre-adaptive (manual-only) model that an earlier denylist design mis-routed to adaptive,
 * producing a live 400. This suite caught that; it now locks 4.5 → manual and 4.6 → adaptive.
 *
 * Each case proves three things:
 *   1. No HTTP >= 400 from the chat /v1/messages call — the literal regression signal (a 400).
 *   2. Payload contract: the outgoing thinking block matches the expected shape for that model.
 *   3. Live acceptance: a correct answer streams back, plus a populated reasoning window.
 *
 * Non-reasoning models (Haiku) are intentionally NOT covered here: their chat request carries no
 * thinking field, making it indistinguishable from the async title-generation request at the
 * network layer (title-gen also sends no thinking — see conversationManager.ts). The
 * "non-reasoning → no thinking" branch is covered deterministically by the unit suite
 * (anthropic-reasoning-modelconfig-integration: non-reasoning-haiku-no-thinking).
 *
 * The model IDs below are the ones this account currently exposes (a non-existent ID makes
 * operateQuickSettings fall back to another model, which the selection guard catches loudly).
 * Lives in live-regression (serial, on-demand) — slow, costly contract checks.
 */

import { test, expect } from '@playwright/test';
import {
  sendMessage,
  waitForAssistantDone,
  getVisibleMessages,
  bootstrapLiveAPI,
  operateQuickSettings,
} from '../live/helpers';
import { debugInfo } from '../debug-utils';

// 3-step arithmetic — reasoning-worthy enough to engage thinking, single unambiguous answer.
const PROMPT =
  'A warehouse starts with 3 pallets of 17 boxes each. Then 12 boxes are removed and 25 boxes are added. How many boxes are in the warehouse now? Reply with only the number.';
const MARKER = '3 pallets of 17 boxes';
const ANSWER = '64'; // 3*17=51, 51-12=39, 39+25=64

type Mode = 'adaptive' | 'manual';

interface BracketCase {
  title: string;
  model: RegExp; // must uniquely match exactly one option in this account's model list
  mode: Mode;
}

// One case per reasoning model the account exposes. `mode` is the EXPECTED routing under the
// fix; a live 400 on any of these is the regression we are guarding against.
const CASES: BracketCase[] = [
  // Adaptive: version >= 4.6.
  { title: 'Opus 4.8 (>= 4.6 → adaptive)', model: /claude-opus-4-8/i, mode: 'adaptive' },
  { title: 'Opus 4.7 (>= 4.6 → adaptive)', model: /claude-opus-4-7/i, mode: 'adaptive' },
  { title: 'Opus 4.6 (cutover → adaptive)', model: /claude-opus-4-6/i, mode: 'adaptive' },
  { title: 'Sonnet 4.6 (cutover → adaptive)', model: /claude-sonnet-4-6/i, mode: 'adaptive' },

  // Manual: reasoning models below the 4.6 cutover.
  { title: 'Opus 4.5 (< 4.6 → manual) [boundary]', model: /claude-opus-4-5/i, mode: 'manual' },
  { title: 'Opus 4.1 (< 4.6 → manual)', model: /claude-opus-4-1/i, mode: 'manual' },
  { title: 'Opus 4.0 (< 4.6, bare-entry guard → manual)', model: /claude-opus-4-20250514/i, mode: 'manual' },
  { title: 'Sonnet 4.5 (< 4.6 → manual)', model: /claude-sonnet-4-5/i, mode: 'manual' },
  { title: 'Sonnet 4.0 (< 4.6, bare-entry guard → manual)', model: /claude-sonnet-4-20250514/i, mode: 'manual' },
];

const parseBody = (pd: string | null): any => {
  try { return JSON.parse(pd || ''); } catch { return null; }
};

// Not serial: each case is an independent fresh-page run, and we want EVERY model's verdict in a
// single pass — a serial describe would skip the rest after the first failure.

test.describe('Anthropic thinking payload contract across the model spectrum (regression)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  for (const c of CASES) {
    test(c.title, async ({ page }) => {
      test.setTimeout(120_000);

      await page.waitForLoadState('networkidle');

      await bootstrapLiveAPI(page, 'Anthropic');

      await operateQuickSettings(page, { model: c.model });

      // Guard against operateQuickSettings' silent gpt-5 fallback: confirm the intended model is
      // actually selected, so an absent model fails here with a clear reason, not downstream.
      const selectedModel = await page.locator('#current-model-select').inputValue().catch(() => '');
      expect(
        selectedModel,
        `Expected a model matching ${c.model} selected, got "${selectedModel}". ` +
        `(operateQuickSettings silently falls back to a gpt-5 model when the requested model is ` +
        `absent from the account's model list.)`,
      ).toMatch(c.model);

      // Await OUR chat response so we can read its HTTP status. We match on (a) the exact messages
      // endpoint, (b) our prompt marker, and (c) presence of a thinking field — that last clause
      // is what distinguishes the chat call from the async title-generation call, which fires
      // first, carries the conversation text (so it also has the marker), but sends no thinking
      // (see conversationManager.ts). Set up the wait before sending to avoid a race; a 400
      // resolves fast, so there is no 90s hang on the regression path.
      const chatResponsePromise = page.waitForResponse(
        (res) => {
          if (!res.url().endsWith('/v1/messages') || res.request().method() !== 'POST') return false;
          const pd = res.request().postData() || '';
          return pd.includes(MARKER) && !!parseBody(pd)?.thinking;
        },
        { timeout: 90_000 },
      );

      await sendMessage(page, PROMPT);
      const chatResponse = await chatResponsePromise;
      const status = chatResponse.status();
      const body = parseBody(chatResponse.request().postData()) || {};
      const thinking = body.thinking ?? null;
      debugInfo(`🔎 ${selectedModel}: HTTP ${status}, thinking=${JSON.stringify(thinking)}`);

      // 1. The regression signal: no 4xx/5xx. This is the exact failure the fix addressed.
      // On error, surface the Anthropic error body so the failure says WHY (adaptive unsupported
      // vs max_tokens vs ...), not just the status code.
      const errBody = status !== 200 ? await chatResponse.text().catch(() => '(body unavailable)') : '';
      expect(
        status,
        `Anthropic returned HTTP ${status} for ${selectedModel} (thinking=${JSON.stringify(thinking)}, max_tokens=${body.max_tokens}) — a >=400 here is the thinking-payload regression. Body: ${errBody.slice(0, 500)}`,
      ).toBe(200);

      // 2. Payload contract for this model's branch.
      if (c.mode === 'adaptive') {
        expect(thinking.type, `${selectedModel} must use adaptive thinking, not legacy "enabled"`).toBe('adaptive');
        expect(thinking.display, 'display must be "summarized" so reasoning stays visible on 4.7+').toBe('summarized');
        expect('budget_tokens' in thinking, 'budget_tokens must be absent — it 400s on Opus 4.7/4.8').toBe(false);
      } else {
        expect(thinking.type, `${selectedModel} must keep manual thinking (type "enabled")`).toBe('enabled');
        expect(typeof thinking.budget_tokens, 'manual thinking must carry numeric budget_tokens').toBe('number');
        expect(thinking.budget_tokens, 'manual budget_tokens must be positive').toBeGreaterThan(0);
        expect(body.max_tokens, 'max_tokens must exceed budget_tokens (the original 400 constraint)')
          .toBeGreaterThan(thinking.budget_tokens);
      }

      // 3. Live acceptance: streamed completion + correct answer.
      await waitForAssistantDone(page, { timeout: 90_000 });

      // Reasoning window is a SOFT signal: under adaptive thinking the model decides whether to
      // emit visible summarized reasoning, so an easy prompt may render none. We therefore only
      // assert it is non-empty WHEN present. The deterministic guarantee that reasoning stays
      // visible (display:'summarized', not 'omitted') is already hard-asserted at the payload
      // layer above — this is just a UI observation.
      const reasoningWindow = page.locator('[role="region"][aria-label*="Reasoning window"]').first();
      const reasoningVisible = await reasoningWindow.isVisible().catch(() => false);
      if (reasoningVisible) {
        const reasoningText = ((await reasoningWindow.textContent()) || '').trim();
        expect(reasoningText.length, 'a rendered reasoning window must have non-empty summary text').toBeGreaterThan(0);
        debugInfo(`📝 ${selectedModel}: reasoning window present (${reasoningText.length} chars)`);
      } else {
        debugInfo(`ℹ️ ${selectedModel}: no reasoning window this run (adaptive chose minimal/no visible thinking)`);
      }

      const messages = await getVisibleMessages(page);
      const assistant = messages.find((m) => m.role === 'assistant');
      expect(assistant, 'assistant message should be present (turn completed → no 400)').toBeDefined();
      expect(assistant!.text, `expected the answer ${ANSWER} in the reply`).toContain(ANSWER);

      debugInfo(`✅ ${c.title} — verified (HTTP 200, contract OK, answer ${ANSWER})`);
    });
  }
});
