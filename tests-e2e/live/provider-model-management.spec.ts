import { test, expect } from '@playwright/test';
import {
  openSettings,
  setProviderApiKey,
  bootstrapBothProviders,
  getVisibleModels,
  verifyProviderIndicators,
  openSettingsAndSelectProvider,
  fillApiKeyAndWaitForModels,
  saveAndCloseSettings,
  getSettingsModels
} from './helpers';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;


(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Provider Model Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('shows only OpenAI models when only OpenAI key is set', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    const models = await getVisibleModels(page);

    // Should have GPT models
    expect(models.length).toBeGreaterThan(0);

    // All models should be GPT models (no Claude models)
    const hasGptModels = models.some(m => m.toLowerCase().includes('gpt'));
    const hasClaudeModels = models.some(m => m.toLowerCase().includes('claude'));

    expect(hasGptModels).toBe(true);
    expect(hasClaudeModels).toBe(false);

    // When only one provider, no provider indicators should be shown
    const hasProviderIndicators = models.some(m => m.includes('(') && m.includes(')'));
    expect(hasProviderIndicators).toBe(false);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('shows only Anthropic models when only Anthropic key is set', async ({ page }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY!;

    await setProviderApiKey(page, 'Anthropic', anthropicKey);

    const models = await getVisibleModels(page);

    // Should have Claude models
    expect(models.length).toBeGreaterThan(0);

    // All models should be Claude models (no GPT models)
    const hasClaudeModels = models.some(m => m.toLowerCase().includes('claude'));
    const hasGptModels = models.some(m => m.toLowerCase().includes('gpt'));

    expect(hasClaudeModels).toBe(true);
    expect(hasGptModels).toBe(false);

    // When only one provider, no provider indicators should be shown
    const hasProviderIndicators = models.some(m => m.includes('(') && m.includes(')'));
    expect(hasProviderIndicators).toBe(false);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('shows combined model list with provider organization when both keys are set', async ({ page }) => {
    // Use the helper that properly handles both providers
    await bootstrapBothProviders(page);

    // Open QuickSettings to check the model organization
    const quickSettingsButton = page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();
    await page.waitForTimeout(500);

    const modelSelect = page.locator('#current-model-select');
    await modelSelect.waitFor({ timeout: 5000 });

    // Should have both GPT and Claude models available
    const models = await getVisibleModels(page);
    expect(models.length).toBeGreaterThan(0);

    const hasGptModels = models.some(m => m.toLowerCase().includes('gpt'));
    const hasClaudeModels = models.some(m => m.toLowerCase().includes('claude'));

    expect(hasGptModels).toBe(true);
    expect(hasClaudeModels).toBe(true);

    // When both providers are configured, should have optgroups for organization
    const openAIOptgroup = modelSelect.locator('optgroup[label="OpenAI"]');
    const anthropicOptgroup = modelSelect.locator('optgroup[label="Anthropic"]');

    await expect(openAIOptgroup).toBeVisible();
    await expect(anthropicOptgroup).toBeVisible();

    // Verify that models appear in correct optgroups
    const openAIOptions = await openAIOptgroup.locator('option').count();
    const anthropicOptions = await anthropicOptgroup.locator('option').count();

    expect(openAIOptions).toBeGreaterThan(0);
    expect(anthropicOptions).toBeGreaterThan(0);
  });

  test('model selection persists when switching providers', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    // Use atomic helpers for granular control - keep Settings open during operations
    await openSettingsAndSelectProvider(page, 'OpenAI');
    await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');

    // Select a specific model while Settings is open
    const modelSelect = page.locator('#model-selection');
    const firstOption = await modelSelect.locator('option').nth(1).textContent();
    if (firstOption) {
      await modelSelect.selectOption({ label: firstOption });

      // Verify selection
      await expect(modelSelect).toHaveValue(firstOption.replace(/\s*\(.*\)$/, ''));

      // Switch provider without closing Settings
      const providerSelect = page.locator('#provider-selection');
      await providerSelect.selectOption('Anthropic');
      await providerSelect.selectOption('OpenAI');

      // Model selection should be preserved
      await expect(modelSelect).toHaveValue(firstOption.replace(/\s*\(.*\)$/, ''));
    }

    // Finally close Settings
    await saveAndCloseSettings(page);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('models are sorted by date (newest first)', async ({ page }) => {
    // Use the helper that properly handles both providers
    await bootstrapBothProviders(page);

    // Re-open settings to check the model list
    await openSettings(page);
    const models = await getVisibleModels(page);

    // Check that Claude 4 models (newest) appear before Claude 3 models
    const claude4Index = models.findIndex(m => m.includes('claude-4'));
    const claude3Index = models.findIndex(m => m.includes('claude-3'));

    if (claude4Index >= 0 && claude3Index >= 0) {
      expect(claude4Index).toBeLessThan(claude3Index);
    }

    // Check that newer GPT models appear before older ones
    const gpt4Index = models.findIndex(m => m.includes('gpt-4'));
    const gpt35Index = models.findIndex(m => m.includes('gpt-3.5'));

    if (gpt4Index >= 0 && gpt35Index >= 0) {
      expect(gpt4Index).toBeLessThan(gpt35Index);
    }
  });

  test('model list updates when API keys are added/removed', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    // Start with Settings open and set OpenAI
    await openSettingsAndSelectProvider(page, 'OpenAI');
    await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');

    // Get models while Settings is open
    let models = await getSettingsModels(page);
    const initialModelCount = models.length;
    const hasClaudeInitially = models.some(m => m.toLowerCase().includes('claude'));
    expect(hasClaudeInitially).toBe(false);

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Switch to Anthropic without closing Settings
      const providerSelect = page.locator('#provider-selection');
      await providerSelect.selectOption('Anthropic');
      await fillApiKeyAndWaitForModels(page, anthropicKey, 'Anthropic');

      models = await getSettingsModels(page);

      // Should now have more models (GPT + Claude)
      expect(models.length).toBeGreaterThan(initialModelCount);

      const hasClaudeAfterAdd = models.some(m => m.toLowerCase().includes('claude'));
      expect(hasClaudeAfterAdd).toBe(true);

      // Clear Anthropic key
      const apiKeyInput = page.locator('#api-key');
      await apiKeyInput.fill('');

      // Switch back to OpenAI
      await providerSelect.selectOption('OpenAI');

      models = await getSettingsModels(page);

      // Should be back to original count (only GPT models)
      const hasClaudeAfterRemove = models.some(m => m.toLowerCase().includes('claude'));
      expect(hasClaudeAfterRemove).toBe(false);
    }

    // Finally close Settings
    await saveAndCloseSettings(page);
  });

  test('empty state shows appropriate message', async ({ page }) => {
    await openSettings(page);

    // Model select should show default option when no API key
    const modelSelect = page.locator('#model-selection');
    const firstOption = await modelSelect.locator('option').first().textContent();

    // Could be either "Select a model..." or "No models available" depending on implementation
    expect(firstOption === 'Select a model...' || firstOption === 'No models available').toBe(true);

    // Should only have the default option
    const optionCount = await modelSelect.locator('option').count();
    expect(optionCount).toBe(1);
  });
});