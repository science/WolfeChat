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

  test('should check if Check API button handler exists', async ({ page }) => {
    console.log('=== Checking Check API Button Handler ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings using helper
    await openSettings(page);

    // Check if the button has event listeners
    const buttonInfo = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Check API')
      );

      if (!button) return { error: 'Button not found' };

      // Try to get event listeners (this might not work in all browsers)
      const listeners = getEventListeners ? getEventListeners(button) : 'getEventListeners not available';

      return {
        found: true,
        outerHTML: button.outerHTML,
        hasClickListener: button.onclick !== null,
        listenerInfo: listeners,
        parentInfo: {
          tagName: button.parentElement?.tagName,
          className: button.parentElement?.className
        }
      };
    });

    console.log('Button handler info:', JSON.stringify(buttonInfo, null, 2));

    // Check if we can find the fetchModels function
    const fetchInfo = await page.evaluate(() => {
      // Try to access window functions that might be exposed
      return {
        hasFetchModels: typeof window.fetchModels === 'function',
        windowKeys: Object.keys(window).filter(key => key.includes('fetch') || key.includes('model')),
        hasOpenAIService: !!window.openaiService
      };
    });

    console.log('Function availability:', fetchInfo);
  });
});