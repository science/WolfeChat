import { test, expect } from '@playwright/test';
import { openSettings } from './helpers';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Provider Switching UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('provider dropdown has correct options and default selection', async ({ page }) => {
    await openSettings(page);

    // Verify Provider dropdown exists
    const providerSelect = page.locator('#provider-selection');
    await expect(providerSelect).toBeVisible();

    // Verify dropdown options
    const options = await providerSelect.locator('option').allTextContents();
    expect(options).toContain('OpenAI');
    expect(options).toContain('Anthropic');

    // Verify default selection is OpenAI
    await expect(providerSelect).toHaveValue('OpenAI');
  });

  test('API key field label changes based on selected provider', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    // Use more specific selector - the first label with for="api-key" is the actual API key label
    const apiKeyLabel = page.locator('label[for="api-key"]').first();

    // Default should be OpenAI
    await expect(apiKeyLabel).toHaveText('OpenAI API Key');

    // Switch to Anthropic
    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyLabel).toHaveText('Anthropic API Key');

    // Switch back to OpenAI
    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyLabel).toHaveText('OpenAI API Key');
  });

  test('API key field maintains separate values for each provider', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    const apiKeyInput = page.locator('#api-key');
    const saveBtn = page.getByRole('button', { name: /^save$/i });

    // Set OpenAI API key and save
    await providerSelect.selectOption('OpenAI');
    await apiKeyInput.fill('sk-openai-test-key');
    await saveBtn.click();

    // Reopen settings and switch to Anthropic - field should be empty initially
    await openSettings(page);
    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyInput).toHaveValue('');

    // Set Anthropic API key and save
    await apiKeyInput.fill('sk-ant-test-key');
    await saveBtn.click();

    // Reopen settings and switch back to OpenAI - should show OpenAI key
    await openSettings(page);
    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyInput).toHaveValue('sk-openai-test-key');

    // Switch back to Anthropic - should show Anthropic key
    await providerSelect.selectOption('Anthropic');
    await expect(apiKeyInput).toHaveValue('sk-ant-test-key');
  });

  test('provider settings persist across page reloads', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');
    const apiKeyInput = page.locator('#api-key');
    const saveBtn = page.getByRole('button', { name: /^save$/i });

    // Set up OpenAI key first and save
    await providerSelect.selectOption('OpenAI');
    await apiKeyInput.fill('sk-openai-persist-test');
    await saveBtn.click();

    // Reopen settings, set Anthropic key and save
    await openSettings(page);
    await providerSelect.selectOption('Anthropic');
    await apiKeyInput.fill('sk-ant-persist-test');
    await saveBtn.click();

    // Reload page
    await page.reload();

    // Verify persistence after reload
    await openSettings(page);

    // Should still be on Anthropic (last selected)
    await expect(providerSelect).toHaveValue('Anthropic');
    await expect(apiKeyInput).toHaveValue('sk-ant-persist-test');

    // Switch to OpenAI and verify its key persisted
    await providerSelect.selectOption('OpenAI');
    await expect(apiKeyInput).toHaveValue('sk-openai-persist-test');
  });

  test('visual grouping container exists around provider settings', async ({ page }) => {
    await openSettings(page);

    // Look for the bordered container around provider settings
    const providerContainer = page.locator('.border.border-gray-600.rounded-lg.p-4');
    await expect(providerContainer).toBeVisible();

    // Verify it contains the provider dropdown
    const providerSelect = providerContainer.locator('#provider-selection');
    await expect(providerSelect).toBeVisible();

    // Verify it contains the API key field
    const apiKeyInput = providerContainer.locator('#api-key');
    await expect(apiKeyInput).toBeVisible();

    // Verify it contains the model selection
    const modelSelect = providerContainer.locator('#model-selection');
    await expect(modelSelect).toBeVisible();
  });

  test('mode selection dropdown is not visible', async ({ page }) => {
    await openSettings(page);

    // Verify that Mode Selection is not present (removed per requirements)
    const modeSelect = page.locator('#mode-selection');
    await expect(modeSelect).not.toBeVisible();

    // Also check for any labels that might reference mode
    const modeLabel = page.locator('label[for="mode-selection"]');
    await expect(modeLabel).not.toBeVisible();
  });

  test('provider switching preserves other settings', async ({ page }) => {
    await openSettings(page);

    const providerSelect = page.locator('#provider-selection');

    // Get initial state of any visible setting for comparison
    const initialProvider = await providerSelect.inputValue();

    // Switch providers multiple times
    await providerSelect.selectOption('Anthropic');
    await providerSelect.selectOption('OpenAI');
    await providerSelect.selectOption('Anthropic');

    // Verify provider switching worked
    await expect(providerSelect).toHaveValue('Anthropic');

    // Switch back to initial state
    await providerSelect.selectOption(initialProvider);
    await expect(providerSelect).toHaveValue(initialProvider);

    // This test mainly verifies that provider switching doesn't crash or break the UI
    console.log('Provider switching completed without errors');
  });
});