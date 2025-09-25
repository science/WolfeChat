import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, bootstrapBothProviders, withSettingsOpen, openSettings, mockOpenAIAPI } from './live/helpers';

test.describe('Provider Dropdown Organization Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('dropdown should have separate sections for OpenAI and Anthropic when both keys are set', async ({ page }) => {
    // Set both API keys
    await bootstrapBothProviders(page);

    // Open Settings using helper (prevents race conditions)
    await openSettings(page);
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have provider sections when both keys are present
    expect(optgroupLabels).toContain('OpenAI');
    expect(optgroupLabels).toContain('Anthropic');

    // Should NOT have generic "All models" section
    expect(optgroupLabels).not.toContain('All models');

    // "Recently used" only appears if there are recent models (not in fresh tests)
    console.log('Optgroup labels found:', optgroupLabels);

    // Verify OpenAI models are in OpenAI section
    const openAIModels = await page.locator('#model-selection optgroup[label="OpenAI"] option').evaluateAll(
      elements => elements.map(el => el.textContent)
    );

    // OpenAI models should not have provider indicators when in their own section
    for (const model of openAIModels) {
      expect(model).not.toContain('(OpenAI)');
      expect(model).not.toContain('(Anthropic)');
    }

    // Verify Anthropic models are in Anthropic section
    const anthropicModels = await page.locator('#model-selection optgroup[label="Anthropic"] option').evaluateAll(
      elements => elements.map(el => el.textContent)
    );

    // Anthropic models should not have provider indicators when in their own section
    for (const model of anthropicModels) {
      expect(model).not.toContain('(OpenAI)');
      expect(model).not.toContain('(Anthropic)');
      expect(model).toMatch(/^claude-/); // Anthropic models start with claude-
    }
  });

  test('dropdown should only show OpenAI section when only OpenAI key is set', async ({ page }) => {
    // Set only OpenAI key
    await bootstrapLiveAPI(page, 'OpenAI');

    // Open Settings using helper (prevents race conditions)
    await openSettings(page);
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have OpenAI section only (recently used appears only if there are recent models)
    expect(optgroupLabels).toContain('OpenAI');

    // Should NOT have Anthropic section or generic "All models"
    expect(optgroupLabels).not.toContain('Anthropic');
    expect(optgroupLabels).not.toContain('All models');

    console.log('OpenAI only - Optgroup labels found:', optgroupLabels);
  });

  test('dropdown should only show Anthropic section when only Anthropic key is set', async ({ page }) => {
    // Set only Anthropic key
    await bootstrapLiveAPI(page, 'Anthropic');

    // Open Settings using helper (prevents race conditions)
    await openSettings(page);
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have Anthropic section only (recently used appears only if there are recent models)
    expect(optgroupLabels).toContain('Anthropic');

    // Should NOT have OpenAI section or generic "All models"
    expect(optgroupLabels).not.toContain('OpenAI');
    expect(optgroupLabels).not.toContain('All models');

    console.log('Anthropic only - Optgroup labels found:', optgroupLabels);
  });

  test('models should be alphabetically sorted within each provider section', async ({ page }) => {
    // ADD API key checks first
    // Set both API keys - use correct function
    await bootstrapBothProviders(page);

    // Open Settings using helper
    await openSettings(page);
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Check OpenAI models are sorted
    const openAIModels = await page.locator('#model-selection optgroup[label="OpenAI"] option').evaluateAll(
      elements => elements.map(el => el.value)
    );

    const sortedOpenAI = [...openAIModels].sort();
    expect(openAIModels).toEqual(sortedOpenAI);

    // Check Anthropic models are sorted
    const anthropicModels = await page.locator('#model-selection optgroup[label="Anthropic"] option').evaluateAll(
      elements => elements.map(el => el.value)
    );

    const sortedAnthropic = [...anthropicModels].sort();
    expect(anthropicModels).toEqual(sortedAnthropic);
  });
});

test.describe('Model Indicator Display Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API to prevent 401 errors
    await mockOpenAIAPI(page);
    await page.goto('http://localhost:5173/');
  });

  test('should display model indicator for Claude responses', async ({ page }) => {
    // NOTE: This test uses live Anthropic API
    await bootstrapLiveAPI(page, 'Anthropic');

    // TODO: Implement Claude model indicator test
    // Send message using Claude model and verify indicator appears
  });

  test('should display model indicator for OpenAI responses', async ({ page }) => {
    // NOTE: This test uses live OpenAI API
    await bootstrapLiveAPI(page, 'OpenAI');

    // TODO: Implement OpenAI model indicator test
    // Send message using OpenAI model and verify indicator appears
  });
});