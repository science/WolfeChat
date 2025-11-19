/**
 * E2E Test: Reasoning "none" Option
 *
 * Tests that the "none" reasoning effort option appears in both Settings and Quick Settings
 * and that it can be selected and persists correctly
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, openSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

test('Live: reasoning "none" option appears in Quick Settings and can be selected', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }
  if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  await bootstrapLiveAPI(page);

  // Select a reasoning model (gpt-5-nano)
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i });

  // Open Quick Settings to access reasoning controls
  const quickSettings = page.locator('.w-full').first();
  const quickSettingsButton = quickSettings.locator('button[aria-controls="quick-settings-body"]');
  await expect(quickSettingsButton).toBeVisible();

  // Ensure it's open
  const isOpen = await quickSettingsButton.getAttribute('aria-expanded');
  if (isOpen !== 'true') {
    await quickSettingsButton.click();
    await page.waitForTimeout(100);
  }

  // Find the reasoning effort dropdown
  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  // Verify "none" option exists
  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`Reasoning options: ${options.join(', ')}`);

  if (!options.includes('none')) {
    throw new Error('Expected "none" option to be present in reasoning dropdown');
  }

  // Select "none"
  await reasoningSelect.selectOption('none');
  await page.waitForTimeout(100);

  // Verify it was selected
  await expect(reasoningSelect).toHaveValue('none');

  // Close Quick Settings
  await quickSettingsButton.click();
  await page.waitForTimeout(100);

  // Reopen and verify it persists
  await quickSettingsButton.click();
  await page.waitForTimeout(100);
  await expect(reasoningSelect).toHaveValue('none');

  debugInfo('✓ Reasoning "none" option appears and can be selected in Quick Settings');
});

test('Live: reasoning "none" option appears in Settings and can be selected', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }
  if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  await bootstrapLiveAPI(page);

  // Open Settings
  await openSettings(page);

  // Select a reasoning model (gpt-5-nano) in Settings
  const modelSelect = page.locator('#model-selection');
  await expect(modelSelect).toBeVisible();

  // Find gpt-5-nano in the options
  await modelSelect.selectOption({ label: /gpt-5-nano/i });
  await page.waitForTimeout(200);

  // The reasoning controls should now be visible
  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  // Verify "none" option exists
  const settingsOptions = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`Settings reasoning options: ${settingsOptions.join(', ')}`);

  if (!settingsOptions.includes('none')) {
    throw new Error('Expected "none" option to be present in Settings reasoning dropdown');
  }

  // Select "none"
  await settingsReasoningSelect.selectOption('none');
  await page.waitForTimeout(100);

  // Verify it was selected
  await expect(settingsReasoningSelect).toHaveValue('none');

  // Close Settings (click Save or just close)
  const saveButton = page.getByRole('button', { name: /save/i });
  await saveButton.click();
  await page.waitForTimeout(200);

  // Reopen Settings and verify it persists
  await openSettings(page);
  await expect(settingsReasoningSelect).toHaveValue('none');

  debugInfo('✓ Reasoning "none" option appears and persists in Settings');
});

test('Live: reasoning "none" persists per-conversation in Quick Settings', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }
  if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  await bootstrapLiveAPI(page);

  // Set conversation 1 to use "none"
  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /gpt-5-nano/i,
    reasoningEffort: 'none',
    closeAfter: true
  });

  // Create a new conversation
  const sidebar = page.locator('nav').first();
  const newConvBtn = sidebar.getByRole('button', { name: /^new conversation$/i });
  await expect(newConvBtn).toBeVisible();
  await newConvBtn.click();
  await page.waitForTimeout(200);

  // Set conversation 2 to use "high"
  await operateQuickSettings(page, {
    mode: 'ensure-open',
    model: /gpt-5-nano/i,
    reasoningEffort: 'high',
    closeAfter: true
  });

  // Switch back to conversation 1
  const rows = page.locator('.conversation.title-container');
  await rows.nth(1).click();
  await page.waitForTimeout(200);

  // Verify reasoning is still "none"
  await operateQuickSettings(page, { mode: 'ensure-open' });
  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toHaveValue('none');

  // Switch to conversation 2
  await rows.nth(0).click();
  await page.waitForTimeout(200);

  // Verify reasoning is "high"
  await operateQuickSettings(page, { mode: 'ensure-open' });
  await expect(reasoningSelect).toHaveValue('high');

  debugInfo('✓ Reasoning "none" persists per-conversation');
});
