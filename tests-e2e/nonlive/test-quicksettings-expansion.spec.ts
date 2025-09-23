/**
 * Test QuickSettings Expansion
 *
 * Verify that expanding QuickSettings reveals the model dropdown
 */

import { test, expect } from '@playwright/test';

test.describe('QuickSettings Expansion', () => {
  test('should expand QuickSettings and find model dropdown', async ({ page }) => {
    console.log('=== Testing QuickSettings Expansion ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the QuickSettings button (collapsed state)
    console.log('STEP 1: Find collapsed QuickSettings');
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();

    const buttonText = await quickSettingsButton.textContent();
    console.log('QuickSettings button text:', buttonText);

    // Verify it shows model in collapsed form
    expect(buttonText).toContain('gpt-3.5-turbo');
    console.log('✅ Collapsed QuickSettings shows gpt-3.5-turbo');

    // Check that model dropdown doesn't exist yet
    console.log('STEP 2: Verify dropdown not visible before expansion');
    const modelSelectBefore = page.locator('#model-selection');
    const visibleBefore = await modelSelectBefore.isVisible().catch(() => false);
    console.log('Model dropdown visible before expansion:', visibleBefore);

    // Click to expand QuickSettings
    console.log('STEP 3: Expand QuickSettings');
    await quickSettingsButton.click();

    // Wait for expansion animation and dropdown to appear
    await page.waitForSelector('#model-selection', { timeout: 5000 });
    console.log('✅ Model dropdown appeared after expansion');

    // Check the dropdown content
    console.log('STEP 4: Check dropdown content');
    const modelSelect = page.locator('#model-selection');
    const options = await modelSelect.locator('option').allTextContents();
    console.log('Model options:', options);

    // Count real model options (excluding placeholder)
    const realOptions = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    console.log('Real model options count:', realOptions);

    if (realOptions === 0) {
      console.log('🚨 ISSUE: No real model options in expanded dropdown');

      // Debug store state when expanded
      const storeState = await page.evaluate(() => {
        const modelsStore = window.stores?.modelsStore;
        if (modelsStore) {
          let currentValue;
          const unsubscribe = modelsStore.subscribe(value => {
            currentValue = value;
          });
          unsubscribe();
          return {
            hasStore: true,
            modelCount: Array.isArray(currentValue) ? currentValue.length : 'not-array',
            models: Array.isArray(currentValue) ? currentValue.map(m => ({ id: m.id, provider: m.provider })) : currentValue
          };
        }
        return { hasStore: false };
      });

      console.log('Store state when expanded:', JSON.stringify(storeState, null, 2));
    } else {
      console.log('✅ Found real model options in expanded dropdown');
    }
  });

  test('should test the complete E2E flow with proper expansion', async ({ page }) => {
    console.log('=== Testing Complete Flow with Expansion ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Expand QuickSettings to access model dropdown
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();
    await page.waitForSelector('#model-selection', { timeout: 5000 });

    // Step 2: Check current model dropdown state
    const modelSelect = page.locator('#model-selection');
    const initialOptions = await modelSelect.locator('option').allTextContents();
    console.log('Initial model options:', initialOptions);

    // Step 3: Set up API key via Settings
    console.log('Setting up API key...');

    // Click settings button (from our debug we know the text)
    const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
    await settingsButton.click();

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click "Check API" button
    await page.click('button:has-text("Check API")');

    // Wait a moment for API processing
    await page.waitForTimeout(2000);

    // Step 4: Check if models appeared in dropdown
    const finalOptions = await modelSelect.locator('option').allTextContents();
    console.log('Final model options:', finalOptions);

    const realModelCount = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    console.log('Real model count after API setup:', realModelCount);

    if (realModelCount === 0) {
      console.log('🚨 STILL NO MODELS: Even after API setup, no models in dropdown');

      // Additional debugging
      const debugInfo = await page.evaluate(() => {
        return {
          localStorage: {
            models: localStorage.getItem('models'),
            openaiKey: localStorage.getItem('openai_api_key')
          }
        };
      });
      console.log('Debug localStorage:', debugInfo);
    } else {
      console.log(`✅ SUCCESS: Found ${realModelCount} models after API setup`);
    }
  });
});