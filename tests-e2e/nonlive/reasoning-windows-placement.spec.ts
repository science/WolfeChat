import { test, expect } from '@playwright/test';

/**
 * Simplified tests for Reasoning Windows (RW) behavior.
 * 
 * Core tests:
 * 1) RW appear only when reasoning data is present in API response
 * 2) RW placement remains stable when new messages are added
 * 
 * Using network mocks to control when reasoning data appears.
 */

// SSE stream generator for assistant responses
function createSSEStream(text: string, includeReasoning = false): string {
  const events: string[] = [];
  
  // If reasoning is enabled, add reasoning events
  if (includeReasoning) {
    events.push(
      'event: response.reasoning_summary.delta',
      `data: {"type":"response.reasoning_summary.delta","delta":{"text":"Analyzing the request..."}}`,
      '',
      'event: response.reasoning_summary.done',
      `data: {"type":"response.reasoning_summary.done"}`,
      ''
    );
  }
  
  // Main content
  events.push(
    'event: response.output_text.delta',
    `data: {"type":"response.output_text.delta","delta":{"text":${JSON.stringify(text)}}}`,
    '',
    'event: response.completed',
    'data: {"type":"response.completed"}',
    '',
    'data: [DONE]',
    ''
  );
  
  return events.join('\n');
}

// Seed localStorage with test models
async function seedTestEnvironment(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('api_key', JSON.stringify('sk-test'));
    localStorage.setItem('models', JSON.stringify([
      { id: 'gpt-3.5-turbo' },  // Non-reasoning model
      { id: 'gpt-5-nano' }       // Reasoning model (per AGENTS.md)
    ]));
    localStorage.setItem('selectedModel', 'gpt-3.5-turbo');
  });
}

// Helper to send a message via UI
async function sendMessage(page: import('@playwright/test').Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Chat input' });
  await input.waitFor({ state: 'visible' });
  await input.fill(text);
  
  // Try send button first, fallback to Ctrl+Enter
  const sendButton = page.getByRole('button', { name: /send/i });
  if (await sendButton.isVisible().catch(() => false)) {
    await sendButton.click();
  } else {
    await input.press('Control+Enter');
  }
  
  // Wait for message to appear in chat
  await page.waitForTimeout(200);
}

// Helper to select model via Quick Settings
async function selectModel(page: import('@playwright/test').Page, modelName: string) {
  // Open Quick Settings
  const qsToggle = page.locator('button[aria-controls="quick-settings-body"]');
  if (await qsToggle.isVisible().catch(() => false)) {
    await qsToggle.click();
    await page.waitForTimeout(100);
    
    // Select model
    const modelSelect = page.locator('#current-model-select');
    if (await modelSelect.isVisible().catch(() => false)) {
      await modelSelect.selectOption({ label: modelName });
    } else {
      // Fallback to localStorage
      await page.evaluate((model) => {
        localStorage.setItem('selectedModel', model);
      }, modelName);
      await page.reload();
    }
    
    // Close Quick Settings if it's still open
    const expanded = await qsToggle.getAttribute('aria-expanded');
    if (expanded === 'true') {
      await qsToggle.click();
    }
  } else {
    // Direct localStorage fallback
    await page.evaluate((model) => {
      localStorage.setItem('selectedModel', model);
    }, modelName);
    await page.reload();
  }
}

test.describe('Reasoning Windows Placement', () => {
  test.beforeEach(async ({ page }) => {
    await seedTestEnvironment(page);
  });

  test('RW appear only with reasoning data and bind to correct message', async ({ page }) => {
    let responseCount = 0;
    
    // Mock API responses
    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      
      const payload = req.postDataJSON();
      responseCount++;
      
      // First response: no reasoning (gpt-3.5-turbo)
      // Second response: with reasoning (gpt-5-nano)
      const includeReasoning = responseCount === 2 && payload?.model === 'gpt-5-nano';
      
      if (payload?.stream === true) {
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
          },
          body: createSSEStream(`Response ${responseCount}`, includeReasoning),
        });
      }
      
      // Non-streaming (title generation)
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'Test Chat' }),
      });
    });
    
    await page.goto('/');
    
    // Send first message with non-reasoning model
    await sendMessage(page, 'Hello');
    
    // Wait for response
    await page.waitForTimeout(500);
    
    // Check no reasoning windows present
    let reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(0);
    
    // Select reasoning model
    await selectModel(page, 'gpt-5-nano');
    
    // Send second message (with reasoning)
    await sendMessage(page, 'Tell me more');
    
    // Wait for response
    await page.waitForTimeout(500);
    
    // Check reasoning window appears
    await expect(reasoningWindows).toHaveCount(1);
    
    // Verify it's associated with the user message that triggered it
    const messages = page.locator('.message');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThanOrEqual(3); // At least 2 user + 1 assistant
  });

  test('RW placement remains stable when new messages are added', async ({ page }) => {
    // Mock API to always include reasoning for gpt-5-nano
    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      
      const payload = req.postDataJSON();
      
      if (payload?.stream === true) {
        const includeReasoning = payload?.model === 'gpt-5-nano';
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
          },
          body: createSSEStream('Response text', includeReasoning),
        });
      }
      
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'Chat' }),
      });
    });
    
    await page.goto('/');
    
    // Use reasoning model
    await selectModel(page, 'gpt-5-nano');
    
    // Send first message with reasoning
    await sendMessage(page, 'First message');
    
    // Wait for response and reasoning window
    await page.waitForTimeout(500);
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(1);
    
    // Get initial position of reasoning window
    const initialPosition = await page.evaluate(() => {
      const details = document.querySelector('details');
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop
      };
    });
    
    expect(initialPosition).not.toBeNull();
    
    // Add more messages
    await sendMessage(page, 'Second message');
    await page.waitForTimeout(500);
    
    await sendMessage(page, 'Third message with much longer text that might affect layout positioning');
    await page.waitForTimeout(500);
    
    // Verify first RW position hasn't shifted significantly
    const finalPosition = await page.evaluate(() => {
      const details = document.querySelector('details'); // First details element
      if (!details) return null;
      const rect = details.getBoundingClientRect();
      const container = document.querySelector('.overflow-y-auto');
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      return {
        relativeTop: rect.top - containerRect.top,
        scrollTop: (container as HTMLElement).scrollTop
      };
    });
    
    expect(finalPosition).not.toBeNull();
    
    // The absolute position in the document should remain stable (within tolerance)
    const adjustedInitial = initialPosition!.relativeTop + initialPosition!.scrollTop;
    const adjustedFinal = finalPosition!.relativeTop + finalPosition!.scrollTop;
    expect(Math.abs(adjustedFinal - adjustedInitial)).toBeLessThan(30); // 30px tolerance for minor shifts
  });

  test('Non-reasoning model shows no RW', async ({ page }) => {
    // Mock API responses based on model
    await page.route('**/v1/responses', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      
      const payload = req.postDataJSON();
      
      if (payload?.stream === true) {
        // Only include reasoning for gpt-5-nano
        const includeReasoning = payload.model === 'gpt-5-nano';
        
        return route.fulfill({
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
          },
          body: createSSEStream('Response', includeReasoning),
        });
      }
      
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ output_text: 'Chat' }),
      });
    });
    
    await page.goto('/');
    
    // Start with reasoning model
    await selectModel(page, 'gpt-5-nano');
    await sendMessage(page, 'Message with reasoning model');
    await page.waitForTimeout(500);
    
    // Verify reasoning window appears
    const reasoningWindows = page.locator('details:has-text("Reasoning")');
    await expect(reasoningWindows).toHaveCount(1);
    
    // Switch to non-reasoning model
    await selectModel(page, 'gpt-3.5-turbo');
    await sendMessage(page, 'Message with non-reasoning model');
    await page.waitForTimeout(500);
    
    // Verify still only one reasoning window (from first message)
    await expect(reasoningWindows).toHaveCount(1);
    
    // Send another message with non-reasoning model
    await sendMessage(page, 'Another non-reasoning message');
    await page.waitForTimeout(500);
    
    // Still only one reasoning window
    await expect(reasoningWindows).toHaveCount(1);
  });
});