/**
 * TDD Test: Orphaned reasoning window bug
 *
 * Bug: When stopping a Claude reasoning stream mid-flow, deleting the message,
 * then sending a new message, TWO reasoning windows appear side-by-side.
 *
 * Expected: Only ONE reasoning window should appear for the new message.
 *
 * Root cause: When stream is aborted, reasoningSupport.completeReasoning() is
 * not called, leaving the panel in an incomplete state. The window/panel
 * cleanup during message deletion may also fail.
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, getVisibleMessages } from './helpers';
import { debugInfo } from '../debug-utils';

// Helper: Get reasoning windows from store
async function getReasoningWindows(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const win = window as any;
    if (typeof win.__getReasoningWindows === 'function') {
      return win.__getReasoningWindows();
    }
    return [];
  });
}

// Helper: Get reasoning panels from store
async function getReasoningPanels(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const win = window as any;
    if (typeof win.__getReasoningPanels === 'function') {
      return win.__getReasoningPanels();
    }
    return [];
  });
}

// Helper: Count visible reasoning window elements in DOM
async function countVisibleReasoningWindows(page: any): Promise<number> {
  const windows = page.locator('details[role="region"][aria-label*="Reasoning"]');
  return await windows.count();
}

// Helper: Wait for reasoning to start (panel exists with some text)
async function waitForReasoningToStart(page: any, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const panels = await getReasoningPanels(page);
    const hasReasoningText = panels.some(p => p.text && p.text.length > 0);
    if (hasReasoningText) {
      debugInfo(`Reasoning started with ${panels.length} panel(s)`);
      return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('Timeout waiting for reasoning to start');
}

// Helper: Delete a message (uses "Delete this Chat message" button)
async function deleteMessage(page: any, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();
  await item.hover();

  // Try "Delete this Chat message" button first (always available)
  const deleteBtn = item.locator('button[aria-label="Delete this Chat message"]').first();
  await expect(deleteBtn).toBeVisible({ timeout: 5000 });
  await deleteBtn.click();

  // Handle confirmation dialog if present
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
  }

  await page.waitForTimeout(300); // Wait for UI to update
}

// Helper: Delete all messages below a specific index (only works if there are messages below)
async function deleteAllBelowForMessage(page: any, index: number) {
  const items = page.locator('[role="listitem"]');
  const item = items.nth(index);
  await expect(item).toBeVisible();
  await item.hover();

  const deleteAllBtn = item.locator('button[aria-label="Delete all messages below"]').first();
  await expect(deleteAllBtn).toBeVisible({ timeout: 5000 });
  await deleteAllBtn.click();

  // Handle confirmation dialog if present
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /delete|confirm|ok/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
  }

  await page.waitForTimeout(300); // Wait for UI to update
}

// Helper: Clear all reasoning state
async function clearAllReasoning(page: any) {
  await page.evaluate(() => {
    const win = window as any;
    if (typeof win.clearAllReasoning === 'function') {
      win.clearAllReasoning();
    } else {
      // Manually clear localStorage as fallback
      localStorage.removeItem('reasoning_panels');
      localStorage.removeItem('reasoning_windows');
    }
  });
}

test.describe('Orphaned Reasoning Window Bug', () => {
  test.setTimeout(120_000); // Extended timeout for live API

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Anthropic: stopping stream, deleting message, sending new message should show only ONE reasoning window', async ({ page }) => {
    // 1) Setup with Anthropic API
    await bootstrapLiveAPI(page, 'Anthropic');

    // 2) Select Claude model that supports reasoning (sonnet-4, not haiku)
    // Must use specific pattern to avoid matching non-reasoning models
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4|claude-3-7-sonnet/i,
      thinkingEnabled: true,
      closeAfter: true
    });
    debugInfo('Selected Claude reasoning model with thinking enabled');

    // 3) Clear any existing reasoning state
    await clearAllReasoning(page);

    // Verify clean state
    const initialWindows = await getReasoningWindows(page);
    const initialPanels = await getReasoningPanels(page);
    debugInfo(`Initial state: ${initialWindows.length} windows, ${initialPanels.length} panels`);

    // 4) Send message that triggers reasoning
    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');

    await sendMessage(page, 'Explain the Monty Hall problem. Think through it carefully step by step.');
    debugInfo('Sent message to trigger reasoning');

    // 5) Wait for stop button to appear (streaming started)
    await expect(stopIcon).toBeVisible({ timeout: 10000 });
    debugInfo('Stop button visible - streaming started');

    // 6) Wait for reasoning to actually start (text appearing in panel)
    await waitForReasoningToStart(page);

    // Capture state before stopping
    const windowsBeforeStop = await getReasoningWindows(page);
    const panelsBeforeStop = await getReasoningPanels(page);
    debugInfo(`Before stop: ${windowsBeforeStop.length} windows, ${panelsBeforeStop.length} panels`);

    const firstWindowId = windowsBeforeStop[0]?.id;
    const firstPanelText = panelsBeforeStop[0]?.text?.substring(0, 100);
    debugInfo(`First window ID: ${firstWindowId}`);
    debugInfo(`First panel text snippet: ${firstPanelText}`);

    // 7) Click STOP button to abort the stream
    await sendButton.click();
    debugInfo('Clicked stop button');

    // Wait for send button to reappear
    const sendIcon = sendButton.locator('img[alt="Send"]');
    await expect(sendIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Send button reappeared - stream stopped');

    // 8) Check state after stopping
    await page.waitForTimeout(500); // Let state settle
    const windowsAfterStop = await getReasoningWindows(page);
    const panelsAfterStop = await getReasoningPanels(page);
    debugInfo(`After stop: ${windowsAfterStop.length} windows, ${panelsAfterStop.length} panels`);

    // Log panel states
    for (const panel of panelsAfterStop) {
      debugInfo(`Panel ${panel.id}: done=${panel.done}, open=${panel.open}, textLen=${panel.text?.length}`);
    }

    // 9) Get messages and check if we have assistant response
    const messagesBeforeDelete = await getVisibleMessages(page);
    debugInfo(`Messages before delete: ${messagesBeforeDelete.length}`);
    expect(messagesBeforeDelete.length).toBeGreaterThanOrEqual(1);

    // 10) Delete the message - use appropriate method based on what's available
    // If stopped during thinking phase, there may be no assistant message yet
    if (messagesBeforeDelete.length > 1) {
      // We have assistant message - delete all below user message
      debugInfo('Deleting all messages below index 0 (has assistant response)...');
      await deleteAllBelowForMessage(page, 0);
    } else {
      // Only user message - delete it directly
      debugInfo('Deleting user message directly (no assistant response yet)...');
      await deleteMessage(page, 0);
    }

    // 11) Verify deletion worked - wait a moment for UI to settle
    await page.waitForTimeout(500);

    // Count messages directly without waiting for visibility (may be 0)
    const messageItems = page.locator('[role="listitem"]');
    const messageCount = await messageItems.count();
    debugInfo(`Messages after delete: ${messageCount}`);
    // If we deleted all below, user message remains. If we deleted user message, 0 messages remain.
    expect(messageCount).toBeLessThanOrEqual(1);

    // 12) Check reasoning state after deletion
    const windowsAfterDelete = await getReasoningWindows(page);
    const panelsAfterDelete = await getReasoningPanels(page);
    debugInfo(`After delete: ${windowsAfterDelete.length} windows, ${panelsAfterDelete.length} panels`);

    // Log any remaining windows/panels
    if (windowsAfterDelete.length > 0) {
      debugInfo('Remaining windows:', JSON.stringify(windowsAfterDelete, null, 2));
    }
    if (panelsAfterDelete.length > 0) {
      debugInfo('Remaining panels:', JSON.stringify(panelsAfterDelete, null, 2));
    }

    // Verify cleanup - windows and panels should be removed
    // NOTE: This assertion may fail if the bug exists
    expect(windowsAfterDelete.length).toBe(0);
    expect(panelsAfterDelete.length).toBe(0);

    // 13) Count visible reasoning windows in DOM
    const visibleWindowsAfterDelete = await countVisibleReasoningWindows(page);
    debugInfo(`Visible reasoning windows in DOM after delete: ${visibleWindowsAfterDelete}`);
    expect(visibleWindowsAfterDelete).toBe(0);

    // 14) NOW send a NEW message with a prompt that's more likely to trigger reasoning
    debugInfo('Sending new message...');
    await sendMessage(page, 'Explain quantum entanglement to me. Think through the key concepts step by step.');

    // 15) Wait for streaming to start
    await expect(stopIcon).toBeVisible({ timeout: 15000 });
    debugInfo('Stop button visible - new message streaming');

    // 16) Wait a bit for reasoning to potentially start, but don't fail if it doesn't
    // Some models/prompts may not trigger extended thinking
    await page.waitForTimeout(5000);

    // 17) Check how many reasoning windows exist now - THIS IS THE CRITICAL CHECK
    const windowsAfterNewMessage = await getReasoningWindows(page);
    const panelsAfterNewMessage = await getReasoningPanels(page);
    debugInfo(`After new message: ${windowsAfterNewMessage.length} windows, ${panelsAfterNewMessage.length} panels`);

    // Log window details
    for (const win of windowsAfterNewMessage) {
      debugInfo(`Window ${win.id}: convId=${win.convId}, anchorIndex=${win.anchorIndex}`);
    }
    for (const panel of panelsAfterNewMessage) {
      debugInfo(`Panel ${panel.id}: convId=${panel.convId}, responseId=${panel.responseId}`);
    }

    // 18) Count visible reasoning windows in DOM
    const visibleWindowsAfterNewMessage = await countVisibleReasoningWindows(page);
    debugInfo(`Visible reasoning windows in DOM after new message: ${visibleWindowsAfterNewMessage}`);

    // THE BUG: Two windows appeared instead of one (or zero)
    // Expected: At most 1 reasoning window for the new message
    // Actual (bug): 2 reasoning windows - old orphaned one + new one
    // The fix ensures no orphaned windows exist, so we should have 0 or 1
    expect(visibleWindowsAfterNewMessage).toBeLessThanOrEqual(1);
    expect(windowsAfterNewMessage.length).toBeLessThanOrEqual(1);

    // Screenshot for debugging
    await page.screenshot({ path: 'test-results/reasoning-orphan-windows-test.png', fullPage: true });
    debugInfo('Test completed');
  });

  test('OpenAI: stopping stream, deleting message, sending new message should show only ONE reasoning window', async ({ page }) => {
    // Same test but for OpenAI to verify it works there
    await bootstrapLiveAPI(page, 'OpenAI');

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high',
      closeAfter: true
    });
    debugInfo('Selected gpt-5-nano with high reasoning');

    await clearAllReasoning(page);

    const sendButton = page.locator('button[aria-label="Send"]');
    const stopIcon = sendButton.locator('img[alt="Wait"]');
    const sendIcon = sendButton.locator('img[alt="Send"]');

    // Send first message
    await sendMessage(page, 'Explain the Monty Hall problem step by step.');
    debugInfo('Sent message');

    await expect(stopIcon).toBeVisible({ timeout: 10000 });
    await waitForReasoningToStart(page);

    const windowsBeforeStop = await getReasoningWindows(page);
    debugInfo(`Before stop: ${windowsBeforeStop.length} windows`);

    // Stop the stream
    await sendButton.click();
    await expect(sendIcon).toBeVisible({ timeout: 5000 });
    debugInfo('Stopped stream');

    // Delete messages
    await page.waitForTimeout(500);
    await deleteAllBelowForMessage(page, 0);

    const windowsAfterDelete = await getReasoningWindows(page);
    debugInfo(`After delete: ${windowsAfterDelete.length} windows`);
    expect(windowsAfterDelete.length).toBe(0);

    // Send new message
    await sendMessage(page, 'What is 2+2?');
    await expect(stopIcon).toBeVisible({ timeout: 10000 });
    await waitForReasoningToStart(page);

    // Check for orphaned windows
    const windowsAfterNewMessage = await getReasoningWindows(page);
    const visibleWindows = await countVisibleReasoningWindows(page);
    debugInfo(`After new message: ${windowsAfterNewMessage.length} windows, ${visibleWindows} visible`);

    expect(visibleWindows).toBe(1);
    expect(windowsAfterNewMessage.length).toBe(1);
  });
});
