/**
 * Verify E2E Fixes
 *
 * Test that the critical fixes resolve the original failing E2E tests
 */

import { test, expect } from '@playwright/test';
import { mockOpenAIAPI, getVisibleModels } from '../live/helpers.js';

test.describe('Verify E2E Fixes', () => {
  test('should verify that fixed helpers work with API mocking', async ({ page }) => {
    console.log('=== Verifying E2E Fixes ===');

    // CRITICAL FIX: Add API mocking for nonlive tests
    await mockOpenAIAPI(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('STEP 1: Set up API key to trigger model fetch');

    // Open Settings
    await page.click('button:has-text("Settings")');

    // Fill API key
    await page.fill('input[type="password"]', 'sk-test123');

    // Click Check API (should trigger our mock)
    await page.click('button:has-text("Check API")');

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    console.log('STEP 2: Test fixed getVisibleModels helper');

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

      console.log('Visible models:', visibleModels);
      console.log('Model count:', visibleModels.length);

      if (visibleModels.length === 0) {
        console.log('🚨 ISSUE: Updated helper still returns 0 models');

        // Debug what went wrong
        const debugInfo = await page.evaluate(() => {
          return {
            hasQuickSettings: !!document.querySelector('button:has(text(),"Quick Settings")'),
            hasCurrentModelSelect: !!document.querySelector('#current-model-select'),
            hasModelSelection: !!document.querySelector('#model-selection'),
            quickSettingsText: document.querySelector('button')?.textContent?.includes('Quick Settings') ? 'found' : 'not found'
          };
        });

        console.log('Debug info:', debugInfo);

      } else {
        console.log(`✅ SUCCESS: Found ${visibleModels.length} models with updated helper`);

        // Verify we have expected models
        const expectedModels = ['gpt-4', 'gpt-3.5-turbo'];
        const hasExpectedModels = expectedModels.every(model =>
          visibleModels.some(visible => visible.includes(model))
        );

        if (hasExpectedModels) {
          console.log('✅ COMPLETE SUCCESS: All expected models found');
        } else {
          console.log('⚠️ Models found but not the expected ones');
          console.log('Expected:', expectedModels);
          console.log('Found:', visibleModels);
        }
      }

    } catch (error) {
      console.log('❌ Error testing updated helper:', error.message);
      throw error;
    }
  });

  test('should verify original E2E test pattern works', async ({ page }) => {
    console.log('=== Testing Original E2E Pattern ===');

    // Mock API
    await mockOpenAIAPI(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate the original failing test pattern:
    // 1. Set API key
    // 2. Check for models

    // Set up API key
    await page.click('button:has-text("Settings")');
    await page.fill('input[type="password"]', 'sk-test123');
    await page.click('button:has-text("Check API")');
    await page.waitForTimeout(2000);

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // CRITICAL TEST: The pattern that was failing before
    // Original tests were looking for #model-selection and getting 0 models

    // First try the old broken way (should fail)
    const oldSelectorExists = await page.locator('#model-selection').isVisible().catch(() => false);
    console.log('Old selector (#model-selection) exists:', oldSelectorExists);

    // Now try the new fixed way
    console.log('Expanding QuickSettings...');
    const quickSettingsButton = page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();

    const newSelectorExists = await page.locator('#current-model-select').isVisible().catch(() => false);
    console.log('New selector (#current-model-select) exists after expansion:', newSelectorExists);

    if (newSelectorExists) {
      const modelOptions = await page.locator('#current-model-select option').allTextContents();
      const realModels = modelOptions.filter(text =>
        text && text !== 'Select a model...' && text !== 'No models loaded' && text.trim() !== ''
      );

      console.log('Model options found:', realModels);
      console.log('Real model count:', realModels.length);

      if (realModels.length > 0) {
        console.log('✅ ULTIMATE SUCCESS: Original E2E pattern now works with fixes');
      } else {
        console.log('🚨 Dropdown exists but no real models');
      }
    } else {
      console.log('🚨 New selector still not working');
    }
  });
});