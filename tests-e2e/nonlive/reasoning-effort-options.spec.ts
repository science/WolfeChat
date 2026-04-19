/**
 * Migrated from tests-e2e/live/reasoning-effort-options.spec.ts
 *
 * Tests reasoning effort dropdown options by model type.
 * No API calls needed — purely tests client-side dropdown logic.
 *
 * Model categories:
 * - LEGACY (gpt-5-nano): Shows "minimal", hides "none"
 * - MODERN (gpt-5.1): Shows "none", hides "minimal"
 */

import { test, expect } from '@playwright/test';
import { seedAppState } from './mock-helpers';
import { operateQuickSettings, openSettings, selectModelInSettings } from '../live/helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

// ==================== LEGACY MODEL (gpt-5-nano) ====================

test('gpt-5-nano shows "minimal" option, hides "none" in Quick Settings', async ({ page }) => {
  await seedAppState(page, { selectedModel: 'gpt-5-nano' });
  await page.goto('/');
  {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await page.locator('#app').count() > 0) break;
      await page.waitForTimeout(200);
    }
  }

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i });

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5-nano options: ${options.join(', ')}`);

  expect(options).toContain('minimal');
  expect(options).not.toContain('none');
  expect(options).toContain('low');
  expect(options).toContain('medium');
  expect(options).toContain('high');

  await reasoningSelect.selectOption('minimal');
  await expect(reasoningSelect).toHaveValue('minimal');

  debugInfo('✓ gpt-5-nano correctly shows "minimal", hides "none"');
});

test('gpt-5-nano shows "minimal" option, hides "none" in Settings', async ({ page }) => {
  await seedAppState(page, { selectedModel: 'gpt-5-nano' });
  await page.goto('/');
  {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await page.locator('#app').count() > 0) break;
      await page.waitForTimeout(200);
    }
  }

  await openSettings(page);
  await selectModelInSettings(page, /gpt-5-nano/i);
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const options = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5-nano Settings options: ${options.join(', ')}`);

  expect(options).toContain('minimal');
  expect(options).not.toContain('none');

  await settingsReasoningSelect.selectOption('minimal');
  await expect(settingsReasoningSelect).toHaveValue('minimal');

  debugInfo('✓ gpt-5-nano correctly shows "minimal" in Settings');
});

// ==================== MODERN MODEL (gpt-5.1) ====================

test('gpt-5.1 shows "none" option, hides "minimal" in Quick Settings', async ({ page }) => {
  await seedAppState(page, { selectedModel: 'gpt-5.1' });
  await page.goto('/');
  {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await page.locator('#app').count() > 0) break;
      await page.waitForTimeout(200);
    }
  }

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.1/i });

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5.1 options: ${options.join(', ')}`);

  expect(options).toContain('none');
  expect(options).not.toContain('minimal');
  expect(options).toContain('low');
  expect(options).toContain('medium');
  expect(options).toContain('high');

  await reasoningSelect.selectOption('none');
  await expect(reasoningSelect).toHaveValue('none');

  // Close and reopen to verify persistence
  const toggle = page.locator('button[aria-controls="quick-settings-body"]');
  await toggle.click({ force: true });
  await page.waitForTimeout(100);
  await toggle.click({ force: true });
  await page.waitForTimeout(100);
  await expect(reasoningSelect).toHaveValue('none');

  debugInfo('✓ gpt-5.1 correctly shows "none", hides "minimal", selection persists');
});

test('gpt-5.1 shows "none" option, hides "minimal" in Settings', async ({ page }) => {
  await seedAppState(page, { selectedModel: 'gpt-5.1' });
  await page.goto('/');
  {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await page.locator('#app').count() > 0) break;
      await page.waitForTimeout(200);
    }
  }

  await openSettings(page);
  await selectModelInSettings(page, /gpt-5\.1/i);
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const options = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`gpt-5.1 Settings options: ${options.join(', ')}`);

  expect(options).toContain('none');
  expect(options).not.toContain('minimal');

  await settingsReasoningSelect.selectOption('none');
  await expect(settingsReasoningSelect).toHaveValue('none');

  // Save and reopen to verify persistence
  const saveButton = page.getByRole('button', { name: /save/i });
  await saveButton.click({ force: true });
  await page.waitForTimeout(200);

  await openSettings(page);
  await expect(settingsReasoningSelect).toHaveValue('none');

  debugInfo('✓ gpt-5.1 correctly shows "none" in Settings, selection persists');
});
