/**
 * Debug API Fetch
 *
 * Investigate why "Check API" button doesn't fetch models
 */

import { test, expect } from '@playwright/test';
import { openSettings } from '../live/helpers';

test.describe('Debug API Fetch', () => {
  test('should monitor network requests when clicking Check API', async ({ page }) => {
    console.log('=== Debugging API Fetch ===');

    // Monitor all network requests
    const requests = [];
    const responses = [];
    const failedRequests = [];

    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    });

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()
      });
      console.log(`[FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Monitor console logs and errors
    page.on('console', msg => {
      console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('STEP 1: Open Settings');
    const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
    await settingsButton.click();

    console.log('STEP 2: Fill API key');
    await page.fill('input[type="password"]', 'sk-test123');

    // Check if API key is actually stored
    const apiKeyCheck = await page.evaluate(() => {
      const input = document.querySelector('input[type="password"]') as HTMLInputElement;
      return {
        inputValue: input?.value,
        inputExists: !!input
      };
    });
    console.log('API key input check:', apiKeyCheck);

    console.log('STEP 3: Click Check API button');

    // Clear request tracking before the important click
    requests.length = 0;
    responses.length = 0;
    failedRequests.length = 0;

    const checkAPIButton = page.locator('button:has-text("Check API")');
    await checkAPIButton.click();

    console.log('STEP 4: Wait and monitor network activity');
    await page.waitForTimeout(5000); // Give it time for network requests

    console.log('=== NETWORK ACTIVITY SUMMARY ===');
    console.log(`Total requests: ${requests.length}`);
    console.log(`Total responses: ${responses.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    if (requests.length > 0) {
      console.log('Requests made:');
      requests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });
    } else {
      console.log('🚨 NO NETWORK REQUESTS MADE');
    }

    if (responses.length > 0) {
      console.log('Responses received:');
      responses.forEach((res, i) => {
        console.log(`  ${i + 1}. ${res.status} ${res.url}`);
      });
    }

    if (failedRequests.length > 0) {
      console.log('Failed requests:');
      failedRequests.forEach((fail, i) => {
        console.log(`  ${i + 1}. ${fail.url} - ${fail.failure}`);
      });
    }

    // Check if button click actually triggered anything
    const buttonState = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Check API')
      );
      return {
        found: !!button,
        disabled: button?.disabled,
        text: button?.textContent,
        className: button?.className
      };
    });
    console.log('Check API button state:', buttonState);

    // Check store state after click
    const storeAfterClick = await page.evaluate(() => {
      if (!window.stores) return { error: 'No stores' };

      const openaiKey = window.stores.openaiApiKey;
      const modelsStore = window.stores.modelsStore;

      let apiKey, models;

      if (openaiKey?.subscribe) {
        const unsubscribe = openaiKey.subscribe(value => { apiKey = value; });
        unsubscribe();
      }

      if (modelsStore?.subscribe) {
        const unsubscribe = modelsStore.subscribe(value => { models = value; });
        unsubscribe();
      }

      return {
        apiKeyInStore: apiKey,
        modelsCount: Array.isArray(models) ? models.length : 'not-array',
        localStorage: {
          openaiKey: localStorage.getItem('openai_api_key'),
          models: localStorage.getItem('models')
        }
      };
    });

    console.log('Store state after Check API:', JSON.stringify(storeAfterClick, null, 2));

    // Look for OpenAI API specific requests
    const openaiRequests = requests.filter(req =>
      req.url.includes('openai.com') || req.url.includes('/models')
    );

    if (openaiRequests.length === 0) {
      console.log('🚨 NO OPENAI API REQUESTS MADE');
      console.log('This suggests the Check API button is not calling the fetch models function');
    } else {
      console.log(`✅ Found ${openaiRequests.length} OpenAI API requests`);
    }
  });

  test('should verify Check API button works with real API', async ({ page }) => {
    if (!process.env.OPENAI_API_KEY) {
      test.skip(true, 'Requires OPENAI_API_KEY environment variable');
      return;
    }

    console.log('=== Testing Check API Button with Real API ===');

    await page.goto('/');
    await openSettings(page);

    // Fill in real API key
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill(process.env.OPENAI_API_KEY!);

    // Monitor network for API call
    const apiPromise = page.waitForResponse(
      resp => resp.url().includes('openai.com/v1/models') && resp.status() === 200,
      { timeout: 10000 }
    );

    // Click Check API button
    const checkButton = page.locator('button:has-text("Check API")');
    await expect(checkButton).toBeVisible();
    await checkButton.click();

    // Verify API was called successfully
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    console.log('✅ API call successful');

    // Verify models were loaded
    await page.waitForTimeout(2000); // Give time for models to populate
    const modelCount = await page.locator('#model-selection option').count();
    expect(modelCount).toBeGreaterThan(1);
    console.log(`✅ Found ${modelCount} models after API check`);
  });

  test('should handle API key validation', async ({ page }) => {
    console.log('=== Testing API Key Validation ===');

    await page.goto('/');
    await openSettings(page);

    // Test with invalid key
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill('sk-invalid-key-12345');

    // Monitor for error response
    const errorPromise = page.waitForResponse(
      resp => resp.url().includes('openai.com/v1/models') && resp.status() === 401,
      { timeout: 10000 }
    );

    // Click Check API button
    const checkButton = page.locator('button:has-text("Check API")');
    await checkButton.click();

    // Verify we get 401 error
    const errorResponse = await errorPromise;
    expect(errorResponse.status()).toBe(401);
    console.log('✅ Invalid API key properly rejected');
  });
});