/**
 * Debug E2E Test: Model Data Flow Verification (Live API)
 *
 * This test verifies that models are properly loaded and displayed
 * using real API integration instead of complex mocking.
 */

import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, openSettings } from './helpers';

test.describe('Debug Model Data Flow', () => {
  test('should verify model data flows correctly with live API', async ({ page }) => {
    if (!process.env.OPENAI_API_KEY) {
      test.skip(true, 'Requires OPENAI_API_KEY environment variable');
      return;
    }

    // Enable console logging to see debug output
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    console.log('=== STEP 1: Bootstrap with live API ===');
    await page.goto('/');

    // Use real API to populate models
    await bootstrapLiveAPI(page, 'OpenAI');

    console.log('=== STEP 2: Verify models in Settings ===');
    await openSettings(page);

    // Check that models are properly loaded in Settings
    const settingsModelCount = await page.evaluate(() => {
      const select = document.querySelector('#model-selection') as HTMLSelectElement;
      return select ? select.options.length : 0;
    });

    console.log(`Found ${settingsModelCount} models in Settings dropdown`);
    expect(settingsModelCount).toBeGreaterThan(1); // Should have real models

    // Close Settings
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);

    console.log('=== STEP 3: Verify models in Quick Settings ===');

    // Open Quick Settings
    await page.click('button[aria-controls="quick-settings-body"]');
    await page.waitForSelector('#current-model-select', { state: 'visible' });

    const qsModelCount = await page.evaluate(() => {
      const select = document.querySelector('#current-model-select') as HTMLSelectElement;
      return select ? select.options.length : 0;
    });

    console.log(`Found ${qsModelCount} models in Quick Settings`);
    expect(qsModelCount).toBeGreaterThan(1);

    // Get list of available models
    const models = await page.evaluate(() => {
      const select = document.querySelector('#current-model-select') as HTMLSelectElement;
      if (!select) return [];
      return Array.from(select.options).map(opt => opt.value).filter(v => v);
    });

    console.log('Available models:', models);

    // Verify we have expected model types
    const hasGptModel = models.some(m => m.includes('gpt'));
    expect(hasGptModel).toBe(true);

    console.log('✅ Model data flow verification complete');
  });

  test('should handle model selection in Quick Settings', async ({ page }) => {
    if (!process.env.OPENAI_API_KEY) {
      test.skip(true, 'Requires OPENAI_API_KEY environment variable');
      return;
    }

    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Open Quick Settings
    await page.click('button[aria-controls="quick-settings-body"]');
    await page.waitForSelector('#current-model-select', { state: 'visible' });

    // Get first available model
    const firstModel = await page.evaluate(() => {
      const select = document.querySelector('#current-model-select') as HTMLSelectElement;
      if (!select || select.options.length < 2) return null;
      return select.options[1].value; // Skip the first empty option
    });

    if (firstModel) {
      console.log(`Selecting model: ${firstModel}`);

      // Select the model
      await page.selectOption('#current-model-select', firstModel);

      // Verify selection
      const selectedValue = await page.evaluate(() => {
        const select = document.querySelector('#current-model-select') as HTMLSelectElement;
        return select ? select.value : null;
      });

      expect(selectedValue).toBe(firstModel);
      console.log('✅ Model selection successful');
    } else {
      console.log('⚠️  No models available for selection test');
    }
  });
});