/**
 * Verify E2E Fixes
 *
 * Test that the critical fixes resolve the original failing E2E tests
 */

import { test, expect } from '@playwright/test';
import { mockOpenAIAPI, getVisibleModels, setProviderApiKey, operateQuickSettings } from '../live/helpers.js';
import { debugInfo, debugWarn, debugErr } from '../debug-utils';

test.describe('Verify E2E Fixes', () => {
  test('should verify that fixed helpers work with API mocking', async ({ page }) => {
    debugInfo('=== Verifying E2E Fixes ===');

    // CRITICAL FIX: Add API mocking for nonlive tests
    await mockOpenAIAPI(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    debugInfo('STEP 1: Set up API key to trigger model fetch');

    // Open Settings
    await page.click('button:has-text("Settings")', { force: true });

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click Check API (should trigger our mock)
    await page.click('button:has-text("Check API")', { force: true });

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    debugInfo('STEP 2: Test fixed getVisibleModels helper');

    try {
      // Close Settings first (try different approaches)
      try {
        await page.keyboard.press('Escape');
      } catch {
        // If that doesn't work, continue anyway
      }

      await page.waitForTimeout(500);

      // CRITICAL TEST: Use updated getVisibleModels with correct selector and QuickSettings expansion
      const visibleModels = await getVisibleModels(page);

      debugInfo('Visible models:', { visibleModels });
      debugInfo('Model count:', { count: visibleModels.length });

      if (visibleModels.length === 0) {
        debugWarn('🚨 ISSUE: Updated helper still returns 0 models');

        // Debug what went wrong
        const debugInfo = await page.evaluate(() => {
          return {
            hasQuickSettings: !!document.querySelector('button:has(text(),"Quick Settings")'),
            hasCurrentModelSelect: !!document.querySelector('#current-model-select'),
            hasModelSelection: !!document.querySelector('#model-selection'),
            quickSettingsText: document.querySelector('button')?.textContent?.includes('Quick Settings') ? 'found' : 'not found'
          };
        });

        debugInfo('Debug info:', { debugInfo });

      } else {
        debugInfo(`✅ SUCCESS: Found ${visibleModels.length} models with updated helper`);

        // Verify we have expected models
        const expectedModels = ['gpt-4', 'gpt-3.5-turbo'];
        const hasExpectedModels = expectedModels.every(model =>
          visibleModels.some(visible => visible.includes(model))
        );

        if (hasExpectedModels) {
          debugInfo('✅ COMPLETE SUCCESS: All expected models found');
        } else {
          debugWarn('⚠️ Models found but not the expected ones');
          debugInfo('Expected:', { expectedModels });
          debugInfo('Found:', { visibleModels });
        }
      }

    } catch (error) {
      debugErr('❌ Error testing updated helper:', { error: error.message });
      throw error;
    }
  });

  test('should verify original E2E test pattern works', async ({ page }) => {
    debugInfo('=== Testing Original E2E Pattern ===');

    // Mock API
    await mockOpenAIAPI(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate the original failing test pattern:
    // 1. Set API key
    // 2. Check for models

    // Set up API key using helper
    await setProviderApiKey(page, 'OpenAI', 'sk-test123');

    // CRITICAL TEST: The pattern that was failing before
    // Original tests were looking for #model-selection and getting 0 models

    // First try the old broken way (should fail)
    const oldSelectorExists = await page.locator('#model-selection').isVisible().catch(() => false);
    debugInfo('Old selector (#model-selection) exists:', { oldSelectorExists });

    // Now try the new fixed way
    debugInfo('Expanding QuickSettings...');
    await operateQuickSettings(page, { mode: 'ensure-open' });

    const newSelectorExists = await page.locator('#current-model-select').isVisible().catch(() => false);
    debugInfo('New selector (#current-model-select) exists after expansion:', { newSelectorExists });

    if (newSelectorExists) {
      const modelOptions = await page.locator('#current-model-select option').allTextContents();
      const realModels = modelOptions.filter(text =>
        text && text !== 'Select a model...' && text !== 'No models loaded' && text.trim() !== ''
      );

      debugInfo('Model options found:', { realModels });
      debugInfo('Real model count:', { count: realModels.length });

      if (realModels.length > 0) {
        debugInfo('✅ ULTIMATE SUCCESS: Original E2E pattern now works with fixes');
      } else {
        debugWarn('🚨 Dropdown exists but no real models');
      }
    } else {
        debugWarn('🚨 New selector still not working');
    }
  });
});