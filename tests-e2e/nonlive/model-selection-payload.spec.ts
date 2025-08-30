import { test, expect } from '@playwright/test';

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

// Seed localStorage before app scripts run
async function seedLocalStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('api_key', JSON.stringify('sk-test'));
    localStorage.setItem('models', JSON.stringify([
      { id: 'gpt-4.1' },
      { id: 'gpt-5' }
    ]));
    localStorage.setItem('selectedModel', 'gpt-4.1');
  });
}

test.describe('Model selection drives request payload.model', () => {
  test('gpt-4.1 then gpt-5 reflected in payload.model', async ({ page }) => {
    await seedLocalStorage(page);

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
          expect(payload.model).toBe('gpt-4.1');
        } else {
          expect(payload.model).toBe('gpt-5');
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

    await page.goto('/');

    // Find the input and send a message
    const input = page.getByRole('textbox', { name: 'Chat input' });
    await input.waitFor({ state: 'visible' });
    await input.click();
    await input.fill('Hello');

    // Try to click a send button if present; otherwise submit via Enter/Ctrl-Enter
    const sendButton = page.getByRole('button', { name: /send/i });
    if (await sendButton.isVisible().catch(() => false)) {
      await Promise.all([
        // Wait for at least one request to /responses with POST
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        sendButton.click(),
      ]);
    } else {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        input.press('Control+Enter'),
      ]);
    }

    // Phase 2: Switch model to gpt-5
    phase = 'second';

    // Change the selected model via UI if possible; otherwise set localStorage then reload
    // First try a combobox/labeled select
    const maybeModelCombo = page.getByRole('combobox', { name: /model/i });
    if (await maybeModelCombo.isVisible().catch(() => false)) {
      await maybeModelCombo.selectOption({ label: 'gpt-5' }).catch(async () => {
        // Some custom selects require clicking and choosing option
        await maybeModelCombo.click();
        await page.getByRole('option', { name: /^gpt-5$/ }).click();
      });
    } else {
      // Try quick-settings toggle then a select inside
      const qsToggle = page.locator('[data-testid="quick-settings-toggle"]');
      if (await qsToggle.isVisible().catch(() => false)) {
        await qsToggle.click();
        const modelSelect = page.locator('[data-testid="model-select"]');
        if (await modelSelect.isVisible().catch(() => false)) {
          await modelSelect.selectOption({ label: 'gpt-5' }).catch(async () => {
            await modelSelect.click();
            await page.getByRole('option', { name: /^gpt-5$/ }).click();
          });
        } else {
          // Fallback to localStorage and reload
          await page.evaluate(() => localStorage.setItem('selectedModel', 'gpt-5'));
          await page.reload();
        }
      } else {
        // Final fallback: localStorage + reload
        await page.evaluate(() => localStorage.setItem('selectedModel', 'gpt-5'));
        await page.reload();
      }
    }

    // Send again and assert second phase
    await input.waitFor({ state: 'visible' });
    await input.click();
    await input.fill('Again');

    if (await sendButton.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        sendButton.click(),
      ]);
    } else {
      await Promise.all([
        page.waitForRequest((r) => r.url().includes('/v1/responses') && r.method() === 'POST'),
        input.press('Control+Enter'),
      ]);
    }
  });
});
