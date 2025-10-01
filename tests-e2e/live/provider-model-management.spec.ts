import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  bootstrapBothProviders,
  getVisibleModels,
  getModelDropdownState,
  operateQuickSettings,
  setProviderApiKey,
  withSettings,
  sendMessage,
  waitForAssistantDone,
  getVisibleMessages
} from './helpers';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Skip all tests if no API keys available
test.describe.configure({ mode: 'serial' });

(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Provider Model Management - User Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('user can access models when single provider is configured', async ({ page }) => {
    // Test single provider configuration from user perspective
    await bootstrapLiveAPI(page, 'OpenAI');

    // User action: Check available models via QuickSettings
    const models = await getVisibleModels(page);

    // User expectation: Models should be available from configured provider
    expect(models.length).toBeGreaterThan(0);

    // User expectation: Should see OpenAI models (but not need to know about implementation)
    const hasRelevantModels = models.some(m =>
      /gpt|chatgpt|davinci/i.test(m) // User recognizes these as OpenAI models
    );
    expect(hasRelevantModels).toBe(true);

    // User expectation: Should not see provider disambiguation when only one provider active
    const hasProviderLabels = models.some(m => m.includes('(OpenAI)') || m.includes('(Anthropic)'));
    expect(hasProviderLabels).toBe(false);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('user can access models from multiple providers', async ({ page }) => {
    // Test multi-provider scenario from user perspective
    await bootstrapBothProviders(page);

    // User action: Check available models via QuickSettings
    const models = await getVisibleModels(page);

    // User expectation: Should have models from both providers
    expect(models.length).toBeGreaterThan(0);

    const hasOpenAIModels = models.some(m => /gpt|chatgpt/i.test(m));
    const hasAnthropicModels = models.some(m => /claude/i.test(m));

    expect(hasOpenAIModels).toBe(true);
    expect(hasAnthropicModels).toBe(true);

    // User expectation: Should be able to distinguish providers somehow
    // (Don't test specific implementation like optgroups - just that distinction exists)
    await operateQuickSettings(page, { mode: 'ensure-open' });
    const modelSelect = page.locator('#current-model-select');
    await expect(modelSelect).toBeVisible();

    // Verify that some form of provider organization is present
    // This could be optgroups, labels, or other UI organization
    const selectHtml = await modelSelect.innerHTML();
    const hasOrganization = selectHtml.includes('OpenAI') || selectHtml.includes('Anthropic') ||
                           selectHtml.includes('optgroup') || selectHtml.includes('---');
    expect(hasOrganization).toBe(true);
  });

  test('user can select and use models for conversation', async ({ page }) => {
    // Test actual model usage from user perspective
    await bootstrapLiveAPI(page, 'OpenAI');

    // User action: Select a specific model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-3\.5-turbo/i,  // User selects a chat model
      closeAfter: true
    });

    // User action: Send a message
    await sendMessage(page, 'Hello, this is a test message');

    // User expectation: Should get response from selected model
    await waitForAssistantDone(page);

    const messages = await getVisibleMessages(page);
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    expect(assistantMessages.length).toBeGreaterThan(0);
    expect(assistantMessages[0].text.length).toBeGreaterThan(0);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('user can switch between providers dynamically', async ({ page }) => {
    // Start with single provider first
    await bootstrapLiveAPI(page, 'OpenAI');

    // Get initial state with only OpenAI
    const initialState = await getModelDropdownState(page);
    expect(initialState.hasAnyModels).toBe(true);
    expect(initialState.providers.openai).toBeDefined();
    expect(initialState.providers.anthropic).toBeUndefined();
    expect(initialState.hasMultipleProviders).toBe(false);

    const initialCount = initialState.totalModels;

    // Clear existing state and set up both providers fresh
    // (This avoids conflicts from the previous single-provider setup)
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Now set up both providers from clean state
    await bootstrapBothProviders(page);

    // Get state after adding both providers
    const updatedState = await getModelDropdownState(page, {
      waitForModels: true
    });

    // User expectation: Both providers should now be present
    expect(updatedState.providers.openai).toBeDefined();
    expect(updatedState.providers.anthropic).toBeDefined();
    expect(updatedState.hasMultipleProviders).toBe(true);

    // Verify models from both providers are available
    expect(updatedState.providers.openai!.models.length).toBeGreaterThan(0);
    expect(updatedState.providers.anthropic!.models.length).toBeGreaterThan(0);

    // User expectation: Can see models from both providers in the dropdown
    const openaiModels = updatedState.allModels.filter(m => m.provider === 'openai');
    const anthropicModels = updatedState.allModels.filter(m => m.provider === 'anthropic');
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(anthropicModels.length).toBeGreaterThan(0);

    // Total models should be more than before (includes both providers)
    expect(updatedState.totalModels).toBeGreaterThan(initialCount);
  });

  test('user sees appropriate feedback when no providers configured', async ({ page }) => {
    // User starts with no API keys configured

    // User action: Try to access models
    await operateQuickSettings(page, { mode: 'ensure-open' });

    const modelSelect = page.locator('#current-model-select');
    await expect(modelSelect).toBeVisible();

    // User expectation: Should see helpful message about no models
    const options = await modelSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(0);

    const firstOptionText = await options[0].textContent();
    const isEmptyState = firstOptionText && (
      firstOptionText.includes('Select') ||
      firstOptionText.includes('No models') ||
      firstOptionText.includes('Configure')
    );
    expect(isEmptyState).toBe(true);
  });

  test('user experience remains consistent when provider keys are invalid', async ({ page }) => {
    // Test graceful handling of invalid API keys from user perspective

    // User action: Configure invalid API key
    await withSettings(page, async () => {
      const providerSelect = page.locator('#provider-selection');
      await expect(providerSelect).toBeVisible();
      await providerSelect.selectOption('OpenAI');

      const apiInput = page.locator('#api-key');
      await expect(apiInput).toBeVisible();
      await apiInput.fill('invalid-key-123');

      const checkBtn = page.getByRole('button', { name: /check api/i });
      await expect(checkBtn).toBeVisible();
      await checkBtn.click();

      // Wait for error state to be processed
      await page.waitForTimeout(2000);
    });

    // User expectation: Should still be able to access interface without crashes
    await operateQuickSettings(page, { mode: 'ensure-open' });
    const modelSelect = page.locator('#current-model-select');
    await expect(modelSelect).toBeVisible();

    // User expectation: Should see empty/error state rather than broken UI
    const models = await getVisibleModels(page);
    // Either no models or placeholder text, but no JavaScript errors
    expect(Array.isArray(models)).toBe(true);
  });

  (test as any)[hasAnthropicKey ? 'test' : 'skip']('user can switch between different model types', async ({ page }) => {
    // Test switching between different model capabilities
    await bootstrapBothProviders(page);

    // User action: Select OpenAI model first
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-3\.5-turbo/i,
      closeAfter: true
    });

    // Send test message
    await sendMessage(page, 'Test with OpenAI');
    await waitForAssistantDone(page);

    let messages = await getVisibleMessages(page);
    const openAIResponse = messages.filter(m => m.role === 'assistant')[0];
    expect(openAIResponse).toBeDefined();

    // User action: Switch to Anthropic model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude/i,
      closeAfter: true
    });

    // Send another test message
    await sendMessage(page, 'Test with Anthropic');
    // Use waitForStreamComplete for provider-agnostic waiting
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra stabilization for Anthropic

    messages = await getVisibleMessages(page);
    const anthropicResponse = messages.filter(m => m.role === 'assistant')[1];
    expect(anthropicResponse).toBeDefined();

    // User expectation: Both responses should exist and be different
    expect(openAIResponse.text).not.toBe(anthropicResponse.text);
    expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
  });

  test('user model selection persists across UI operations', async ({ page }) => {
    // Test that user's model choice is remembered
    await bootstrapLiveAPI(page, 'OpenAI');

    // User action: Select specific model
    const targetModel = /gpt-3\.5-turbo/i;
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: targetModel
    });

    // Get current selection
    const modelSelect = page.locator('#current-model-select');
    const selectedValue = await modelSelect.inputValue();

    // User action: Close and reopen QuickSettings
    await operateQuickSettings(page, { mode: 'ensure-closed' });
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // User expectation: Selection should persist
    const newSelectedValue = await modelSelect.inputValue();
    expect(newSelectedValue).toBe(selectedValue);

    // User action: Navigate to settings and back
    await page.keyboard.press('Escape'); // Close QuickSettings
    await page.getByRole('button', { name: /settings/i }).first().click();
    await page.getByRole('button', { name: /save/i }).click();

    // User expectation: Model selection still persists
    await operateQuickSettings(page, { mode: 'ensure-open' });
    const finalSelectedValue = await modelSelect.inputValue();
    expect(finalSelectedValue).toBe(selectedValue);
  });
});