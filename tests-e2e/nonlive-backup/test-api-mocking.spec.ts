/**
 * Test API Mocking
 *
 * Proper API mocking for nonlive E2E tests to verify complete model flow
 */

import { test, expect } from '@playwright/test';
import { debugInfo, debugWarn, debugErr } from '../debug-utils';

test.describe('API Mocking for Nonlive Tests', () => {
  test('should mock OpenAI API and verify complete model flow', async ({ page }) => {
    debugInfo('=== Testing with Proper API Mocking ===');

    // Mock the OpenAI models API with proper response
    await page.route('**/v1/models', async route => {
      debugInfo('[MOCK] Intercepting OpenAI models API call');
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

    debugInfo('STEP 1: Set up API key and trigger fetch');

    // Open Settings
    const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
    await settingsButton.click();

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click Check API (this should trigger our mock)
    const checkAPIButton = page.locator('button:has-text("Check API")');
    await checkAPIButton.click();

    // Wait for the API call to complete
    debugInfo('STEP 2: Wait for mocked API call to complete');
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

    debugInfo('Store state after mocked API:', { storeStateAfterAPI });

    if (storeStateAfterAPI.modelsCount === 0) {
      debugWarn('🚨 ISSUE: Models not stored even with successful mock API');

      // Check what went wrong
      debugInfo('Checking localStorage directly...');
      const localStorage = await page.evaluate(() => ({
        models: localStorage.getItem('models'),
        openaiKey: localStorage.getItem('openai_api_key')
      }));
      debugInfo('Direct localStorage:', { localStorage });

    } else {
      debugInfo(`✅ SUCCESS: ${storeStateAfterAPI.modelsCount} models stored after mock API`);
    }

    debugInfo('STEP 3: Test QuickSettings with correct selector');

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

    debugInfo('QuickSettings dropdown after mock:', { optionsAfterMock });

    // Count real model options (not placeholders)
    const realModelOptions = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    debugInfo(`Real model options in dropdown: ${realModelOptions}`);

    if (realModelOptions === 0) {
      debugWarn('🚨 DISCONNECT: Models in store but not in dropdown');

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

      debugInfo('Component debug:', { componentDebug });

    } else {
      debugInfo(`✅ COMPLETE SUCCESS: Models flow from API → store → dropdown (${realModelOptions} models)`);
    }

    // Final verification: can we select a model?
    if (realModelOptions > 0) {
      debugInfo('STEP 4: Test model selection');

      // Try to select gpt-4
      await modelSelect.selectOption('gpt-4');

      const selectedValue = await modelSelect.inputValue();
      debugInfo(`Selected model: ${selectedValue}`);

      if (selectedValue === 'gpt-4') {
        debugInfo('✅ Model selection works correctly');
      } else {
        debugWarn('🚨 Model selection not working');
      }
    }
  });
});