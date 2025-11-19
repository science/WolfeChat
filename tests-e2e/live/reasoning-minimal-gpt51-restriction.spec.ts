/**
 * E2E Test: Reasoning "minimal" Option Restriction for GPT-5.1
 *
 * Tests that the "minimal" reasoning effort option is hidden for gpt-5.1 models
 * but visible for other reasoning models like gpt-5, o4, etc.
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, openSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

test('Live: minimal option hidden for gpt-5.1 in Quick Settings', async ({ page }) => {
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

  // Select gpt-5.1
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
  debugInfo(`GPT-5.1 reasoning options: ${options.join(', ')}`);

  if (options.includes('minimal')) {
    throw new Error('Expected "minimal" option to NOT be present for gpt-5.1');
  }

  // Verify other options are present
  if (!options.includes('none')) {
    throw new Error('Expected "none" option to be present for gpt-5.1');
  }
  if (!options.includes('low')) {
    throw new Error('Expected "low" option to be present for gpt-5.1');
  }
  if (!options.includes('medium')) {
    throw new Error('Expected "medium" option to be present for gpt-5.1');
  }
  if (!options.includes('high')) {
    throw new Error('Expected "high" option to be present for gpt-5.1');
  }

  debugInfo('✓ "minimal" option correctly hidden for gpt-5.1 in Quick Settings');
});

test('Live: minimal option visible for gpt-5-nano in Quick Settings', async ({ page }) => {
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

  // Select a non-5.1 reasoning model (gpt-5-nano)
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
  debugInfo(`GPT-5-nano reasoning options: ${options.join(', ')}`);

  if (!options.includes('minimal')) {
    throw new Error('Expected "minimal" option to be present for gpt-5-nano');
  }

  // Can select minimal
  await reasoningSelect.selectOption('minimal');
  await page.waitForTimeout(100);
  await expect(reasoningSelect).toHaveValue('minimal');

  debugInfo('✓ "minimal" option correctly visible for gpt-5-nano in Quick Settings');
});

test('Live: minimal option hidden for gpt-5.1 in Settings', async ({ page }) => {
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

  // Select gpt-5.1
  await modelSelect.selectOption({ label: /gpt-5\.1/i });
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const settingsOptions = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5.1 Settings reasoning options: ${settingsOptions.join(', ')}`);

  if (settingsOptions.includes('minimal')) {
    throw new Error('Expected "minimal" option to NOT be present for gpt-5.1 in Settings');
  }

  // Verify other options are present
  if (!settingsOptions.includes('none')) {
    throw new Error('Expected "none" option to be present for gpt-5.1 in Settings');
  }
  if (!settingsOptions.includes('low')) {
    throw new Error('Expected "low" option to be present for gpt-5.1 in Settings');
  }

  debugInfo('✓ "minimal" option correctly hidden for gpt-5.1 in Settings');
});

test('Live: minimal option visible for gpt-5-nano in Settings', async ({ page }) => {
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

  // Select gpt-5-nano
  await modelSelect.selectOption({ label: /gpt-5-nano/i });
  await page.waitForTimeout(200);

  const settingsReasoningSelect = page.locator('#settings-reasoning-effort');
  await expect(settingsReasoningSelect).toBeVisible();

  const settingsOptions = await settingsReasoningSelect.locator('option').allTextContents();
  debugInfo(`GPT-5-nano Settings reasoning options: ${settingsOptions.join(', ')}`);

  if (!settingsOptions.includes('minimal')) {
    throw new Error('Expected "minimal" option to be present for gpt-5-nano in Settings');
  }

  // Can select minimal
  await settingsReasoningSelect.selectOption('minimal');
  await page.waitForTimeout(100);
  await expect(settingsReasoningSelect).toHaveValue('minimal');

  debugInfo('✓ "minimal" option correctly visible for gpt-5-nano in Settings');
});
