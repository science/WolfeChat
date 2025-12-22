/**
 * E2E Test: Reasoning Effort Options by Model Type
 *
 * Consolidated tests for reasoning effort options. Uses cheap models (gpt-5-nano)
 * where possible, with minimal gpt-5.1 usage only where required.
 *
 * Model categories:
 * - LEGACY (gpt-5-nano): Shows "minimal", hides "none"
 * - MODERN (gpt-5.1): Shows "none", hides "minimal"
 *
 * NOTE: Unit tests cover gpt-5.2, gpt-6, gpt-7 behavior - no E2E tests needed for those.
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, openSettings, selectModelInSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

// ==================== LEGACY MODEL (gpt-5-nano) - CHEAP ====================

test('Live: gpt-5-nano shows "minimal" option, hides "none" in Quick Settings', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await bootstrapLiveAPI(page);

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i });

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5-nano options: ${options.join(', ')}`);

  // Legacy model: has "minimal", no "none"
  expect(options).toContain('minimal');
  expect(options).not.toContain('none');
  expect(options).toContain('low');
  expect(options).toContain('medium');
  expect(options).toContain('high');

  // Verify minimal can be selected
  await reasoningSelect.selectOption('minimal');
  await expect(reasoningSelect).toHaveValue('minimal');

  debugInfo('✓ gpt-5-nano correctly shows "minimal", hides "none"');
});

test('Live: gpt-5-nano shows "minimal" option, hides "none" in Settings', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await bootstrapLiveAPI(page);

  await openSettings(page);
  await selectModelInSettings(page, /gpt-5-nano/i);
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const options = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5-nano Settings options: ${options.join(', ')}`);

  expect(options).toContain('minimal');
  expect(options).not.toContain('none');

  // Verify minimal can be selected
  await settingsReasoningSelect.selectOption('minimal');
  await expect(settingsReasoningSelect).toHaveValue('minimal');

  debugInfo('✓ gpt-5-nano correctly shows "minimal" in Settings');
});

// ==================== MODERN MODEL (gpt-5.1) - MORE EXPENSIVE ====================
// Only one test per location to minimize API costs

test('Live: gpt-5.1 shows "none" option, hides "minimal" in Quick Settings', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await bootstrapLiveAPI(page);

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.1/i });

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5.1 options: ${options.join(', ')}`);

  // Modern model: has "none", no "minimal"
  expect(options).toContain('none');
  expect(options).not.toContain('minimal');
  expect(options).toContain('low');
  expect(options).toContain('medium');
  expect(options).toContain('high');

  // Verify none can be selected and persists
  await reasoningSelect.selectOption('none');
  await expect(reasoningSelect).toHaveValue('none');

  // Close and reopen to verify persistence
  const toggle = page.locator('button[aria-controls="quick-settings-body"]');
  await toggle.click();
  await page.waitForTimeout(100);
  await toggle.click();
  await page.waitForTimeout(100);
  await expect(reasoningSelect).toHaveValue('none');

  debugInfo('✓ gpt-5.1 correctly shows "none", hides "minimal", selection persists');
});

test('Live: gpt-5.1 shows "none" option, hides "minimal" in Settings', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await bootstrapLiveAPI(page);

  await openSettings(page);
  await selectModelInSettings(page, /gpt-5\.1/i);
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const options = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5.1 Settings options: ${options.join(', ')}`);

  expect(options).toContain('none');
  expect(options).not.toContain('minimal');

  // Verify none can be selected
  await settingsReasoningSelect.selectOption('none');
  await expect(settingsReasoningSelect).toHaveValue('none');

  // Save and reopen to verify persistence
  const saveButton = page.getByRole('button', { name: /save/i });
  await saveButton.click();
  await page.waitForTimeout(200);

  await openSettings(page);
  await expect(settingsReasoningSelect).toHaveValue('none');

  debugInfo('✓ gpt-5.1 correctly shows "none" in Settings, selection persists');
});

// NOTE: Per-conversation persistence test removed to minimize gpt-5.1 API costs.
// The persistence behavior is already tested above (close/reopen Quick Settings).
// Unit tests provide comprehensive coverage of the underlying logic.
