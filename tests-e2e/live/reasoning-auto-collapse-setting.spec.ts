/**
 * E2E tests for the reasoning auto-collapse setting
 *
 * This setting controls whether reasoning windows automatically collapse
 * when the model finishes its response.
 */

import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  openSettings,
  saveAndCloseSettings,
  operateQuickSettings,
  sendMessage,
  waitForAssistantDone
} from './helpers';

// Robust reasoning window locator (matches multiple selector patterns)
function reasoningRegion(page: import('@playwright/test').Page) {
  const byRole = page.getByRole('region', { name: /reasoning/i });
  const byAria = page.locator('details[role="region"][aria-label="Reasoning"]');
  const bySummaryParent = page.locator('summary', { hasText: 'Reasoning' }).locator('..');
  const byText = page.locator('details:has-text("Reasoning")');
  let combined = byRole.or(byAria);
  combined = combined.or(bySummaryParent);
  combined = combined.or(byText);
  return combined;
}
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(60_000);

test.describe('Reasoning Auto-Collapse Setting', () => {
  test.beforeEach(async ({ page }) => {
    const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') {
          debugInfo(`[BROWSER-${msg.type()}] ${t}`);
        }
      });
      page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
    }
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('Settings: checkbox appears when reasoning model is selected and defaults to checked', async ({ page }) => {
    await bootstrapLiveAPI(page);

    // Open Settings and select a reasoning model
    await openSettings(page);

    const modelSelect = page.locator('#model-selection');
    await expect(modelSelect).toBeVisible();

    // Select a reasoning model (gpt-5-nano is a reasoning model)
    // Use value instead of label since selectOption doesn't support regex for labels
    const modelOptions = await modelSelect.locator('option').allTextContents();
    const gpt5NanoOption = modelOptions.find(opt => /gpt-5-nano/i.test(opt));
    if (!gpt5NanoOption) throw new Error('gpt-5-nano not found in model options');
    await modelSelect.selectOption(gpt5NanoOption);

    // Wait for reasoning settings section to appear
    await page.waitForTimeout(300);

    // Find the auto-collapse checkbox
    const autoCollapseCheckbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeVisible({ timeout: 5000 });

    // Default should be checked (true = auto-collapse enabled)
    await expect(autoCollapseCheckbox).toBeChecked();

    await saveAndCloseSettings(page);
  });

  test('Settings: checkbox is not visible when non-reasoning model is selected', async ({ page }) => {
    await bootstrapLiveAPI(page);

    await openSettings(page);

    const modelSelect = page.locator('#model-selection');
    await expect(modelSelect).toBeVisible();

    // Select a non-reasoning model (gpt-3.5-turbo)
    const modelOptions = await modelSelect.locator('option').allTextContents();
    const gpt35Option = modelOptions.find(opt => /gpt-3\.5-turbo/i.test(opt));
    if (!gpt35Option) throw new Error('gpt-3.5-turbo not found in model options');
    await modelSelect.selectOption(gpt35Option);

    await page.waitForTimeout(300);

    // Auto-collapse checkbox should NOT be visible for non-reasoning models
    const autoCollapseCheckbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeHidden();

    await saveAndCloseSettings(page);
  });

  test('Settings: checkbox state persists across page reloads', async ({ page }) => {
    await bootstrapLiveAPI(page);

    // Open Settings and select a reasoning model
    await openSettings(page);

    const modelSelect = page.locator('#model-selection');
    const modelOptions = await modelSelect.locator('option').allTextContents();
    const gpt5NanoOption = modelOptions.find(opt => /gpt-5-nano/i.test(opt));
    if (!gpt5NanoOption) throw new Error('gpt-5-nano not found in model options');
    await modelSelect.selectOption(gpt5NanoOption);
    await page.waitForTimeout(300);

    // Find and uncheck the auto-collapse checkbox
    const autoCollapseCheckbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeVisible();
    await expect(autoCollapseCheckbox).toBeChecked(); // Default is checked

    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();

    await saveAndCloseSettings(page);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Re-open Settings
    await openSettings(page);

    // Select a reasoning model again to see the checkbox
    const modelSelect2 = page.locator('#model-selection');
    const modelOptions2 = await modelSelect2.locator('option').allTextContents();
    const gpt5NanoOption2 = modelOptions2.find(opt => /gpt-5-nano/i.test(opt));
    if (!gpt5NanoOption2) throw new Error('gpt-5-nano not found in model options after reload');
    await modelSelect2.selectOption(gpt5NanoOption2);
    await page.waitForTimeout(300);

    // Verify the checkbox state persisted (unchecked)
    const autoCollapseCheckbox2 = page.locator('#settings-reasoning-auto-collapse');
    await expect(autoCollapseCheckbox2).toBeVisible();
    await expect(autoCollapseCheckbox2).not.toBeChecked();

    await saveAndCloseSettings(page);
  });

  test('Quick Settings: checkbox appears for reasoning models and syncs with Settings', async ({ page }) => {
    await bootstrapLiveAPI(page);

    // Select a reasoning model via Quick Settings
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i
    });

    // Find the auto-collapse checkbox in Quick Settings
    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeVisible({ timeout: 5000 });

    // Default should be checked (true = auto-collapse enabled)
    await expect(autoCollapseCheckbox).toBeChecked();

    // Uncheck it
    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();

    // Close Quick Settings
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    // Open Settings and verify the value synced
    await openSettings(page);

    const settingsModelSelect = page.locator('#model-selection');
    const settingsModelOptions = await settingsModelSelect.locator('option').allTextContents();
    const settingsGpt5Nano = settingsModelOptions.find(opt => /gpt-5-nano/i.test(opt));
    if (!settingsGpt5Nano) throw new Error('gpt-5-nano not found in Settings model options');
    await settingsModelSelect.selectOption(settingsGpt5Nano);
    await page.waitForTimeout(300);

    const settingsCheckbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(settingsCheckbox).toBeVisible();
    await expect(settingsCheckbox).not.toBeChecked(); // Should be unchecked (synced)

    await saveAndCloseSettings(page);
  });

  // ===== BEHAVIOR TESTS =====

  test('OpenAI: with auto-collapse enabled (default), reasoning window closes when response completes', async ({ page }) => {
    test.setTimeout(120000);

    await bootstrapLiveAPI(page);

    // Select gpt-5-nano with settings that reliably produce reasoning events
    // Reasoning effort "high" + complex prompt ensures reasoning window appears
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high',
      verbosity: 'low',
      summary: 'auto'
    });

    // Verify auto-collapse is checked (default)
    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    debugInfo('Sending message to trigger reasoning...');
    // Use a prompt that requires logical reasoning to reliably trigger reasoning events
    await sendMessage(page, 'Explain the Monty Hall 3 door problem using logic and clear detail.');

    // Wait for reasoning window to appear using robust locator
    const reasoningWindow = reasoningRegion(page);
    await expect(reasoningWindow).toBeVisible({ timeout: 30000 });
    debugInfo('Reasoning window appeared');

    // Verify window is initially open
    const isOpenInitially = await reasoningWindow.getAttribute('open');
    expect(isOpenInitially).not.toBeNull();
    debugInfo('Reasoning window is initially open');

    // Wait for assistant response to complete
    await waitForAssistantDone(page, { timeout: 90_000 });
    debugInfo('Assistant response completed');

    // Give a small buffer for the auto-close to trigger
    await page.waitForTimeout(1000);

    // ASSERTION: Reasoning window should be collapsed (auto-closed)
    const isOpenAfterComplete = await reasoningWindow.getAttribute('open');
    expect(isOpenAfterComplete).toBeNull();
    debugInfo('Reasoning window auto-collapsed as expected');
  });

  test('OpenAI: with auto-collapse disabled, reasoning window stays open when response completes', async ({ page }) => {
    test.setTimeout(120000);

    await bootstrapLiveAPI(page);

    // Select gpt-5-nano with settings that reliably produce reasoning events
    // Reasoning effort "high" + complex prompt ensures reasoning window appears
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'high',
      verbosity: 'low',
      summary: 'auto'
    });

    // Disable auto-collapse
    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked(); // Default is checked
    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    debugInfo('Sending message to trigger reasoning (auto-collapse disabled)...');
    // Use a prompt that requires logical reasoning to reliably trigger reasoning events
    await sendMessage(page, 'Explain the Monty Hall 3 door problem using logic and clear detail.');

    // Wait for reasoning window to appear using robust locator
    const reasoningWindow = reasoningRegion(page);
    await expect(reasoningWindow).toBeVisible({ timeout: 30000 });
    debugInfo('Reasoning window appeared');

    // Verify window is initially open
    const isOpenInitially = await reasoningWindow.getAttribute('open');
    expect(isOpenInitially).not.toBeNull();
    debugInfo('Reasoning window is initially open');

    // Wait for assistant response to complete
    await waitForAssistantDone(page, { timeout: 90_000 });
    debugInfo('Assistant response completed');

    // Give time for auto-close to trigger (if it would)
    await page.waitForTimeout(1000);

    // ASSERTION: Reasoning window should STILL be open (auto-collapse disabled)
    const isOpenAfterComplete = await reasoningWindow.getAttribute('open');
    expect(isOpenAfterComplete).not.toBeNull();
    debugInfo('Reasoning window stayed open as expected');
  });

  test('Anthropic: with auto-collapse enabled (default), reasoning window closes when response completes', async ({ page }) => {
    test.setTimeout(120000);

    await bootstrapLiveAPI(page, 'Anthropic');

    // Select a Claude reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i
    });

    // Verify auto-collapse is checked (default)
    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    debugInfo('Sending message to trigger Anthropic reasoning...');
    await sendMessage(page, 'What is 1+1? Think step by step.');

    // Wait for reasoning window to appear using robust locator
    const reasoningWindow = reasoningRegion(page);
    await expect(reasoningWindow).toBeVisible({ timeout: 30000 });
    debugInfo('Anthropic reasoning window appeared');

    // Verify window is initially open
    const isOpenInitially = await reasoningWindow.getAttribute('open');
    expect(isOpenInitially).not.toBeNull();
    debugInfo('Reasoning window is initially open');

    // Wait for assistant response to complete
    await waitForAssistantDone(page, { timeout: 90_000 });
    debugInfo('Anthropic assistant response completed');

    // Give a small buffer for the auto-close to trigger
    await page.waitForTimeout(1000);

    // ASSERTION: Reasoning window should be collapsed (auto-closed)
    const isOpenAfterComplete = await reasoningWindow.getAttribute('open');
    expect(isOpenAfterComplete).toBeNull();
    debugInfo('Anthropic reasoning window auto-collapsed as expected');
  });

  test('Anthropic: with auto-collapse disabled, reasoning window stays open when response completes', async ({ page }) => {
    test.setTimeout(120000);

    await bootstrapLiveAPI(page, 'Anthropic');

    // Select a Claude reasoning model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i
    });

    // Disable auto-collapse
    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked(); // Default is checked
    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    debugInfo('Sending message to trigger Anthropic reasoning (auto-collapse disabled)...');
    await sendMessage(page, 'What is 2+2? Think step by step.');

    // Wait for reasoning window to appear using robust locator
    const reasoningWindow = reasoningRegion(page);
    await expect(reasoningWindow).toBeVisible({ timeout: 30000 });
    debugInfo('Anthropic reasoning window appeared');

    // Verify window is initially open
    const isOpenInitially = await reasoningWindow.getAttribute('open');
    expect(isOpenInitially).not.toBeNull();
    debugInfo('Reasoning window is initially open');

    // Wait for assistant response to complete
    await waitForAssistantDone(page, { timeout: 90_000 });
    debugInfo('Anthropic assistant response completed');

    // Give time for auto-close to trigger (if it would)
    await page.waitForTimeout(1000);

    // ASSERTION: Reasoning window should STILL be open (auto-collapse disabled)
    const isOpenAfterComplete = await reasoningWindow.getAttribute('open');
    expect(isOpenAfterComplete).not.toBeNull();
    debugInfo('Anthropic reasoning window stayed open as expected');
  });
});
