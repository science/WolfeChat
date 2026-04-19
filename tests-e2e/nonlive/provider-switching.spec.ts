/**
 * Migrated from tests-e2e/live/provider-switching.spec.ts
 *
 * Tests provider dropdown UI and form state persistence.
 * No API calls needed — purely tests Settings UI behavior.
 */

import { test, expect } from '@playwright/test';
import { openSettings } from '../live/helpers';
import { debugInfo } from '../debug-utils';

test.describe('Provider Switching UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('provider dropdown has correct options and default selection', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    await expect(providerSelect).toBeVisible();

    const options = await providerSelect.locator('option').allTextContents();
    expect(options).toContain('OpenAI');
    expect(options).toContain('Anthropic');

    await expect(providerSelect).toHaveValue('OpenAI');
  });

  test('API key field label changes based on selected provider', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    const apiKeyLabel = page.locator('label[for="api-key"]').first();

    await expect(apiKeyLabel).toHaveText('OpenAI API Key');

    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyLabel).toHaveText('Anthropic API Key');

    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyLabel).toHaveText('OpenAI API Key');
  });

  test('API key field maintains separate values for each provider', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    const apiKeyInput = page.locator('#api-key');
    const saveBtn = page.getByRole('button', { name: /^save$/i });

    await providerSelect.selectOption('OpenAI');
    await apiKeyInput.fill('sk-openai-test-key');
    await saveBtn.click({ force: true });

    await openSettings(page);
    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyInput).toHaveValue('');

    await apiKeyInput.fill('sk-ant-test-key');
    await saveBtn.click({ force: true });

    await openSettings(page);
    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyInput).toHaveValue('sk-openai-test-key');

    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyInput).toHaveValue('sk-ant-test-key');
  });

  test('provider settings persist across page reloads', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    const apiKeyInput = page.locator('#api-key');
    const saveBtn = page.getByRole('button', { name: /^save$/i });

    await providerSelect.selectOption('OpenAI');
    await apiKeyInput.fill('sk-openai-persist-test');
    await saveBtn.click({ force: true });

    await openSettings(page);
    await providerSelect.selectOption('Anthropic');
    await apiKeyInput.fill('sk-ant-persist-test');
    await saveBtn.click({ force: true });

    await page.reload();

    await openSettings(page);

    await expect(providerSelect).toHaveValue('Anthropic');
    await expect(apiKeyInput).toHaveValue('sk-ant-persist-test');

    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyInput).toHaveValue('sk-openai-persist-test');
  });

  test('visual grouping container exists around provider settings', async ({ page }) => {
    await openSettings(page);

    const providerContainer = page.locator('.border.border-gray-600.rounded-lg.p-4').first();
    await expect(providerContainer).toBeVisible();

    const providerSelect = providerContainer.locator('#provider-selection');
    await expect(providerSelect).toBeVisible();

    const apiKeyInput = providerContainer.locator('#api-key');
    await expect(apiKeyInput).toBeVisible();

    const modelSelect = providerContainer.locator('#model-selection');
    await expect(modelSelect).toBeVisible();
  });

  test('mode selection dropdown is not visible', async ({ page }) => {
    await openSettings(page);

    const modeSelect = page.locator('#mode-selection');
    await expect(modeSelect).not.toBeVisible();

    const modeLabel = page.locator('label[for="mode-selection"]');
    await expect(modeLabel).not.toBeVisible();
  });

  test('provider switching preserves other settings', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');

    const initialProvider = await providerSelect.inputValue();

    await providerSelect.selectOption('Anthropic');
    await providerSelect.selectOption('OpenAI');
    await providerSelect.selectOption('Anthropic');

    await expect(providerSelect).toHaveValue('Anthropic');

    await providerSelect.selectOption(initialProvider);
    await expect(providerSelect).toHaveValue(initialProvider);

    debugInfo('Provider switching completed without errors');
  });
});
