/**
 * E2E Test Helpers for Summary Features
 *
 * Provides reusable functions for testing summary creation,
 * display, toggle, edit, and deletion.
 */

import { Page, Locator, expect } from '@playwright/test';
import { debugInfo, debugWarn, debugErr } from '../debug-utils.js';

/**
 * Click the "Summarize up to here" button on a message
 */
export async function clickSummarizeButton(page: Page, messageIndex: number): Promise<void> {
  debugInfo(`Clicking summarize button on message at index ${messageIndex}`);

  // Get all list items (messages)
  const messages = page.locator('[role="listitem"]');
  const message = messages.nth(messageIndex);

  await expect(message).toBeVisible({ timeout: 5000 });

  // Hover to reveal toolbelt
  await message.hover({ force: true });

  // Find and click the summarize button
  const summarizeBtn = message.locator('button[aria-label="Summarize up to here"]').first();
  await expect(summarizeBtn).toBeVisible({ timeout: 2000 });
  await summarizeBtn.click({ force: true });

  debugInfo('Summarize button clicked');
}

/**
 * Wait for summary generation to complete
 */
export async function waitForSummaryComplete(page: Page, options?: {
  timeout?: number;
}): Promise<void> {
  const timeout = options?.timeout ?? 30000;
  debugInfo('Waiting for summary generation to complete...');

  // Wait for the summary element to appear and not be in loading state
  const summaryElement = page.locator('[data-testid="summary-message"]').first();

  await expect(summaryElement).toBeVisible({ timeout });

  // Wait for loading state to finish
  const loadingIndicator = summaryElement.locator('[data-testid="summary-loading"]');
  await expect(loadingIndicator).not.toBeVisible({ timeout });

  debugInfo('Summary generation complete');
}

/**
 * Get all summary elements on the page
 */
export async function getSummaries(page: Page): Promise<Locator[]> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const count = await summaries.count();

  debugInfo(`Found ${count} summaries on page`);

  const result: Locator[] = [];
  for (let i = 0; i < count; i++) {
    result.push(summaries.nth(i));
  }
  return result;
}

/**
 * Get summary count on the page
 */
export async function getSummaryCount(page: Page): Promise<number> {
  const summaries = page.locator('[data-testid="summary-message"]');
  return await summaries.count();
}

/**
 * Toggle the active state of a summary via its checkbox
 */
export async function toggleSummaryActive(page: Page, summaryIndex: number): Promise<boolean> {
  debugInfo(`Toggling summary active state at index ${summaryIndex}`);

  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  await expect(summary).toBeVisible({ timeout: 5000 });

  // Find the checkbox
  const checkbox = summary.locator('input[type="checkbox"][aria-label*="Use summary"]');
  await expect(checkbox).toBeVisible({ timeout: 2000 });

  // Get current state
  const wasChecked = await checkbox.isChecked();

  // Click to toggle
  await checkbox.click({ force: true });

  // Verify the toggle worked
  const isNowChecked = await checkbox.isChecked();
  debugInfo(`Summary toggled: was ${wasChecked}, now ${isNowChecked}`);

  return isNowChecked;
}

/**
 * Check if a summary is currently active (checked)
 */
export async function isSummaryActive(page: Page, summaryIndex: number): Promise<boolean> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  const checkbox = summary.locator('input[type="checkbox"][aria-label*="Use summary"]');
  return await checkbox.isChecked();
}

/**
 * Get the content text of a summary
 */
export async function getSummaryContent(page: Page, summaryIndex: number): Promise<string> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  const content = summary.locator('[data-testid="summary-content"]');
  return await content.innerText();
}

/**
 * Click the edit button on a summary
 */
export async function clickSummaryEditButton(page: Page, summaryIndex: number): Promise<void> {
  debugInfo(`Clicking edit button on summary at index ${summaryIndex}`);

  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  await summary.hover({ force: true });

  const editBtn = summary.locator('button[aria-label="Edit summary"]');
  await expect(editBtn).toBeVisible({ timeout: 2000 });
  await editBtn.click({ force: true });

  debugInfo('Summary edit button clicked');
}

/**
 * Edit a summary's content
 */
export async function editSummaryContent(
  page: Page,
  summaryIndex: number,
  newContent: string
): Promise<void> {
  debugInfo(`Editing summary at index ${summaryIndex}`);

  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  // Click edit button first
  await summary.hover({ force: true });
  const editBtn = summary.locator('button[aria-label="Edit summary"]');
  await editBtn.click({ force: true });

  // Wait for edit textarea to appear
  const textarea = summary.locator('textarea[data-testid="summary-edit-textarea"]');
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // Clear and type new content
  await textarea.fill(newContent);

  // Click save button
  const saveBtn = summary.locator('button[aria-label="Save summary"]');
  await saveBtn.click({ force: true });

  // Wait for edit mode to close
  await expect(textarea).not.toBeVisible({ timeout: 2000 });

  debugInfo('Summary edit completed');
}

/**
 * Click the delete button on a summary
 */
export async function clickSummaryDeleteButton(page: Page, summaryIndex: number): Promise<void> {
  debugInfo(`Clicking delete button on summary at index ${summaryIndex}`);

  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  await summary.hover({ force: true });

  const deleteBtn = summary.locator('button[aria-label="Delete summary"]');
  await expect(deleteBtn).toBeVisible({ timeout: 2000 });
  await deleteBtn.click({ force: true });

  debugInfo('Summary delete button clicked');
}

/**
 * Verify a message at a specific index is a summary
 */
export async function verifySummaryAtIndex(page: Page, historyIndex: number): Promise<boolean> {
  const messages = page.locator('[role="listitem"]');
  const message = messages.nth(historyIndex);

  // Check if it's a summary by looking for the summary-specific attributes
  const isSummary = await message.locator('[data-testid="summary-message"]').count() > 0;
  debugInfo(`Message at index ${historyIndex} is summary: ${isSummary}`);

  return isSummary;
}

/**
 * Get the shadowed message count displayed on a summary
 */
export async function getShadowedMessageCount(page: Page, summaryIndex: number): Promise<number> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  const countElement = summary.locator('[data-testid="summary-message-count"]');
  const text = await countElement.innerText();

  // Parse "Summarizing N messages" or similar format
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if a summary is currently in loading/streaming state
 */
export async function isSummaryLoading(page: Page, summaryIndex: number): Promise<boolean> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  const loadingIndicator = summary.locator('[data-testid="summary-loading"]');
  return await loadingIndicator.isVisible();
}

/**
 * Wait for summary to appear (even if still loading)
 */
export async function waitForSummaryAppears(page: Page, options?: {
  timeout?: number;
}): Promise<void> {
  const timeout = options?.timeout ?? 10000;
  debugInfo('Waiting for summary element to appear...');

  const summaryElement = page.locator('[data-testid="summary-message"]').first();
  await expect(summaryElement).toBeVisible({ timeout });

  debugInfo('Summary element appeared');
}

/**
 * Get the streaming content from a loading summary
 */
export async function getStreamingContent(page: Page, summaryIndex: number): Promise<string> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  // Try streaming content first, fall back to regular content
  const streamingContent = summary.locator('[data-testid="summary-content-streaming"]');
  if (await streamingContent.isVisible()) {
    return await streamingContent.innerText();
  }

  const regularContent = summary.locator('[data-testid="summary-content"]');
  if (await regularContent.isVisible()) {
    return await regularContent.innerText();
  }

  return '';
}

/**
 * Get the model name displayed in a summary header
 * Returns empty string if no model is displayed
 */
export async function getSummaryModel(page: Page, summaryIndex: number): Promise<string> {
  const summaries = page.locator('[data-testid="summary-message"]');
  const summary = summaries.nth(summaryIndex);

  const modelElement = summary.locator('[data-testid="summary-model"]');
  if (await modelElement.isVisible()) {
    const text = await modelElement.innerText();
    // Remove parentheses: "(gpt-4o)" -> "gpt-4o"
    return text.replace(/[()]/g, '').trim();
  }

  return '';
}

/**
 * Set the summary model in Settings
 * Pass null to use "Use conversation model" (default)
 *
 * NOTE: This function imports helpers dynamically to avoid circular dependencies.
 * For use in tests, prefer using openSettings and saveAndCloseSettings directly.
 */
export async function setSummaryModel(page: Page, modelId: string | null): Promise<void> {
  debugInfo(`Setting summary model to: ${modelId ?? 'conversation model'}`);

  // Open settings using semantic selector cascade (same as helpers.ts openSettings)
  const cascades = [
    page.getByRole('button', { name: /settings(\s*\(.*\))?$/i }),
    page.getByRole('button', { name: /settings|preferences|api/i }),
    page.locator('button[title="Settings"]'),
  ];

  for (const selector of cascades) {
    if (await selector.isVisible().catch(() => false)) {
      await selector.click({ force: true });
      break;
    }
  }

  // Wait for settings dialog
  await expect(page.locator('#summary-model-selection')).toBeVisible({ timeout: 5000 });

  // Select the model
  const select = page.locator('#summary-model-selection');
  if (modelId === null) {
    await select.selectOption({ value: '' }); // null option has empty value in HTML
  } else {
    await select.selectOption(modelId);
  }

  // Close settings (click Save button)
  const saveBtn = page.getByRole('button', { name: /^save$/i });
  await saveBtn.click({ force: true });

  // Wait for settings to close
  await expect(page.locator('#summary-model-selection')).not.toBeVisible({ timeout: 3000 });

  debugInfo('Summary model setting saved');
}
