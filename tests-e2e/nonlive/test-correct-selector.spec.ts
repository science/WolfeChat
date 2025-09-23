/**
 * Test with Correct Selector
 *
 * Now that we know the correct selector, test the actual model data flow
 */

import { test, expect } from '@playwright/test';

test.describe('Test Correct QuickSettings Selector', () => {
  test('should use correct selector and debug model population', async ({ page }) => {
    console.log('=== Testing with Correct Selector ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Expand QuickSettings
    console.log('STEP 1: Expand QuickSettings');
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();

    // Step 2: Use correct selector
    console.log('STEP 2: Check dropdown with correct selector');
    const modelSelect = page.locator('#current-model-select');
    await modelSelect.waitFor({ timeout: 5000 });

    const options = await modelSelect.locator('option').allTextContents();
    console.log('Dropdown options:', options);

    const optionDetails = await page.evaluate(() => {
      const select = document.querySelector('#current-model-select') as HTMLSelectElement;
      if (!select) return { error: 'Select not found' };

      return {
        optionCount: select.options.length,
        selectedValue: select.value,
        options: Array.from(select.options).map(opt => ({
          text: opt.text,
          value: opt.value,
          disabled: opt.disabled
        }))
      };
    });

    console.log('Option details:', JSON.stringify(optionDetails, null, 2));

    // Step 3: Check store state when dropdown is visible
    console.log('STEP 3: Check store state with dropdown expanded');
    const storeState = await page.evaluate(() => {
      if (!window.stores) return { error: 'No window.stores' };

      const modelsStore = window.stores.modelsStore;
      const openaiKey = window.stores.openaiApiKey;
      const selectedModel = window.stores.selectedModel;

      let models, apiKey, currentModel;

      if (modelsStore?.subscribe) {
        const unsubscribe = modelsStore.subscribe(value => { models = value; });
        unsubscribe();
      }

      if (openaiKey?.subscribe) {
        const unsubscribe = openaiKey.subscribe(value => { apiKey = value; });
        unsubscribe();
      }

      if (selectedModel?.subscribe) {
        const unsubscribe = selectedModel.subscribe(value => { currentModel = value; });
        unsubscribe();
      }

      return {
        modelsCount: Array.isArray(models) ? models.length : 'not-array',
        modelsData: Array.isArray(models) ? models.map(m => ({ id: m.id, provider: m.provider })) : models,
        hasApiKey: !!apiKey,
        currentSelectedModel: currentModel,
        localStorage: {
          models: localStorage.getItem('models'),
          selectedModel: localStorage.getItem('selectedModel'),
          openaiKey: localStorage.getItem('openai_api_key')
        }
      };
    });

    console.log('Store state:', JSON.stringify(storeState, null, 2));

    // Step 4: If no models, try setting up API key
    if (optionDetails.optionCount <= 1) {
      console.log('STEP 4: No models found, setting up API key');

      // Close QuickSettings first
      await quickSettingsButton.click();

      // Open Settings
      const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsButton.click();

      // Set API key
      await page.fill('input[type="password"]', 'sk-test123');

      // Click Check API
      await page.click('button:has-text("Check API")');

      // Wait for API call
      await page.waitForTimeout(3000);

      // Check store state after API setup
      const storeAfterAPI = await page.evaluate(() => {
        if (!window.stores) return { error: 'No window.stores' };

        const modelsStore = window.stores.modelsStore;
        let models;

        if (modelsStore?.subscribe) {
          const unsubscribe = modelsStore.subscribe(value => { models = value; });
          unsubscribe();
        }

        return {
          modelsCount: Array.isArray(models) ? models.length : 'not-array',
          modelsData: Array.isArray(models) ? models.slice(0, 5).map(m => ({ id: m.id, provider: m.provider })) : models,
          localStorage: {
            models: localStorage.getItem('models')?.substring(0, 200) + '...'
          }
        };
      });

      console.log('Store after API setup:', JSON.stringify(storeAfterAPI, null, 2));

      // Re-expand QuickSettings to check dropdown
      await quickSettingsButton.click();

      const optionsAfterAPI = await modelSelect.locator('option').allTextContents();
      console.log('Dropdown options after API setup:', optionsAfterAPI);

      const realOptionsAfterAPI = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
      console.log('Real model options after API setup:', realOptionsAfterAPI);

      if (realOptionsAfterAPI === 0) {
        console.log('🚨 ISSUE: Even after API setup, no models in dropdown');

        // Check if there's a disconnect between store and component
        const disconnect = await page.evaluate(() => {
          // Try to trigger a manual update or find what the component is using
          const select = document.querySelector('#current-model-select') as HTMLSelectElement;

          return {
            selectHTML: select?.outerHTML,
            parentHTML: select?.parentElement?.outerHTML?.substring(0, 300) + '...'
          };
        });

        console.log('Component disconnect debug:', JSON.stringify(disconnect, null, 2));
      } else {
        console.log(`✅ SUCCESS: Found ${realOptionsAfterAPI} models after API setup`);
      }
    }
  });
});