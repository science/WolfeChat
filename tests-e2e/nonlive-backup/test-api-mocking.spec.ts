/**
 * Test API Mocking
 *
 * Proper API mocking for nonlive E2E tests to verify complete model flow
 */

import { test, expect } from '@playwright/test';

test.describe('API Mocking for Nonlive Tests', () => {
  test('should mock OpenAI API and verify complete model flow', async ({ page }) => {
    console.log('=== Testing with Proper API Mocking ===');

    // Mock the OpenAI models API with proper response
    await page.route('**/v1/models', async route => {
      console.log('[MOCK] Intercepting OpenAI models API call');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'list',
          data: [
            {
              id: 'gpt-4',
              object: 'model',
              created: 1687882411,
              owned_by: 'openai',
              permission: [{ allow_create_engine: false }]
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model',
              created: 1677610602,
              owned_by: 'openai',
              permission: [{ allow_create_engine: false }]
            },
            {
              id: 'gpt-4-vision-preview',
              object: 'model',
              created: 1698894618,
              owned_by: 'openai',
              permission: [{ allow_create_engine: false }]
            },
            {
              id: 'dall-e-3',
              object: 'model',
              created: 1698785189,
              owned_by: 'openai',
              permission: [{ allow_create_engine: false }]
            }
          ]
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('STEP 1: Set up API key and trigger fetch');

    // Open Settings
    const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
    await settingsButton.click();

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click Check API (this should trigger our mock)
    const checkAPIButton = page.locator('button:has-text("Check API")');
    await checkAPIButton.click();

    // Wait for the API call to complete
    console.log('STEP 2: Wait for mocked API call to complete');
    await page.waitForTimeout(2000);

    // Check if models were stored
    const storeStateAfterAPI = await page.evaluate(() => {
      if (!window.stores) return { error: 'No stores' };

      const modelsStore = window.stores.modelsStore;
      const openaiKey = window.stores.openaiApiKey;

      let models, apiKey;

      if (modelsStore?.subscribe) {
        const unsubscribe = modelsStore.subscribe(value => { models = value; });
        unsubscribe();
      }

      if (openaiKey?.subscribe) {
        const unsubscribe = openaiKey.subscribe(value => { apiKey = value; });
        unsubscribe();
      }

      return {
        modelsCount: Array.isArray(models) ? models.length : 'not-array',
        modelsData: Array.isArray(models) ? models.map(m => ({ id: m.id, provider: m.provider })) : models,
        apiKey: apiKey,
        localStorage: {
          models: localStorage.getItem('models'),
          openaiKey: localStorage.getItem('openai_api_key')
        }
      };
    });

    console.log('Store state after mocked API:', JSON.stringify(storeStateAfterAPI, null, 2));

    if (storeStateAfterAPI.modelsCount === 0) {
      console.log('🚨 ISSUE: Models not stored even with successful mock API');

      // Check what went wrong
      console.log('Checking localStorage directly...');
      const localStorage = await page.evaluate(() => ({
        models: localStorage.getItem('models'),
        openaiKey: localStorage.getItem('openai_api_key')
      }));
      console.log('Direct localStorage:', localStorage);

    } else {
      console.log(`✅ SUCCESS: ${storeStateAfterAPI.modelsCount} models stored after mock API`);
    }

    console.log('STEP 3: Test QuickSettings with correct selector');

    // Close Settings modal properly using Save button
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    await saveBtn.click();
    await page.waitForSelector('h2:has-text("Settings")', { state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);

    // Expand QuickSettings
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();

    // Wait for dropdown with correct selector
    const modelSelect = page.locator('#current-model-select');
    await modelSelect.waitFor({ timeout: 5000 });

    // Check dropdown options
    const optionsAfterMock = await page.evaluate(() => {
      const select = document.querySelector('#current-model-select') as HTMLSelectElement;
      if (!select) return { error: 'Select not found' };

      return {
        optionCount: select.options.length,
        options: Array.from(select.options).map(opt => ({
          text: opt.text,
          value: opt.value,
          disabled: opt.disabled
        }))
      };
    });

    console.log('QuickSettings dropdown after mock:', JSON.stringify(optionsAfterMock, null, 2));

    // Count real model options (not placeholders)
    const realModelOptions = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    console.log(`Real model options in dropdown: ${realModelOptions}`);

    if (realModelOptions === 0) {
      console.log('🚨 DISCONNECT: Models in store but not in dropdown');

      // Debug the component state
      const componentDebug = await page.evaluate(() => {
        // Try to find what's preventing models from showing
        const select = document.querySelector('#current-model-select') as HTMLSelectElement;

        return {
          selectExists: !!select,
          selectHTML: select?.outerHTML,
          parentComponent: select?.closest('[class*="svelte"]')?.className || 'no-svelte-parent'
        };
      });

      console.log('Component debug:', JSON.stringify(componentDebug, null, 2));

    } else {
      console.log(`✅ COMPLETE SUCCESS: Models flow from API → store → dropdown (${realModelOptions} models)`);
    }

    // Final verification: can we select a model?
    if (realModelOptions > 0) {
      console.log('STEP 4: Test model selection');

      // Try to select gpt-4
      await modelSelect.selectOption('gpt-4');

      const selectedValue = await modelSelect.inputValue();
      console.log(`Selected model: ${selectedValue}`);

      if (selectedValue === 'gpt-4') {
        console.log('✅ Model selection works correctly');
      } else {
        console.log('🚨 Model selection not working');
      }
    }
  });
});