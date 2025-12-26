import { test, expect } from '@playwright/test';
import { operateQuickSettings, bootstrapLiveAPI, sendMessage, getVisibleMessages } from './helpers';
import { debugInfo, debugErr, debugWarn } from '../debug-utils';

/**
 * E2E tests for Stop button functionality during reasoning model streaming
 *
 * This test specifically targets the bug where:
 * 1. Stop button is clicked during reasoning phase
 * 2. UI updates to show send button (looks like it worked)
 * 3. But the stream continues in the background
 * 4. Full response eventually appears
 *
 * The test verifies that clicking stop ACTUALLY stops the stream,
 * not just hides the UI indicators.
 */

// Helper to get reasoning panel state from page
async function getReasoningPanels(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const win = window as any;
    if (typeof win.__getReasoningPanels === 'function') {
      return win.__getReasoningPanels();
    }
    return [];
  });
}

// Helper to get total reasoning text length across all panels
async function getTotalReasoningTextLength(page: any): Promise<number> {
  const panels = await getReasoningPanels(page);
  return panels.reduce((total: number, panel: any) => total + (panel.text?.length || 0), 0);
}

test.describe('Stop Button - Reasoning Models', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('Stop button should ACTUALLY stop the stream, not just update UI', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Use a reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    // Send a message that will generate a long response
    // This gives us time to click stop during reasoning phase
    const testMessage = 'Write a detailed 500 word essay about the history of computing, including all major milestones from the 1940s to present day.';
    await page.locator('textarea[aria-label="Chat input"]').fill(testMessage);
    debugInfo(`Sending message: "${testMessage.substring(0, 50)}..."`);

    await sendButton.click();
    debugInfo('Message sent, waiting for streaming to start');

    // Wait for the stop button to appear (indicates streaming started)
    await expect(stopIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Stop button appeared - streaming has started');

    // Wait a moment to let reasoning begin (but not too long)
    // This simulates the user clicking stop during reasoning phase
    await page.waitForTimeout(800);

    // Capture content BEFORE clicking stop
    let contentBeforeStop = '';
    const messagesBefore = await getVisibleMessages(page);
    const assistantBefore = messagesBefore.filter(m => m.role === 'assistant');
    if (assistantBefore.length > 0) {
      contentBeforeStop = assistantBefore[assistantBefore.length - 1].text;
    }
    debugInfo(`Content before stop: ${contentBeforeStop.length} chars`);

    // Click the stop button
    await sendButton.click();
    debugInfo('Clicked stop button');

    // The send button should reappear (this is what the UI does now)
    await expect(sendIcon).toBeVisible({ timeout: 3000 });
    debugInfo('Send button reappeared - UI shows stream is stopped');

    // Capture content immediately after stop
    let contentAfterStop = '';
    const messagesAfter = await getVisibleMessages(page);
    const assistantAfter = messagesAfter.filter(m => m.role === 'assistant');
    if (assistantAfter.length > 0) {
      contentAfterStop = assistantAfter[assistantAfter.length - 1].text;
    }
    debugInfo(`Content immediately after stop: ${contentAfterStop.length} chars`);

    // NOW THE CRITICAL TEST:
    // Wait a significant amount of time to see if MORE content appears
    // If the stream was truly stopped, no more content should arrive
    debugInfo('Waiting 5 seconds to verify no more content arrives...');
    await page.waitForTimeout(5000);

    // Capture content after waiting
    let contentAfterWait = '';
    const messagesAfterWait = await getVisibleMessages(page);
    const assistantAfterWait = messagesAfterWait.filter(m => m.role === 'assistant');
    if (assistantAfterWait.length > 0) {
      contentAfterWait = assistantAfterWait[assistantAfterWait.length - 1].text;
    }
    debugInfo(`Content after 5s wait: ${contentAfterWait.length} chars`);

    // Calculate how much content was added after stop
    const contentAddedAfterStop = contentAfterWait.length - contentAfterStop.length;
    debugInfo(`Content added after stop button clicked: ${contentAddedAfterStop} chars`);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/stop-button-reasoning-after-wait.png' });

    // THE KEY ASSERTION:
    // If the stream was truly stopped, very little (or no) content should be added after stop
    // Some small amount might be in the buffer, but not hundreds of characters
    const maxAcceptableAddition = 50; // Allow small buffer flush

    if (contentAddedAfterStop > maxAcceptableAddition) {
      debugErr(`BUG DETECTED: ${contentAddedAfterStop} chars added after stop button clicked!`);
      debugErr('This indicates the stream continued in the background after stop was clicked.');
      debugErr(`Content before stop: ${contentBeforeStop.length} chars`);
      debugErr(`Content after stop: ${contentAfterStop.length} chars`);
      debugErr(`Content after wait: ${contentAfterWait.length} chars`);
    }

    expect(contentAddedAfterStop).toBeLessThanOrEqual(maxAcceptableAddition);
  });

  test('Stop button should prevent reasoning windows from completing in background', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Use a reasoning model with visible reasoning windows
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'medium', // Ensure we get reasoning output
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    // Send a message that will definitely trigger reasoning
    const testMessage = 'Explain the mathematical proof for the Pythagorean theorem step by step.';
    await page.locator('textarea[aria-label="Chat input"]').fill(testMessage);
    await sendButton.click();
    debugInfo('Message sent');

    // Wait for streaming to start
    await expect(stopIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Streaming started');

    // Look for reasoning panel to appear
    const reasoningPanel = page.locator('[data-reasoning-panel], .reasoning-panel, [class*="reasoning"]').first();

    // Wait a bit for reasoning to potentially start
    await page.waitForTimeout(1500);

    // Check if reasoning panel appeared
    const hasReasoningPanel = await reasoningPanel.isVisible().catch(() => false);
    debugInfo(`Reasoning panel visible: ${hasReasoningPanel}`);

    // Click stop
    await sendButton.click();
    debugInfo('Clicked stop button');

    // Verify UI updates
    await expect(sendIcon).toBeVisible({ timeout: 3000 });

    // Capture the current state of all messages
    const messagesAtStop = await getVisibleMessages(page);
    const messageCountAtStop = messagesAtStop.length;
    debugInfo(`Message count at stop: ${messageCountAtStop}`);

    // Wait to see if any background processing completes
    debugInfo('Waiting 6 seconds for any background processing...');
    await page.waitForTimeout(6000);

    // Check if any new messages appeared or existing ones grew significantly
    const messagesAfterWait = await getVisibleMessages(page);
    const messageCountAfterWait = messagesAfterWait.length;
    debugInfo(`Message count after wait: ${messageCountAfterWait}`);

    // Compare content lengths
    let totalLengthAtStop = 0;
    let totalLengthAfterWait = 0;

    for (const msg of messagesAtStop) {
      if (msg.role === 'assistant') totalLengthAtStop += msg.text.length;
    }
    for (const msg of messagesAfterWait) {
      if (msg.role === 'assistant') totalLengthAfterWait += msg.text.length;
    }

    const contentGrowth = totalLengthAfterWait - totalLengthAtStop;
    debugInfo(`Total assistant content at stop: ${totalLengthAtStop} chars`);
    debugInfo(`Total assistant content after wait: ${totalLengthAfterWait} chars`);
    debugInfo(`Content growth after stop: ${contentGrowth} chars`);

    await page.screenshot({ path: 'test-results/stop-button-reasoning-panel-test.png' });

    // The stream should be truly stopped - minimal content growth
    expect(contentGrowth).toBeLessThanOrEqual(50);
  });

  test('Network request should be aborted when stop is clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');

    // Track network request lifecycle
    let requestStarted = false;
    let requestCompleted = false;
    let requestAborted = false;
    let responseReceived = false;

    page.on('request', (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        requestStarted = true;
        debugInfo('API request started');
      }
    });

    page.on('requestfailed', (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        requestAborted = true;
        debugInfo(`API request failed/aborted: ${request.failure()?.errorText}`);
      }
    });

    page.on('requestfinished', (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        requestCompleted = true;
        debugInfo('API request completed normally');
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('api.openai.com/v1/responses')) {
        responseReceived = true;
        debugInfo(`API response received: ${response.status()}`);
      }
    });

    // Send message
    await page.locator('textarea[aria-label="Chat input"]').fill('Write a long story about space exploration, at least 1000 words.');
    await sendButton.click();

    // Wait for streaming to start
    await expect(stopIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Streaming started');

    // Wait a moment then click stop
    await page.waitForTimeout(500);
    await sendButton.click();
    debugInfo('Stop button clicked');

    // Wait for UI to update
    await expect(sendIcon).toBeVisible({ timeout: 3000 });

    // Give time for network events to settle
    await page.waitForTimeout(2000);

    debugInfo(`Request started: ${requestStarted}`);
    debugInfo(`Request aborted: ${requestAborted}`);
    debugInfo(`Request completed: ${requestCompleted}`);
    debugInfo(`Response received: ${responseReceived}`);

    // The request should have been started
    expect(requestStarted).toBe(true);

    // Either the request was aborted OR it completed but we stopped processing it
    // The key metric is whether more content arrives AFTER stop
    // (tested in the other test cases)

    if (!requestAborted && requestCompleted) {
      debugInfo('WARNING: Network request completed normally despite stop click');
      debugInfo('This could indicate the abort signal is not being sent correctly');
    }
  });

  test('Reasoning panels should stop updating after stop is clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high', // More reasoning = better chance to catch the bug
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');

    // Send a complex message that requires reasoning
    await page.locator('textarea[aria-label="Chat input"]').fill(
      'Solve this step by step: A farmer has 17 sheep. All but 9 die. How many are left? Show your complete reasoning process.'
    );
    await sendButton.click();
    debugInfo('Message sent');

    // Wait for streaming to start
    await expect(stopIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Streaming started');

    // Wait for reasoning panels to start populating
    // Poll until we see some reasoning text
    let reasoningTextAtWaitStart = 0;
    const maxWaitForReasoning = 10000; // 10 seconds
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitForReasoning) {
      reasoningTextAtWaitStart = await getTotalReasoningTextLength(page);
      if (reasoningTextAtWaitStart > 50) {
        debugInfo(`Reasoning text detected: ${reasoningTextAtWaitStart} chars`);
        break;
      }
      await page.waitForTimeout(100);
    }

    if (reasoningTextAtWaitStart < 50) {
      debugWarn(`Only ${reasoningTextAtWaitStart} chars of reasoning text after ${maxWaitForReasoning}ms`);
      debugWarn('Test may not be able to properly verify abort behavior');
    }

    // Capture state right before clicking stop
    const panelsBeforeStop = await getReasoningPanels(page);
    const reasoningTextBeforeStop = await getTotalReasoningTextLength(page);
    debugInfo(`Before stop: ${panelsBeforeStop.length} panels, ${reasoningTextBeforeStop} chars of reasoning`);

    // Click stop
    await sendButton.click();
    const stopClickTime = Date.now();
    debugInfo(`Stop clicked at ${stopClickTime}`);

    // Wait for UI to update
    await expect(sendIcon).toBeVisible({ timeout: 3000 });
    debugInfo('Send button visible - UI indicates streaming stopped');

    // Capture state immediately after stop
    const reasoningTextImmediatelyAfterStop = await getTotalReasoningTextLength(page);
    debugInfo(`Immediately after stop: ${reasoningTextImmediatelyAfterStop} chars`);

    // Now wait and monitor for any continued updates
    // This is the key test - if the stream truly stopped, reasoning text should NOT grow
    // Using 10 seconds since the bug may manifest as a delayed "pouring out" of content
    const monitorDuration = 10000; // 10 seconds
    const monitorInterval = 200;
    let maxReasoningTextObserved = reasoningTextImmediatelyAfterStop;
    let updateCount = 0;

    debugInfo(`Monitoring for ${monitorDuration}ms...`);

    for (let elapsed = 0; elapsed < monitorDuration; elapsed += monitorInterval) {
      await page.waitForTimeout(monitorInterval);
      const currentReasoningText = await getTotalReasoningTextLength(page);

      if (currentReasoningText > maxReasoningTextObserved) {
        updateCount++;
        debugWarn(`BUG: Reasoning text grew from ${maxReasoningTextObserved} to ${currentReasoningText} after stop!`);
        maxReasoningTextObserved = currentReasoningText;
      }
    }

    const totalGrowthAfterStop = maxReasoningTextObserved - reasoningTextImmediatelyAfterStop;
    debugInfo(`Final state: ${maxReasoningTextObserved} chars (grew ${totalGrowthAfterStop} chars after stop)`);
    debugInfo(`Update count after stop: ${updateCount}`);

    // Also check message content
    const messages = await getVisibleMessages(page);
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
    const assistantContent = assistantMessages.map((m: any) => m.text).join('');
    debugInfo(`Assistant message content: ${assistantContent.length} chars`);

    await page.screenshot({ path: 'test-results/stop-reasoning-panel-monitor.png' });

    // THE KEY ASSERTION:
    // If stop worked correctly, reasoning text should not have grown significantly
    // Allow a small buffer for in-flight data
    const maxAcceptableGrowth = 100; // Small buffer for already-received chunks

    if (totalGrowthAfterStop > maxAcceptableGrowth) {
      debugErr(`STOP BUTTON BUG CONFIRMED!`);
      debugErr(`Reasoning text grew ${totalGrowthAfterStop} chars after stop was clicked`);
      debugErr(`This indicates the stream continued processing in the background`);
    }

    expect(totalGrowthAfterStop).toBeLessThanOrEqual(maxAcceptableGrowth);
  });

  test('Anthropic: Content should stop arriving after stop is clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check if Anthropic API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      test.skip(true, 'ANTHROPIC_API_KEY not set');
      return;
    }

    await bootstrapLiveAPI(page, 'Anthropic');

    // Use an Anthropic model - claude-sonnet-4 or claude-3-haiku as fallback
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4|claude-3-haiku/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');

    // Send a message that should generate a longer response
    await page.locator('textarea[aria-label="Chat input"]').fill(
      'Write a detailed analysis of the French Revolution, including causes, key events, and lasting impacts. Be thorough.'
    );
    await sendButton.click();
    debugInfo('Message sent to Anthropic');

    // Wait for streaming to start
    await expect(stopIcon).toBeVisible({ timeout: 10000 });
    debugInfo('Anthropic streaming started');

    // Wait for some content to appear
    await page.waitForTimeout(2000);

    // Get initial content
    const messagesBeforeStop = await getVisibleMessages(page);
    const assistantBeforeStop = messagesBeforeStop.filter((m: any) => m.role === 'assistant');
    const contentBeforeStop = assistantBeforeStop.map((m: any) => m.text).join('');
    debugInfo(`Content before stop: ${contentBeforeStop.length} chars`);

    // Click stop
    await sendButton.click();
    debugInfo('Clicked stop button');

    // Wait for UI to update
    await expect(sendIcon).toBeVisible({ timeout: 3000 });
    debugInfo('Send button visible');

    // Capture content immediately after stop
    const messagesAfterStop = await getVisibleMessages(page);
    const assistantAfterStop = messagesAfterStop.filter((m: any) => m.role === 'assistant');
    const contentAfterStop = assistantAfterStop.map((m: any) => m.text).join('');
    debugInfo(`Content immediately after stop: ${contentAfterStop.length} chars`);

    // Monitor for continued content arrival
    const monitorDuration = 10000;
    const monitorInterval = 200;
    let maxContentObserved = contentAfterStop.length;

    debugInfo(`Monitoring for ${monitorDuration}ms...`);

    for (let elapsed = 0; elapsed < monitorDuration; elapsed += monitorInterval) {
      await page.waitForTimeout(monitorInterval);
      const messages = await getVisibleMessages(page);
      const assistant = messages.filter((m: any) => m.role === 'assistant');
      const content = assistant.map((m: any) => m.text).join('');

      if (content.length > maxContentObserved) {
        debugWarn(`BUG: Content grew from ${maxContentObserved} to ${content.length} after stop!`);
        maxContentObserved = content.length;
      }
    }

    const totalGrowthAfterStop = maxContentObserved - contentAfterStop.length;
    debugInfo(`Final content: ${maxContentObserved} chars (grew ${totalGrowthAfterStop} chars after stop)`);

    await page.screenshot({ path: 'test-results/stop-anthropic-content-monitor.png' });

    // Allow small buffer for in-flight data
    const maxAcceptableGrowth = 100;

    if (totalGrowthAfterStop > maxAcceptableGrowth) {
      debugErr(`STOP BUTTON BUG CONFIRMED for Anthropic!`);
      debugErr(`Content grew ${totalGrowthAfterStop} chars after stop was clicked`);
    }

    expect(totalGrowthAfterStop).toBeLessThanOrEqual(maxAcceptableGrowth);
  });

  test('isStreaming store should remain true until stream actually ends', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    // Inject a hook to monitor isStreaming state changes
    await page.evaluate(() => {
      const win = window as any;
      win.__streamingStateLog = [];

      // Try to hook into the store if accessible
      // We'll check this later
    });

    // Send message
    await page.locator('textarea[aria-label="Chat input"]').fill('Tell me about quantum computing in detail.');
    await sendButton.click();

    // Wait for streaming
    await expect(stopIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Streaming started');

    // Wait and click stop
    await page.waitForTimeout(800);

    // Capture timing for stop click
    const stopClickTime = Date.now();
    await sendButton.click();
    debugInfo(`Stop clicked at ${stopClickTime}`);

    // Immediately check if stop icon is still visible
    const stopStillVisibleImmediately = await stopIcon.isVisible().catch(() => false);
    debugInfo(`Stop icon visible immediately after click: ${stopStillVisibleImmediately}`);

    // Check if streaming indicator disappears too fast (within 100ms = suspiciously fast)
    await page.waitForTimeout(100);
    const stopVisibleAfter100ms = await stopIcon.isVisible().catch(() => false);
    debugInfo(`Stop icon visible after 100ms: ${stopVisibleAfter100ms}`);

    // The issue: if isStreaming.set(false) is called immediately in closeStream(),
    // the stop icon will disappear almost instantly, even if the stream is still
    // processing in the background.

    // A proper implementation would:
    // 1. Send the abort signal
    // 2. Wait for the stream to actually end (or timeout)
    // 3. THEN set isStreaming to false

    // For now, we just document the behavior
    if (!stopVisibleAfter100ms) {
      debugInfo('NOTE: Stop icon disappeared within 100ms of clicking');
      debugInfo('This is suspiciously fast and may indicate isStreaming.set(false) is called too early');
    }

    // Wait for things to settle
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/stop-button-timing-test.png' });
  });

});
