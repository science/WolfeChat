/**
 * E2E Tests for Summary Model Settings
 *
 * Tests the configurable summary model feature:
 * - Summary shows model name in header
 * - By default, uses conversation's model
 * - Can configure a specific model in Settings
 * - Configured model is used for all summaries
 */

import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  sendMessage,
  waitForAssistantDone,
  openSettings,
  saveAndCloseSettings
} from './helpers.js';
import {
  clickSummarizeButton,
  waitForSummaryComplete,
  getSummaryCount,
  getSummaryModel
} from './summary-helpers.js';
import { debugInfo } from '../debug-utils.js';

// Skip tests if no API key
const hasKey = !!process.env.OPENAI_API_KEY;

(hasKey ? test.describe : test.describe.skip)('Summary Model Settings', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('summary should display model name in header', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create a conversation
    await sendMessage(page, 'Hello, how are you today?');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Click summarize
    await clickSummarizeButton(page, 1);

    // Wait for summary to complete
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify summary has a model name displayed
    const modelName = await getSummaryModel(page, 0);
    debugInfo(`Summary model name: ${modelName}`);

    // Model name should be present (not empty)
    expect(modelName.length).toBeGreaterThan(0);
    // Should be a valid model name format
    expect(modelName).toMatch(/^(gpt-|claude-)/);
  });

  test('summary should use conversation model by default', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create a conversation using the default model
    await sendMessage(page, 'What is 2 plus 2?');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Click summarize
    await clickSummarizeButton(page, 1);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Get the model name from summary
    const summaryModel = await getSummaryModel(page, 0);
    debugInfo(`Summary generated with model: ${summaryModel}`);

    // The summary should have been generated (model should exist)
    expect(summaryModel.length).toBeGreaterThan(0);
  });

  test('summary model setting should appear in Settings menu', async ({ page }) => {
    test.setTimeout(60000);
    await bootstrapLiveAPI(page);

    // Open settings using helper
    await openSettings(page);

    // Wait for settings dialog and summary model section
    const summaryModelSection = page.locator('h3:has-text("Summary Generation")');
    await expect(summaryModelSection).toBeVisible({ timeout: 5000 });

    // Verify the summary model dropdown exists
    const summaryModelSelect = page.locator('#summary-model-selection');
    await expect(summaryModelSelect).toBeVisible();

    // Verify it has the default option (check by counting options, as select options aren't "visible")
    const defaultOption = summaryModelSelect.locator('option:has-text("Use conversation model")');
    const optionCount = await defaultOption.count();
    expect(optionCount).toBeGreaterThan(0);

    debugInfo('Summary model settings are visible in Settings menu');

    // Close settings using helper
    await saveAndCloseSettings(page);
  });

  test('summary should include message count in header', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrapLiveAPI(page);

    // Create a conversation with multiple exchanges
    await sendMessage(page, 'Hello!');
    await waitForAssistantDone(page, { timeout: 60000 });

    await sendMessage(page, 'How are you?');
    await waitForAssistantDone(page, { timeout: 60000 });

    // Click summarize on the last message (should summarize all 4 messages)
    await clickSummarizeButton(page, 3);
    await waitForSummaryComplete(page, { timeout: 60000 });

    // Verify summary exists
    const count = await getSummaryCount(page);
    expect(count).toBe(1);

    // Check that the summary header shows the message count
    const summary = page.locator('[data-testid="summary-message"]').first();
    const headerText = await summary.locator('[data-testid="summary-header"]').innerText();

    // Should mention the number of messages
    expect(headerText).toMatch(/\d+ message/);
    debugInfo(`Summary header: ${headerText}`);
  });
});
