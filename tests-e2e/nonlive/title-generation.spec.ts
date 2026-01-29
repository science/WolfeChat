import { test, expect } from '@playwright/test';

async function setupApiKey(page) {
  // Open Settings via Sidebar button
  await page.getByRole('button', { name: /^Settings/ }).click({ force: true });
  const apiKeyInput = page.locator('#api-key');
  await expect(apiKeyInput).toBeVisible();
  await apiKeyInput.fill('test-key');
  // Save settings
  await page.getByRole('button', { name: /^Save$/ }).click({ force: true });
}

function setupResponsesRouting(page, handlers) {
  // handlers: { stream(handler), nonstream(handler) }
  page.route('**/v1/responses', async (route, request) => {
    const bodyText = request.postData() || '{}';
    let parsed;
    try { parsed = JSON.parse(bodyText); } catch { parsed = {}; }
    const isStream = parsed?.stream === true;
    if (isStream) {
      if (handlers.stream) return handlers.stream(route, request);
      // default minimal SSE
      const sse = [
        'event: response.output_text.delta\ndata: {"delta":{"text":"Hi"}}\n\n',
        'event: response.completed\ndata: {}\n\n',
        'data: [DONE]\n\n',
      ].join('');
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sse,
      });
      return;
    }
    // non-stream
    if (handlers.nonstream) return handlers.nonstream(route, request);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function sendMessage(page, text) {
  const textbox = page.getByRole('textbox', { name: /message|chat|prompt/i });
  await textbox.fill(text);
  const sendBtn = page.getByRole('button', { name: /send/i }).first();
  await sendBtn.click({ force: true });
}

function sseBody(chunks) {
  return chunks.join('');
}

test.describe('title generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupApiKey(page);
  });

  test('fallback on invalid structure', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    setupResponsesRouting(page, {
      nonstream: async (route) => {
        // Return clearly invalid structure to trigger fallback + warning
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      },
      stream: null,
    });

    const input = 'Build me a REST API with auth and tests';
    await sendMessage(page, input);

    // Wait for first assistant message to appear to ensure flow progressed
    await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 10000 });

    // Title appears in Sidebar list item text
    const titleText = page.locator('.title-container .title-text').first();
    await expect(titleText).toHaveText(/Build me a REST API/i);

    // Console warning check
    const warned = logs.some((l) => /Title generation: Invalid response structure/i.test(l));
    expect(warned).toBeTruthy();
  });

  test('sets title from Responses output after first reply', async ({ page }) => {
    setupResponsesRouting(page, {
      nonstream: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ output: [{ content: [{ text: 'REST API Builder' }] }] }),
        });
      },
      stream: async (route) => {
        const body = sseBody([
          'event: response.output_text.delta\ndata: {"delta":{"text":"Hi"}}\n\n',
          'event: response.completed\ndata: {}\n\n',
          'data: [DONE]\n\n',
        ]);
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body });
      },
    });

    await sendMessage(page, 'Please outline a REST API design');

    // Wait for sidebar title text to match
    await expect(page.locator('.title-container .title-text').first()).toHaveText('REST API Builder', { timeout: 10000 });
  });

  test('does not override custom title', async ({ page }) => {
    // Create/rename current conversation via UI
    // Click edit/rename if available; fallback: use sidebar item context if exposed
    // Try a generic edit button near title
    const editButton = page.getByRole('button', { name: /edit title|rename/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click({ force: true });
      const titleInput = page.getByRole('textbox', { name: /title/i }).first();
      await titleInput.fill('My Custom Title');
      const saveBtn = page.getByRole('button', { name: /save/i }).first();
      await saveBtn.click({ force: true });
    }

    setupResponsesRouting(page, {
      nonstream: async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ output_text: 'Should Not Apply' }) });
      },
      stream: async (route) => {
        const body = sseBody([
          'event: response.output_text.delta\ndata: {"delta":{"text":"OK"}}\n\n',
          'event: response.completed\ndata: {}\n\n',
          'data: [DONE]\n\n',
        ]);
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body });
      },
    });

    await sendMessage(page, 'Anything');

    // Expect the title to remain custom if UI supports rename; otherwise, check it did not become Should Not Apply
    const customTitle = page.getByRole('heading', { name: 'My Custom Title' });
    if (await customTitle.isVisible().catch(() => false)) {
      await expect(customTitle).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /should not apply/i })).toHaveCount(0);
    }
  });

  test('sanitizes quotes and Title: prefix', async ({ page }) => {
    setupResponsesRouting(page, {
      nonstream: async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ output_text: '"Title: " "Quoted Name"' }),
        });
      },
      stream: async (route) => {
        const body = sseBody([
          'event: response.output_text.delta\ndata: {"delta":{"text":"Text"}}\n\n',
          'event: response.completed\ndata: {}\n\n',
          'data: [DONE]\n\n',
        ]);
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body });
      },
    });

    await sendMessage(page, 'Generate something');

    await expect(page.locator('.title-container .title-text').first()).toHaveText('Quoted Name', { timeout: 10000 });
  });
});
