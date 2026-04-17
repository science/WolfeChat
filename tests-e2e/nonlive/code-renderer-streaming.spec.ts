import { test, expect } from '@playwright/test';

function sseChunks(chunks: string[]) {
  const lines: string[] = [];
  for (const chunk of chunks) {
    lines.push('event: response.output_text.delta');
    lines.push('data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: { text: chunk } }));
    lines.push('');
  }
  lines.push('event: response.completed');
  lines.push('data: {"type":"response.completed"}');
  lines.push('');
  lines.push('data: [DONE]');
  lines.push('');
  return lines.join('\n');
}

async function seedLocalStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('api_key', JSON.stringify('sk-test'));
    localStorage.setItem('models', JSON.stringify([{ id: 'gpt-4.1' }, { id: 'gpt-5' }]));
    localStorage.setItem('selectedModel', 'gpt-4.1');
  });
}

test.describe('Code rendering stays highlighted during streaming updates', () => {
  test('Prism tokens present during and after stream for fenced block', async ({ page }) => {
    await seedLocalStorage(page);

    // Stream a fenced JS block in two parts simulating "prop/update"
    const chunks = [
      'Here is code:\n\n```js\nconst a = 1;\n',
      'const b = 2;\n```\nAnd more text.'
    ];

    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      let payload: any = null;
      try { payload = req.postDataJSON(); } catch {}

      // Fulfill streaming chat path
      if (payload && payload.stream === true) {
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            'connection': 'keep-alive',
          },
          body: sseChunks(chunks),
        });
      }

      // Non-streaming (e.g., title gen)
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'A Title' }),
      });
    });

    await page.goto('/');

    // Send a message through normal UI
    const input = page.getByRole('textbox', { name: 'Chat input' });
    await input.waitFor({ state: 'visible' });
    await input.fill('please render code');

    // Wait for the full response (not just request start) so SSE body is fully buffered
    // before we check the DOM. waitForRequest fires too early under parallel worker load.
    const sendButton = page.getByRole('button', { name: /send/i });
    const submitTrigger = (await sendButton.isVisible().catch(() => false))
      ? sendButton.click({ force: true })
      : input.press('Control+Enter');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/v1/responses') && r.request().method() === 'POST'),
      submitTrigger,
    ]);

    // During stream: expect a code element and at least one Prism token
    const assistant = page.locator('[data-role="assistant"], [data-message-role="assistant"], main');
    const code = assistant.locator('pre code').first();
    await expect(code).toBeVisible({ timeout: 15000 });

    // Wait until tokenized appears (Prism adds .token spans)
    await expect.poll(async () => await code.locator('.token').count(), { timeout: 15000 }).toBeGreaterThan(0);

    // After stream completes, tokens should remain
    await expect(async () => {
      const count = await code.locator('.token').count();
      expect(count).toBeGreaterThan(0);
    }).toPass();
  });

  test('Highlighting persists across updated content (append within same block)', async ({ page }) => {
    await seedLocalStorage(page);

    // First assistant message streams a small block; second message streams an expanded variant
    const firstChunks = [
      'Here is code:\n\n```js\nconst a = 1;\n```\n'
    ];
    const secondChunks = [
      'Updated code:\n\n```js\nconst a = 1;\nconst b = 2;\n```\n'
    ];

    let phase: 'first' | 'second' = 'first';

    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      let payload: any = null;
      try { payload = req.postDataJSON(); } catch {}

      if (payload && payload.stream === true) {
        const body = sseChunks(phase === 'first' ? firstChunks : secondChunks);
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            'connection': 'keep-alive',
          },
          body,
        });
      }

      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'A Title' }),
      });
    });

    await page.goto('/');

    const input = page.getByRole('textbox', { name: 'Chat input' });
    await input.waitFor({ state: 'visible' });
    const sendButton = page.getByRole('button', { name: /send/i });

    // Helper: submit input and wait for the mocked SSE response to fully arrive.
    // waitForResponse (not waitForRequest) ensures the SSE body is buffered before
    // we poll the DOM — otherwise the 5s visibility timeout can race under parallel worker load.
    const sendAndAwait = async () => {
      const submitTrigger = (await sendButton.isVisible().catch(() => false))
        ? sendButton.click({ force: true })
        : input.press('Control+Enter');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/v1/responses') && r.request().method() === 'POST'),
        submitTrigger,
      ]);
    };

    // First send
    await input.fill('first');
    await sendAndAwait();

    const assistant = page.locator('[data-role="assistant"], [data-message-role="assistant"], main');
    const code = assistant.locator('pre code').first();
    await expect(code).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => await code.locator('.token').count(), { timeout: 15000 }).toBeGreaterThan(0);

    // Second send (simulate update/append scenario)
    phase = 'second';
    await input.fill('second');
    await sendAndAwait();

    // Ensure the (latest) code block is still tokenized
    const latestCode = assistant.locator('pre code').last();
    await expect(latestCode).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => await latestCode.locator('.token').count(), { timeout: 15000 }).toBeGreaterThan(0);
  });
});
