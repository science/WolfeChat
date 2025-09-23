import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI } from './live/helpers';

test.describe('Provider Dropdown Organization Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('dropdown should have separate sections for OpenAI and Anthropic when both keys are set', async ({ page }) => {
    // Set both API keys
    await bootstrapLiveAPI(page, {
      openaiKey: process.env.OPENAI_API_KEY,
      anthropicKey: process.env.ANTHROPIC_API_KEY
    });

    // Open Settings
    await page.click('button[title="Settings"]');
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have exactly these sections when both keys are present
    expect(optgroupLabels).toContain('Recently used');
    expect(optgroupLabels).toContain('OpenAI');
    expect(optgroupLabels).toContain('Anthropic');

    // Should NOT have generic "All models" section
    expect(optgroupLabels).not.toContain('All models');

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
    await bootstrapLiveAPI(page, {
      openaiKey: process.env.OPENAI_API_KEY
    });

    // Open Settings
    await page.click('button[title="Settings"]');
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have Recently used and OpenAI sections only
    expect(optgroupLabels).toContain('Recently used');
    expect(optgroupLabels).toContain('OpenAI');

    // Should NOT have Anthropic section or generic "All models"
    expect(optgroupLabels).not.toContain('Anthropic');
    expect(optgroupLabels).not.toContain('All models');
  });

  test('dropdown should only show Anthropic section when only Anthropic key is set', async ({ page }) => {
    // Set only Anthropic key
    await bootstrapLiveAPI(page, {
      anthropicKey: process.env.ANTHROPIC_API_KEY
    });

    // Open Settings
    await page.click('button[title="Settings"]');
    await page.waitForSelector('#model-selection', { state: 'visible' });

    // Get all optgroup labels
    const optgroupLabels = await page.locator('#model-selection optgroup').evaluateAll(
      elements => elements.map(el => el.label)
    );

    // Should have Recently used and Anthropic sections only
    expect(optgroupLabels).toContain('Recently used');
    expect(optgroupLabels).toContain('Anthropic');

    // Should NOT have OpenAI section or generic "All models"
    expect(optgroupLabels).not.toContain('OpenAI');
    expect(optgroupLabels).not.toContain('All models');
  });

  test('models should be alphabetically sorted within each provider section', async ({ page }) => {
    // Set both API keys
    await bootstrapLiveAPI(page, {
      openaiKey: process.env.OPENAI_API_KEY,
      anthropicKey: process.env.ANTHROPIC_API_KEY
    });

    // Open Settings
    await page.click('button[title="Settings"]');
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
    await page.goto('http://localhost:5173/');
  });

  test('should display model indicator for Claude responses', async ({ page }) => {
    // Set up Anthropic API
    await bootstrapLiveAPI(page, {
      anthropicKey: process.env.ANTHROPIC_API_KEY
    });

    // Select a Claude model
    await page.click('button[title="Settings"]');
    await page.selectOption('#model-selection', 'claude-3-haiku-20240307'); // Fixed typo
    await page.click('button:has-text("Save & Close")');

    // Send a message
    const inputField = page.locator('textarea[placeholder="Type your message..."]');
    await inputField.fill('Hello');
    await inputField.press('Enter');

    // Wait for response
    await page.waitForTimeout(3000); // Wait for response

    // Check that model indicator is displayed
    const responseHeader = await page.locator('text=/AI Response \\(claude-3-haiku-20240307\\)/').first();
    await expect(responseHeader).toBeVisible();
  });

  test('should display model indicator for OpenAI responses', async ({ page }) => {
    // Set up OpenAI API
    await bootstrapLiveAPI(page, {
      openaiKey: process.env.OPENAI_API_KEY
    });

    // Select an OpenAI model
    await page.click('button[title="Settings"]');
    await page.selectOption('#model-selection', 'gpt-3.5-turbo');
    await page.click('button:has-text("Save & Close")');

    // Send a message
    const inputField = page.locator('textarea[placeholder="Type your message..."]');
    await inputField.fill('Hello');
    await inputField.press('Enter');

    // Wait for response
    await page.waitForTimeout(3000); // Wait for response

    // Check that model indicator is displayed
    const responseHeader = await page.locator('text=/AI Response \\(gpt-3.5-turbo\\)/').first();
    await expect(responseHeader).toBeVisible();
  });
});