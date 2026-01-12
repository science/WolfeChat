/**
 * E2E Tests for Summary UI
 *
 * Tests the visual display and interaction with conversation summaries.
 */

import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  sendMessage,
  waitForAssistantDone,
  getVisibleMessages
} from './helpers.js';
import {
  clickSummarizeButton,
  waitForSummaryComplete,
  getSummaryCount,
  getSummaryContent,
  toggleSummaryActive,
  isSummaryActive,
  editSummaryContent,
  clickSummaryDeleteButton,
  getShadowedMessageCount
} from './summary-helpers.js';
import { debugInfo } from '../debug-utils.js';

// Skip tests if no API key
const hasKey = !!process.env.OPENAI_API_KEY;

(hasKey ? test.describe : test.describe.skip)('Summary UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should show summarize button in message toolbelt', async ({ page }) => {
    await bootstrapLiveAPI(page);

    // Send a message and wait for response
    await sendMessage(page, 'Hello, how are you?');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Get the first user message
    const messages = page.locator('[role="listitem"]');
    const firstMessage = messages.first();

    await expect(firstMessage).toBeVisible();

    // Hover to reveal toolbelt
    await firstMessage.hover();

    // Look for the summarize button
    const summarizeBtn = firstMessage.locator('button[aria-label="Summarize up to here"]');
    await expect(summarizeBtn).toBeVisible({ timeout: 2000 });
  });

  test('should create and display summary when button clicked', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create a short conversation
    await sendMessage(page, 'What is 2+2?');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Get initial message count
    const initialMessages = await getVisibleMessages(page);
    const initialCount = initialMessages.length;
    debugInfo(`Initial message count: ${initialCount}`);

    // Click summarize on the user's first message (includes user + assistant response)
    await clickSummarizeButton(page, 1); // Index 1 is assistant response

    // Wait for summary to be generated
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify summary appears
    const summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    // Verify summary has content
    const content = await getSummaryContent(page, 0);
    expect(content.length).toBeGreaterThan(0);
    debugInfo(`Summary content: ${content.substring(0, 100)}...`);
  });

  test('should display summary with distinct visual styling', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create conversation and summary
    await sendMessage(page, 'Hello');
    await waitForAssistantDone(page, { timeout: 60000 });

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify summary has distinct styling
    const summary = page.locator('[data-testid="summary-message"]').first();
    await expect(summary).toBeVisible();

    // Check for summary-specific visual elements
    const header = summary.locator('[data-testid="summary-header"]');
    await expect(header).toContainText(/summary/i);

    // Check for the checkbox
    const checkbox = summary.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked(); // Default should be checked
  });

  test('should toggle summary active state via checkbox', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    await sendMessage(page, 'Test message');
    await waitForAssistantDone(page, { timeout: 60000 });

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify initially checked
    let isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(true);

    // Toggle off
    await toggleSummaryActive(page, 0);
    isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(false);

    // Toggle back on
    await toggleSummaryActive(page, 0);
    isActive = await isSummaryActive(page, 0);
    expect(isActive).toBe(true);
  });

  test('should show message count in summary', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create conversation with multiple exchanges
    await sendMessage(page, 'First message');
    await waitForAssistantDone(page, { timeout: 60000 });

    await sendMessage(page, 'Second message');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Summarize up to 4th message (2 user + 2 assistant = 4 messages)
    const messages = await getVisibleMessages(page);
    debugInfo(`Total messages before summary: ${messages.length}`);

    // Click summarize on the last message before current
    await clickSummarizeButton(page, 3); // 4th message (0-indexed)
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify the count shows appropriate number
    const count = await getShadowedMessageCount(page, 0);
    expect(count).toBeGreaterThan(0);
    debugInfo(`Shadowed message count: ${count}`);
  });

  test('should edit summary content', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    await sendMessage(page, 'Original message');
    await waitForAssistantDone(page, { timeout: 60000 });

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Edit the summary
    const newContent = 'This is my custom edited summary text.';
    await editSummaryContent(page, 0, newContent);

    // Verify the content changed
    const content = await getSummaryContent(page, 0);
    expect(content).toBe(newContent);
  });

  test('should delete summary', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    await sendMessage(page, 'Test for deletion');
    await waitForAssistantDone(page, { timeout: 60000 });

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify summary exists
    let summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    // Delete the summary
    await clickSummaryDeleteButton(page, 0);

    // Wait a moment for deletion to process
    await page.waitForTimeout(500);

    // Verify summary is gone
    summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(0);
  });

  test('should persist summary across page reload', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    await sendMessage(page, 'Persistence test');
    await waitForAssistantDone(page, { timeout: 60000 });

    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Get the summary content
    const originalContent = await getSummaryContent(page, 0);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify summary still exists
    const summaryCount = await getSummaryCount(page);
    expect(summaryCount).toBe(1);

    // Verify content is preserved
    const reloadedContent = await getSummaryContent(page, 0);
    expect(reloadedContent).toBe(originalContent);
  });

});
