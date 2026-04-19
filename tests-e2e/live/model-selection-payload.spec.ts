import { test, expect } from '@playwright/test';
import { operateQuickSettings, bootstrapLiveAPI } from './helpers';

// This spec mocks /v1/responses and asserts payload.model reflects the dropdown
// selection — it doesn't hit the live API. It intentionally picks TWO different
// OpenAI model IDs (not TEST_MODEL + varied effort) because the assertion is
// about the model string in the outgoing request body. gpt-4.1-nano is retained
// here as the second distinct id for the same reason as in
// quick-settings-recent-models.spec.ts.

// Utility to build a minimal SSE stream body the app can parse
function sseBody(text: string) {
  return [
    'event: response.output_text.delta',
    'data: {"type":"response.output_text.delta","delta":{"text":' + JSON.stringify(text) + '}}',
    '',
    'event: response.completed',
    'data: {"type":"response.completed"}',
    '',
    'data: [DONE]',
    '',
  ].join('\n');
}

test.describe('Model selection drives request payload.model', () => {
  test('gpt-4.1-nano then gpt-5.4-nano reflected in payload.model', async ({ page }) => {
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Phase tracking for assertions per send
    let phase: 'first' | 'second' = 'first';

    // Intercept Responses API and assert payload.model; fulfill with SSE for stream: true
    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      const method = req.method();
      if (method !== 'POST') return route.continue();

      let payload: any = null;
      try {
        payload = req.postDataJSON();
      } catch {}

      // For the main chat send we expect stream: true. Title generation uses stream: false.
      if (payload && payload.stream === true) {
        if (phase === 'first') {
          expect(payload.model).toMatch(/gpt-4\.1-nano/);
        } else {
          expect(payload.model).toMatch(/gpt-5\.4-nano/);
        }
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            'connection': 'keep-alive',
          },
          body: sseBody('ok'),
        });
      }

      // Non-streaming paths (e.g., title generation)
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'A Title' }),
      });
    });

    // Select gpt-4.1-nano for the first phase
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-4.1-nano',
      closeAfter: true
    });

    // Send first message
    const input = page.getByRole('textbox', { name: 'Chat input' });
    await input.waitFor({ state: 'visible' });
    await input.click({ force: true });
    await input.fill('Hello');

    // Try to click a send button if present; otherwise submit via Enter/Ctrl-Enter
    const sendButton = page.getByRole('button', { name: /send/i });
    if (await sendButton.isVisible().catch(() => false)) {
      await Promise.all([
        // Wait for at least one request to /responses with POST
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        sendButton.click({ force: true }),
      ]);
    } else {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        input.press('Control+Enter'),
      ]);
    }

    // Wait for response
    await page.waitForTimeout(500);

    // Phase 2: Switch model to gpt-5.4-nano
    phase = 'second';
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: 'gpt-5.4-nano',
      closeAfter: true
    });

    // Send again and assert second phase
    await input.waitFor({ state: 'visible' });
    await input.click({ force: true });
    await input.fill('Again');

    if (await sendButton.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        sendButton.click({ force: true }),
      ]);
    } else {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        input.press('Control+Enter'),
      ]);
    }
  });
});
