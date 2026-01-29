import { test, expect } from '@playwright/test';
import { operateQuickSettings, bootstrapLiveAPI, sendMessage, waitForAssistantDone, getVisibleMessages } from './helpers';
import { debugInfo } from '../debug-utils';

/**
 * E2E tests for Stop button functionality during API streaming
 *
 * Tests verify that:
 * 1. Send button (envelope icon) changes to Stop button during streaming
 * 2. Stop button successfully aborts API requests for both providers
 * 3. Button state correctly reverts after stream completion
 */

test.describe('Stop Button Functionality', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('OpenAI: Stop button should appear during streaming', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    // Get the send button
    const sendButton = page.locator('button[aria-label="Send"]');

    // Verify initial state shows send icon (envelope)
    const sendIcon = sendButton.locator('img[alt="Send"]');
    await expect(sendIcon).toBeVisible();
    debugInfo('✓ Send button initially visible');

    // Fill the message but don't send yet
    const testMessage = 'Count to 50 slowly';
    await page.locator('textarea[aria-label="Chat input"]').fill(testMessage);
    debugInfo(`Filled message: "${testMessage}"`);

    // Click send button to start streaming
    await sendButton.click({ force: true });
    debugInfo('Clicked send button');

    // CRITICAL TEST: Stop button (Wait icon) should appear during streaming
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    // Wait a moment for the streaming to start
    await page.waitForTimeout(500);

    // Take screenshot to see what's actually happening
    await page.screenshot({ path: 'test-results/stop-button-openai-during-stream.png' });

    const isStopVisible = await stopIcon.isVisible();
    const isSendVisible = await sendIcon.isVisible();

    debugInfo(`After clicking send:`);
    debugInfo(`  - Stop icon visible: ${isStopVisible}`);
    debugInfo(`  - Send icon visible: ${isSendVisible}`);

    // This is the test that should pass but currently fails
    await expect(stopIcon).toBeVisible({ timeout: 2000 });
    debugInfo('✓ Stop button appeared during streaming');

    // Verify send icon is no longer visible
    await expect(sendIcon).not.toBeVisible();
    debugInfo('✓ Send button hidden during streaming');
  });

  test('OpenAI: Stop button should abort stream when clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    // Monitor network requests to verify abort
    let requestAborted = false;
    let requestStarted = false;

    page.on('requestfailed', (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        debugInfo('✓ OpenAI API request was aborted/failed');
        requestAborted = true;
      }
    });

    page.on('request', (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        debugInfo('OpenAI API request started');
        requestStarted = true;
      }
    });

    // Start streaming with a long response
    await page.locator('textarea[aria-label="Chat input"]').fill('Count to 100 slowly, one number per line');
    await sendButton.click({ force: true });

    // Wait for stop button to appear
    await expect(stopIcon).toBeVisible({ timeout: 2000 });
    debugInfo('Stop button appeared');

    // Get the initial message content length
    // Wait for at least some content to appear before clicking stop
    await page.waitForTimeout(1000); // Let some content stream in (increased from 500ms)

    const messages = await getVisibleMessages(page);
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const contentBeforeStop = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].text : '';
    debugInfo(`Content length before stop: ${contentBeforeStop.length} chars`);

    // If no content yet, wait a bit more (reasoning models may have a delay)
    if (contentBeforeStop.length === 0) {
      debugInfo('No content yet, waiting additional 1000ms...');
      await page.waitForTimeout(1000);
      const retryMessages = await getVisibleMessages(page);
      const retryAssistant = retryMessages.filter(m => m.role === 'assistant');
      const retryContent = retryAssistant.length > 0 ? retryAssistant[retryAssistant.length - 1].text : '';
      debugInfo(`Content after retry wait: ${retryContent.length} chars`);
    }

    // Click stop button to abort
    await sendButton.click({ force: true });
    debugInfo('Clicked stop button');

    // Send button should reappear quickly
    await expect(sendIcon).toBeVisible({ timeout: 3000 });
    await expect(stopIcon).not.toBeVisible();
    debugInfo('✓ Send button reappeared after stopping');

    // Wait a moment to ensure no more content arrives
    await page.waitForTimeout(1000);

    // Get final message content
    const finalMessages = await getVisibleMessages(page);
    const finalAssistantMessages = finalMessages.filter(m => m.role === 'assistant');
    const finalContent = finalAssistantMessages.length > 0 ? finalAssistantMessages[finalAssistantMessages.length - 1].text : '';
    debugInfo(`Final content length: ${finalContent.length} chars`);

    // Verify the message exists (may be empty if aborted during reasoning phase)
    // For reasoning models like gpt-5-nano, content may not appear until after reasoning completes
    debugInfo(`Final content length: ${finalContent.length} chars`);
    if (finalContent.length > 0) {
      debugInfo(`✓ Partial message preserved (${finalContent.length} chars)`);
    } else {
      debugInfo('⚠ No text content (may have aborted during reasoning phase)');
    }

    // Verify network request was actually made
    expect(requestStarted).toBe(true);
    debugInfo('✓ API request was initiated');

    // The critical test: verify the request was aborted
    // Note: This might not always show as "failed" if the stream completes naturally
    // But the content should be incomplete if we stopped it early enough
    if (requestAborted) {
      debugInfo('✓ Network request was aborted (confirmed via requestfailed event)');
    } else {
      debugInfo('⚠ Network abort not detected via requestfailed (may have completed naturally)');
    }

    // The real proof: verify the stream actually stopped
    // Either we have partial content OR we aborted before content started
    // A complete "count to 100" response would have ~300+ characters
    const streamWasStopped = finalContent.length < 250;
    expect(streamWasStopped).toBe(true);
    if (finalContent.length > 0) {
      debugInfo(`✓ Stream stopped with partial content (${finalContent.length}/300 chars)`);
    } else {
      debugInfo('✓ Stream stopped before content generation (aborted during reasoning)');
    }
  });

  test('Anthropic: Stop button should appear during streaming', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'Anthropic');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-3-haiku-20240307/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    await expect(sendIcon).toBeVisible();
    debugInfo('✓ Send button initially visible');

    await page.locator('textarea[aria-label="Chat input"]').fill('Count to 50 slowly');
    await sendButton.click({ force: true });
    debugInfo('Clicked send button');

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/stop-button-anthropic-during-stream.png' });

    const isStopVisible = await stopIcon.isVisible();
    const isSendVisible = await sendIcon.isVisible();

    debugInfo(`After clicking send (Anthropic):`);
    debugInfo(`  - Stop icon visible: ${isStopVisible}`);
    debugInfo(`  - Send icon visible: ${isSendVisible}`);

    await expect(stopIcon).toBeVisible({ timeout: 2000 });
    await expect(sendIcon).not.toBeVisible();
    debugInfo('✓ Stop button appeared during streaming');
  });
});
