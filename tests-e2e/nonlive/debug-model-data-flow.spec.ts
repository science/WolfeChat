/**
 * Debug E2E Test: Model Data Flow Investigation
 *
 * This test investigates the actual data flow in the browser
 * to find where models are getting lost between API and DOM
 */

import { test, expect } from '@playwright/test';

test.describe('Debug Model Data Flow', () => {
  test('should trace model data through complete flow', async ({ page }) => {
    // Enable console logging to see debug output
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    // Navigate to app
    console.log('=== STEP 1: Navigate to app ===');
    await page.goto('/');

    // Wait for app to fully load
    await page.waitForSelector('#model-selection', { timeout: 10000 });

    // Check initial state with proper store reading
    console.log('=== STEP 2: Check initial state ===');
    const storeDebugInfo = await page.evaluate(() => {
      // Wait for stores to be available
      if (!window.stores) {
        return { error: 'window.stores not available' };
      }

      const modelsStore = window.stores.modelsStore;
      if (!modelsStore) {
        return { error: 'modelsStore not found in window.stores' };
      }

      let currentValue;
      let hasSubscribeMethod = typeof modelsStore.subscribe === 'function';

      if (hasSubscribeMethod) {
        const unsubscribe = modelsStore.subscribe(value => {
          currentValue = value;
        });
        unsubscribe();
      }

      // Also check localStorage directly
      let localStorageModels;
      try {
        const raw = localStorage.getItem('models');
        localStorageModels = raw ? JSON.parse(raw) : null;
      } catch (e) {
        localStorageModels = 'parse-error';
      }

      // Check what Quick Settings is actually showing
      const quickSettingsSelect = document.querySelector('#model-selection') as HTMLSelectElement;
      const visibleOptions = quickSettingsSelect ?
        Array.from(quickSettingsSelect.options).map(opt => ({ text: opt.text, value: opt.value })) : [];

      return {
        hasSubscribeMethod,
        storeValue: currentValue,
        storeLength: Array.isArray(currentValue) ? currentValue.length : 'not-array',
        storeType: typeof currentValue,
        localStorageRaw: localStorage.getItem('models'),
        localStorageModels,
        localStorageLength: Array.isArray(localStorageModels) ? localStorageModels.length : 'not-array',
        visibleOptions,
        quickSettingsExists: !!quickSettingsSelect
      };
    });

    console.log('Store debug info:', JSON.stringify(storeDebugInfo, null, 2));

    // Set up API key in Settings
    console.log('=== STEP 3: Configure API key ===');
    await page.click('button[title="Open Settings"]');
    await page.fill('input[type="password"]', 'sk-test123');

    // Check key detection
    const keyDetected = await page.evaluate(() => {
      const openaiKey = window.stores?.openaiApiKey;
      if (openaiKey && openaiKey.subscribe) {
        let currentValue;
        openaiKey.subscribe(value => currentValue = value)();
        return !!currentValue;
      }
      return false;
    });
    console.log(`API key detected in store: ${keyDetected}`);

    // Click "Check API" to trigger model fetching
    console.log('=== STEP 4: Trigger model fetching ===');

    // Add network monitoring
    let apiCallMade = false;
    page.on('request', request => {
      if (request.url().includes('api.openai.com') || request.url().includes('/models')) {
        console.log(`[NETWORK] API call: ${request.method()} ${request.url()}`);
        apiCallMade = true;
      }
    });

    page.on('response', response => {
      if (response.url().includes('api.openai.com') || response.url().includes('/models')) {
        console.log(`[NETWORK] API response: ${response.status()} ${response.url()}`);
      }
    });

    await page.click('button:has-text("Check API")');

    // Wait a moment for API call
    await page.waitForTimeout(2000);
    console.log(`API call was made: ${apiCallMade}`);

    // Check models after API call
    console.log('=== STEP 5: Check models after API call ===');
    const modelsAfterAPI = await page.evaluate(() => {
      const modelsStore = window.stores?.modelsStore;
      if (modelsStore && modelsStore.subscribe) {
        let currentValue;
        modelsStore.subscribe(value => currentValue = value)();

        if (Array.isArray(currentValue)) {
          return {
            count: currentValue.length,
            models: currentValue.map(m => ({
              id: m.id,
              provider: m.provider,
              hasProvider: 'provider' in m
            }))
          };
        }
        return { count: 'not-array', models: [] };
      }
      return { count: 'store-not-found', models: [] };
    });

    console.log(`Models after API: count=${modelsAfterAPI.count}`);
    if (modelsAfterAPI.models.length > 0) {
      console.log('Model details:', modelsAfterAPI.models);
    }

    // Check filtered models
    console.log('=== STEP 6: Check filtered models ===');
    const filteredModelsInfo = await page.evaluate(() => {
      // Try to access the Settings component's filtered models
      // This is tricky since we need to access component state

      // Check if we can find the filteredModels somewhere
      const select = document.querySelector('#model-selection') as HTMLSelectElement;
      if (select) {
        const options = Array.from(select.options).map(opt => ({
          text: opt.text,
          value: opt.value,
          disabled: opt.disabled
        }));

        const realOptions = options.filter(opt =>
          opt.value && opt.value !== '' && opt.text !== 'Select a model...'
        );

        return {
          totalOptions: options.length,
          realOptions: realOptions.length,
          options: options
        };
      }

      return { totalOptions: 0, realOptions: 0, options: [] };
    });

    console.log(`Filtered models in DOM: total=${filteredModelsInfo.totalOptions}, real=${filteredModelsInfo.realOptions}`);
    console.log('DOM options:', filteredModelsInfo.options);

    // Check if updateFilteredModels was called
    console.log('=== STEP 7: Check component state ===');
    const componentState = await page.evaluate(() => {
      // Add debugging info to the window object from the Settings component
      // This would need to be added to the actual component for debugging
      return {
        hasSettingsComponent: !!document.querySelector('#model-selection'),
        selectExists: !!document.querySelector('#model-selection'),
        selectOptionsCount: document.querySelector('#model-selection')?.children.length || 0
      };
    });

    console.log('Component state:', componentState);

    // Final assertions based on what we found
    if (modelsAfterAPI.count === 0) {
      console.log('🚨 ROOT CAUSE: No models in store after API call');
    } else if (filteredModelsInfo.realOptions === 0) {
      console.log('🚨 ROOT CAUSE: Models in store but not appearing in DOM');
    } else {
      console.log('✅ Models are flowing correctly');
    }

    // Don't assert yet - just investigate
    console.log('=== INVESTIGATION COMPLETE ===');
  });

  test('should check if stores are accessible', async ({ page }) => {
    console.log('=== Checking Store Accessibility ===');

    await page.goto('/');

    // Check if stores are exposed on window for debugging
    const storeAccess = await page.evaluate(() => {
      return {
        hasWindowStores: 'stores' in window,
        hasModelsStore: window.stores?.modelsStore !== undefined,
        hasOpenaiKey: window.stores?.openaiApiKey !== undefined,
        storeKeys: window.stores ? Object.keys(window.stores) : []
      };
    });

    console.log('Store accessibility:', storeAccess);

    if (!storeAccess.hasWindowStores) {
      console.log('🚨 POTENTIAL ISSUE: Stores not exposed on window for debugging');
      console.log('This might make it hard to debug store state in E2E tests');
    }
  });

  test('should mock API and verify model processing', async ({ page }) => {
    console.log('=== Testing with Mocked API ===');

    // Mock the OpenAI API response
    await page.route('**/v1/models', async route => {
      console.log('[MOCK] Intercepting OpenAI models API call');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' }
          ]
        })
      });
    });

    await page.goto('/');

    // Set API key and trigger fetch
    await page.click('button[title="Open Settings"]');
    await page.fill('input[type="password"]', 'sk-test123');

    console.log('[MOCK] Triggering model fetch with mocked API');
    await page.click('button:has-text("Check API")');

    // Wait for processing
    await page.waitForTimeout(1000);

    // Check what happened
    const mockResult = await page.evaluate(() => {
      const select = document.querySelector('#model-selection') as HTMLSelectElement;
      if (select) {
        const realOptions = Array.from(select.options).filter(opt =>
          opt.value && opt.value !== ''
        );
        return {
          foundSelect: true,
          optionCount: realOptions.length,
          options: realOptions.map(opt => ({ text: opt.text, value: opt.value }))
        };
      }
      return { foundSelect: false, optionCount: 0, options: [] };
    });

    console.log('[MOCK] Result:', mockResult);

    if (mockResult.optionCount === 0) {
      console.log('🚨 ISSUE: Even with mocked API, no models in DOM');
    } else {
      console.log('✅ Mocked API shows models correctly');
    }
  });
});