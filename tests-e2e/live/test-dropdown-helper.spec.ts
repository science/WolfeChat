import { test, expect } from '@playwright/test';
import {
  getModelDropdownState,
  checkApiKeysFromState,
  bootstrapLiveAPI,
  setProviderApiKey,
  operateQuickSettings
} from './helpers';

test.describe('Model Dropdown Helper Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    // Start with clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Additional wait to ensure stores are fully reset
    await page.waitForTimeout(500);
  });

  test('helper correctly identifies empty dropdown state', async ({ page }) => {
    const state = await getModelDropdownState(page);

    expect(state.hasAnyModels).toBe(false);
    expect(state.totalModels).toBe(0);
    expect(state.providers).toEqual({});
    expect(state.hasMultipleProviders).toBe(false);
    expect(state.location).toBe('quickSettings');
    expect(state.dropdownId).toBe('current-model-select');
  });

  test('helper detects single provider models', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const state = await getModelDropdownState(page, {
      waitForModels: true
    });

    expect(state.hasAnyModels).toBe(true);
    expect(state.providers.openai).toBeDefined();
    expect(state.providers.openai!.models.length).toBeGreaterThan(0);
    expect(state.hasMultipleProviders).toBe(false);
    expect(state.totalModels).toBeGreaterThan(0);

    // With single provider, optgroups might not be used
    expect(state.isProperlyOrganized).toBe(true);
  });

  test('helper detects multiple providers with optgroups', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');
    await setProviderApiKey(page, 'Anthropic', process.env.ANTHROPIC_API_KEY!);

    const state = await getModelDropdownState(page, {
      waitForModels: true
    });

    expect(state.hasMultipleProviders).toBe(true);
    expect(state.providers.openai).toBeDefined();
    expect(state.providers.anthropic).toBeDefined();
    expect(state.providers.openai!.models.length).toBeGreaterThan(0);
    expect(state.providers.anthropic!.models.length).toBeGreaterThan(0);

    // Multiple providers are considered properly organized (optgroups or flat list)
    expect(state.isProperlyOrganized).toBe(true);

    // Total should be sum of both providers
    const expectedTotal = state.providers.openai!.models.length +
                         state.providers.anthropic!.models.length;
    expect(state.totalModels).toBe(expectedTotal);

    // Should have models from both providers
    const openaiModels = state.allModels.filter(m => m.provider === 'openai');
    const anthropicModels = state.allModels.filter(m => m.provider === 'anthropic');
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(anthropicModels.length).toBeGreaterThan(0);
  });

  test('helper correctly identifies selected model and provider', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    // Select a specific model
    await operateQuickSettings(page, {
      model: /gpt-3\.5-turbo/i
    });

    const state = await getModelDropdownState(page);

    expect(state.selectedModel).toContain('gpt-3.5-turbo');
    expect(state.selectedModelProvider).toBe('openai');
  });

  test('helper works with Settings dropdown', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const quickState = await getModelDropdownState(page, {
      location: 'quickSettings'
    });

    const settingsState = await getModelDropdownState(page, {
      location: 'settings',
      closeAfter: true,
      waitForModels: true
    });

    // Both should have same models (or close to it)
    expect(settingsState.totalModels).toBeGreaterThan(0);
    expect(settingsState.dropdownId).toBe('model-selection');
    expect(quickState.dropdownId).toBe('current-model-select');

    // Should have similar provider structure
    if (quickState.providers.openai) {
      expect(settingsState.providers.openai).toBeDefined();
    }
  });

  test('checkApiKeysFromState utility works correctly', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const state1 = await getModelDropdownState(page);
    const keys1 = checkApiKeysFromState(state1);

    expect(keys1.openaiKeySet).toBe(true);
    expect(keys1.anthropicKeySet).toBe(false);
    expect(keys1.bothKeysSet).toBe(false);

    await setProviderApiKey(page, 'Anthropic', process.env.ANTHROPIC_API_KEY!);

    const state2 = await getModelDropdownState(page, {
      waitForModels: true
    });
    const keys2 = checkApiKeysFromState(state2);

    expect(keys2.openaiKeySet).toBe(true);
    expect(keys2.anthropicKeySet).toBe(true);
    expect(keys2.bothKeysSet).toBe(true);
  });

  test('helper handles captureHtml option for debugging', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const state = await getModelDropdownState(page, {
      captureHtml: true,
      waitForModels: true
    });

    expect(state.rawHtml).toBeDefined();
    expect(typeof state.rawHtml).toBe('string');
    expect(state.rawHtml!.length).toBeGreaterThan(0);

    // Should contain option elements
    expect(state.rawHtml).toContain('<option');
  });

  test('helper detectProvider function works correctly', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const state = await getModelDropdownState(page, {
      waitForModels: true
    });

    // Check that OpenAI models are correctly detected
    if (state.providers.openai) {
      for (const model of state.providers.openai.models) {
        expect(model.provider).toBe('openai');
        // Don't require specific patterns since model names can vary
        // Just verify the provider detection is consistent
      }
    }

    // Test specific known model patterns
    const openAIModels = state.allModels.filter(m => m.provider === 'openai');
    const anthropicModels = state.allModels.filter(m => m.provider === 'anthropic');

    // Should have some OpenAI models
    expect(openAIModels.length).toBeGreaterThan(0);

    // Check some specific patterns we know should be OpenAI
    const gptModels = state.allModels.filter(m => m.id.toLowerCase().includes('gpt'));
    gptModels.forEach(model => {
      expect(model.provider).toBe('openai');
    });
  });

  test('helper closeAfter option works correctly', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    // QuickSettings should be closed initially
    const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');
    const initialExpanded = await quickSettingsButton.getAttribute('aria-expanded');
    expect(initialExpanded).toBe('false');

    // Use helper with closeAfter: false
    await getModelDropdownState(page, {
      closeAfter: false,
      waitForModels: true
    });

    // QuickSettings should still be open
    const afterExpanded = await quickSettingsButton.getAttribute('aria-expanded');
    expect(afterExpanded).toBe('true');

    // Use helper with closeAfter: true
    await getModelDropdownState(page, {
      closeAfter: true
    });

    // QuickSettings should be closed
    const finalExpanded = await quickSettingsButton.getAttribute('aria-expanded');
    expect(finalExpanded).toBe('false');
  });

  test('helper handles allModels flat array correctly', async ({ page }) => {
    await bootstrapLiveAPI(page, 'OpenAI');

    const state = await getModelDropdownState(page, {
      waitForModels: true
    });

    // allModels should contain all models from all providers
    expect(state.allModels.length).toBe(state.totalModels);
    expect(state.allModels.length).toBeGreaterThan(0);

    // Each model should have required properties
    for (const model of state.allModels) {
      expect(model.id).toBeDefined();
      expect(model.displayText).toBeDefined();
      expect(model.value).toBeDefined();
      expect(model.provider).toBeDefined();
      expect(['openai', 'anthropic', 'unknown']).toContain(model.provider);
    }
  });
});