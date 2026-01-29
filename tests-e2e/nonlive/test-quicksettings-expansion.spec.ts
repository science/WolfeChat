/**
 * Test QuickSettings Expansion
 *
 * Verify that expanding QuickSettings reveals the model dropdown
 */

import { test, expect } from '@playwright/test';
import { debugInfo, debugWarn, debugErr } from '../debug-utils';

test.describe('QuickSettings Expansion', () => {
  test('should expand QuickSettings and find model dropdown', async ({ page }) => {
    debugInfo('=== Testing QuickSettings Expansion ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the QuickSettings button (collapsed state)
    debugInfo('STEP 1: Find collapsed QuickSettings');
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();

    const buttonText = await quickSettingsButton.textContent();
    debugInfo('QuickSettings button text:', { buttonText });

    // Verify it shows model in collapsed form
    expect(buttonText).toContain('gpt-3.5-turbo');
    debugInfo('✅ Collapsed QuickSettings shows gpt-3.5-turbo');

    // Check that model dropdown doesn't exist yet
    debugInfo('STEP 2: Verify dropdown not visible before expansion');
    const modelSelectBefore = page.locator('#model-selection');
    const visibleBefore = await modelSelectBefore.isVisible().catch(() => false);
    debugInfo('Model dropdown visible before expansion:', { visibleBefore });

    // Click to expand QuickSettings
    debugInfo('STEP 3: Expand QuickSettings');
    await quickSettingsButton.click({ force: true });

    // Wait for expansion animation and dropdown to appear
    await page.waitForSelector('#current-model-select', { timeout: 5000 });
    debugInfo('✅ Model dropdown appeared after expansion');

    // Check the dropdown content
    debugInfo('STEP 4: Check dropdown content');
    const modelSelect = page.locator('#current-model-select');
    const options = await modelSelect.locator('option').allTextContents();
    debugInfo('Model options:', { options });

    // Count real model options (excluding placeholder)
    const realOptions = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    debugInfo('Real model options count:', { realOptions });

    if (realOptions === 0) {
      debugWarn('🚨 ISSUE: No real model options in expanded dropdown');

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

      debugInfo('Store state when expanded:', { storeState });
    } else {
      debugInfo('✅ Found real model options in expanded dropdown');
    }
  });

  test('should test the complete E2E flow with proper expansion', async ({ page }) => {
    debugInfo('=== Testing Complete Flow with Expansion ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Expand QuickSettings to access model dropdown
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click({ force: true });
    await page.waitForSelector('#current-model-select', { timeout: 5000 });

    // Step 2: Check current model dropdown state
    const modelSelect = page.locator('#current-model-select');
    const initialOptions = await modelSelect.locator('option').allTextContents();
    debugInfo('Initial model options:', { initialOptions });

    // Step 3: Set up API key via Settings
    debugInfo('Setting up API key...');

    // Click settings button (from our debug we know the text)
    const settingsButton = await page.locator('button').filter({ hasText: 'Settings' }).first();
    await settingsButton.click({ force: true });

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click "Check API" button
    await page.click('button:has-text("Check API")', { force: true });

    // Wait a moment for API processing
    await page.waitForTimeout(2000);

    // Step 4: Check if models appeared in dropdown
    const finalOptions = await modelSelect.locator('option').allTextContents();
    debugInfo('Final model options:', { finalOptions });

    const realModelCount = await modelSelect.locator('option').filter({ hasText: /^gpt-|^claude-/ }).count();
    debugInfo('Real model count after API setup:', { realModelCount });

    if (realModelCount === 0) {
      debugWarn('🚨 STILL NO MODELS: Even after API setup, no models in dropdown');

      // Additional debugging
      const debugData = await page.evaluate(() => {
        return {
          localStorage: {
            models: localStorage.getItem('models'),
            openaiKey: localStorage.getItem('openai_api_key')
          }
        };
      });
      debugInfo('Debug localStorage:', { debugData });
    } else {
      debugInfo(`✅ SUCCESS: Found ${realModelCount} models after API setup`);
    }
  });
});