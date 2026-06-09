/**
 * Nonlive: an UNKNOWN Anthropic model is driven through the UI with the provider FRONTIER config.
 *
 * Replaces the token-expensive live `fable5-ui-engagement` spec. We don't need a real API call —
 * what we actually care about is the CODE PATH: selecting a model WolfeChat doesn't recognize must
 *   (a) route to Anthropic,
 *   (b) build the outgoing /v1/messages request with the provider frontier config — full 128k
 *       output ceiling + adaptive thinking (NOT the old 4096 floor / manual budget that would 400),
 *   (c) stream + render the answer.
 * Intercepting the request lets us assert (a)+(b) directly — something the live test could never
 * observe — for zero tokens. Uses an id that is NOT in MODEL_CONFIGS, NOT version-parseable, and
 * carries NO store metadata, so it deterministically exercises the frontier-fallback branch.
 */
import { test, expect } from '@playwright/test';
import { seedAppState, waitForStreamIdle } from './mock-helpers';
import { operateQuickSettings } from '../live/helpers';

const UNKNOWN_MODEL = 'claude-aria-7';

// Minimal, valid Anthropic Messages SSE the SDK can parse into one text block.
function anthropicTextSSE(text: string): string {
  const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return (
    ev('message_start', { type: 'message_start', message: { id: 'msg_mock', type: 'message', role: 'assistant', model: UNKNOWN_MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 } } }) +
    ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) +
    ev('content_block_stop', { type: 'content_block_stop', index: 0 }) +
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }) +
    ev('message_stop', { type: 'message_stop' })
  );
}

test.describe('Unknown Anthropic model uses provider frontier config (nonlive)', () => {
  test('routes to Anthropic, applies frontier max_tokens + adaptive thinking, and renders', async ({ page }) => {
    test.setTimeout(60_000);

    // Seed an Anthropic key + the unknown model. No token metadata on the model → getModelConfig
    // cannot use the data-driven branch, so it must fall through to the frontier default.
    await seedAppState(page, { provider: 'Anthropic', selectedModel: UNKNOWN_MODEL });
    await page.addInitScript((id) => {
      const models = JSON.parse(localStorage.getItem('models') || '[]');
      if (!models.some((m: any) => m.id === id)) {
        models.push({ id, object: 'model', created: 1698894618, owned_by: 'anthropic', provider: 'anthropic' });
        localStorage.setItem('models', JSON.stringify(models));
      }
    }, UNKNOWN_MODEL);

    // Intercept Anthropic's Messages endpoint. Capture only the streaming chat request for
    // assertions; answer preflight + any non-stream (title-gen) request so the flow completes
    // without touching the network.
    let chatRequest: any = null;
    await page.route(
      (url) => url.href.includes('api.anthropic.com/v1/messages'),
      async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') {
          return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': '*' } });
        }
        if (req.method() !== 'POST') return route.fallback();
        let body: any = null;
        try { body = req.postDataJSON(); } catch { /* ignore */ }
        if (body?.stream === true) {
          chatRequest = body;
          return route.fulfill({
            status: 200,
            headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', 'connection': 'keep-alive' },
            body: anthropicTextSSE('FRONTIER_OK'),
          });
        }
        // Non-streaming (e.g. title generation) — return a minimal valid Message.
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'msg_t', type: 'message', role: 'assistant', model: UNKNOWN_MODEL, content: [{ type: 'text', text: 'Title' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }),
        });
      }
    );

    await page.goto('/');
    await operateQuickSettings(page, { mode: 'ensure-open', model: new RegExp(UNKNOWN_MODEL, 'i'), closeAfter: true });

    // Send through the real UI path.
    const textarea = page.getByRole('textbox', { name: /chat input/i });
    await expect(textarea).toBeVisible();
    await textarea.click({ force: true });
    await textarea.fill('hi');
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');

    await waitForStreamIdle(page, 1);

    // (a) routed to Anthropic, (b) frontier config applied on the wire.
    expect(chatRequest, 'a streaming Anthropic /v1/messages request should have been made').not.toBeNull();
    expect(chatRequest.model).toBe(UNKNOWN_MODEL);
    expect(chatRequest.max_tokens).toBe(128000);            // provider frontier output ceiling (not the old 4096 floor)
    expect(chatRequest.thinking?.type).toBe('adaptive');    // adaptive thinking (a manual budget would 400 on adaptive-only models)

    // (c) the streamed answer rendered in the UI.
    const assistant = page.locator('[role="listitem"][data-message-role="assistant"]').last();
    await expect(assistant).toContainText('FRONTIER_OK');
  });
});
