/**
 * E2E Test: Reasoning "none" Option Should Only Appear for GPT-5.1
 *
 * Tests that the "none" reasoning effort option is only shown for gpt-5.1 models,
 * not for older reasoning models like gpt-5, gpt-5-nano, o3, o4, etc.
 *
 * This test follows TDD principles - it describes the DESIRED behavior.
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, openSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

test('Live: "none" option should NOT appear for gpt-5-nano in Quick Settings', async ({ page }) => {
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

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i });

  const quickSettings = page.locator('.w-full').first();
  const quickSettingsButton = quickSettings.locator('button[aria-controls="quick-settings-body"]');
  await expect(quickSettingsButton).toBeVisible();

  const isOpen = await quickSettingsButton.getAttribute('aria-expanded');
  if (isOpen !== 'true') {
    await quickSettingsButton.click();
    await page.waitForTimeout(100);
  }

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5-nano reasoning options in Quick Settings: ${options.join(', ')}`);

  if (options.includes('none')) {
    throw new Error('Expected "none" option to NOT be present for gpt-5-nano (old reasoning models should not have "none" option)');
  }

  if (!options.includes('minimal')) {
    throw new Error('Expected "minimal" option to be present for gpt-5-nano');
  }

  if (!options.includes('low') || !options.includes('medium') || !options.includes('high')) {
    throw new Error('Expected "low", "medium", and "high" options to be present');
  }

  debugInfo('✓ "none" option correctly hidden for gpt-5-nano in Quick Settings');
});

test('Live: "none" option SHOULD appear for gpt-5.1 in Quick Settings', async ({ page }) => {
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

  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5\.1/i });

  const quickSettings = page.locator('.w-full').first();
  const quickSettingsButton = quickSettings.locator('button[aria-controls="quick-settings-body"]');
  await expect(quickSettingsButton).toBeVisible();

  const isOpen = await quickSettingsButton.getAttribute('aria-expanded');
  if (isOpen !== 'true') {
    await quickSettingsButton.click();
    await page.waitForTimeout(100);
  }

  const reasoningSelect = page.locator('#reasoning-effort');
  await expect(reasoningSelect).toBeVisible();

  const options = await reasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5.1 reasoning options in Quick Settings: ${options.join(', ')}`);

  if (!options.includes('none')) {
    throw new Error('Expected "none" option to be present for gpt-5.1');
  }

  if (options.includes('minimal')) {
    throw new Error('Expected "minimal" option to NOT be present for gpt-5.1 (gpt-5.1 does not support "minimal")');
  }

  if (!options.includes('low') || !options.includes('medium') || !options.includes('high')) {
    throw new Error('Expected "low", "medium", and "high" options to be present');
  }

  debugInfo('✓ "none" option correctly shown for gpt-5.1 in Quick Settings');
});

test('Live: "none" option should NOT appear for gpt-5-nano in Settings', async ({ page }) => {
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

  await openSettings(page);

  const modelSelect = page.locator('#model-selection');
  await expect(modelSelect).toBeVisible();

  await modelSelect.selectOption({ label: /gpt-5-nano/i });
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const settingsOptions = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5-nano Settings reasoning options: ${settingsOptions.join(', ')}`);

  if (settingsOptions.includes('none')) {
    throw new Error('Expected "none" option to NOT be present for gpt-5-nano in Settings (old reasoning models should not have "none" option)');
  }

  if (!settingsOptions.includes('minimal')) {
    throw new Error('Expected "minimal" option to be present for gpt-5-nano in Settings');
  }

  if (!settingsOptions.includes('low') || !settingsOptions.includes('medium') || !settingsOptions.includes('high')) {
    throw new Error('Expected "low", "medium", and "high" options to be present');
  }

  debugInfo('✓ "none" option correctly hidden for gpt-5-nano in Settings');
});

test('Live: "none" option SHOULD appear for gpt-5.1 in Settings', async ({ page }) => {
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

  await openSettings(page);

  const modelSelect = page.locator('#model-selection');
  await expect(modelSelect).toBeVisible();

  await modelSelect.selectOption({ label: /gpt-5\.1/i });
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const settingsOptions = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5.1 Settings reasoning options: ${settingsOptions.join(', ')}`);

  if (!settingsOptions.includes('none')) {
    throw new Error('Expected "none" option to be present for gpt-5.1 in Settings');
  }

  if (settingsOptions.includes('minimal')) {
    throw new Error('Expected "minimal" option to NOT be present for gpt-5.1 in Settings (gpt-5.1 does not support "minimal")');
  }

  if (!settingsOptions.includes('low') || !settingsOptions.includes('medium') || !settingsOptions.includes('high')) {
    throw new Error('Expected "low", "medium", and "high" options to be present');
  }

  debugInfo('✓ "none" option correctly shown for gpt-5.1 in Settings');
});
