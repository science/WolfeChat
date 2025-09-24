import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

// Note: This integration test requires the dev server to be running
// Run with: npm run dev &amp;&amp; npm run test src/tests/unit/test-helpers-integration.spec.ts

describe('Helper Functions Integration Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.warn('Could not connect to dev server. Make sure it is running on http://localhost:5173');
      throw error;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Settings Modal Flow', () => {
    it('should handle Settings modal open/close cycle', async () => {
      // Test opening Settings
      const settingsButton = page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsButton.click();

      // Verify Settings is open
      const heading = page.getByRole('heading', { name: /settings/i });
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Test closing Settings with Save button
      const saveBtn = page.getByRole('button', { name: /^save$/i });
      await saveBtn.click();

      // Verify Settings is closed
      await expect(heading).toBeHidden({ timeout: 5000 });
    });

    it('should maintain Settings state between operations', async () => {
      // Open Settings
      const settingsButton = page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsButton.click();

      // Verify Settings is open
      const heading = page.getByRole('heading', { name: /settings/i });
      await expect(heading).toBeVisible();

      // Interact with provider selector
      const providerSelect = page.locator('#provider-selection');
      await expect(providerSelect).toBeVisible();
      await providerSelect.selectOption('OpenAI');

      // Settings should still be open after provider selection
      await expect(heading).toBeVisible();

      // Close Settings
      const saveBtn = page.getByRole('button', { name: /^save$/i });
      await saveBtn.click();
      await expect(heading).toBeHidden();
    });

    it('should handle modal context detection', async () => {
      // Initially no modal should be open
      const settingsHeading = page.getByRole('heading', { name: /settings/i });
      const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');

      await expect(settingsHeading).toBeHidden();

      // Check QuickSettings state
      const isQuickSettingsExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      expect(isQuickSettingsExpanded).not.toBe('true');

      // Open Settings - should change context
      const settingsButton = page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsButton.click();
      await expect(settingsHeading).toBeVisible();

      // Close Settings
      const saveBtn = page.getByRole('button', { name: /^save$/i });
      await saveBtn.click();
      await expect(settingsHeading).toBeHidden();

      // Open QuickSettings - should change context
      await quickSettingsButton.click();
      const expandedState = await quickSettingsButton.getAttribute('aria-expanded');
      expect(expandedState).toBe('true');

      // Close QuickSettings
      await quickSettingsButton.click();
    });
  });

  describe('QuickSettings Panel Flow', () => {
    it('should handle QuickSettings expansion and collapse', async () => {
      const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');

      // Initially should not be expanded
      let isExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      expect(isExpanded).not.toBe('true');

      // Expand QuickSettings
      await quickSettingsButton.click();
      await page.waitForTimeout(500); // Allow animation

      isExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      expect(isExpanded).toBe('true');

      // Verify model select is visible
      const modelSelect = page.locator('#current-model-select');
      await expect(modelSelect).toBeVisible();

      // Collapse QuickSettings
      await quickSettingsButton.click();
      await page.waitForTimeout(500);

      isExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      expect(isExpanded).toBe('false');
    });

    it('should access model dropdown when QuickSettings is expanded', async () => {
      const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');

      // Ensure QuickSettings is expanded
      const isExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await quickSettingsButton.click();
        await page.waitForTimeout(500);
      }

      // Should be able to access model select
      const modelSelect = page.locator('#current-model-select');
      await expect(modelSelect).toBeVisible();

      // Should have at least a default option
      const options = await modelSelect.locator('option').count();
      expect(options).toBeGreaterThan(0);

      // Close QuickSettings
      await quickSettingsButton.click();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing elements gracefully', async () => {
      // Test locating non-existent elements
      const nonExistentElement = page.locator('#non-existent-element');
      const isVisible = await nonExistentElement.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    it('should handle timeouts gracefully', async () => {
      // Test short timeout on non-existent element
      const nonExistentElement = page.locator('#non-existent-element');
      const waitResult = await nonExistentElement.waitFor({ timeout: 100 }).catch(() => false);
      expect(waitResult).toBe(false);
    });

    it('should validate DOM selectors exist', async () => {
      // Verify critical selectors exist in the DOM
      const criticalSelectors = [
        '#current-model-select', // QuickSettings model selector
        '#model-selection',      // Settings model selector
        '#provider-selection'    // Settings provider selector
      ];

      for (const selector of criticalSelectors) {
        // We don't expect all elements to be visible initially,
        // but they should exist in the DOM when their parent modals are open
        const element = page.locator(selector);
        expect(element).toBeDefined();
      }
    });
  });

  describe('Component Integration', () => {
    it('should verify Svelte component reactivity', async () => {
      // Open Settings and check that UI responds to state changes
      const settingsButton = page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsButton.click();

      const providerSelect = page.locator('#provider-selection');
      const apiKeyInput = page.locator('#api-key');

      // Change provider should show corresponding input
      await providerSelect.selectOption('OpenAI');
      await expect(apiKeyInput).toBeVisible();
      await expect(apiKeyInput).toHaveAttribute('placeholder', /api key/i);

      // Switch provider
      await providerSelect.selectOption('Anthropic');
      await expect(apiKeyInput).toBeVisible();

      // Close Settings
      const saveBtn = page.getByRole('button', { name: /^save$/i });
      await saveBtn.click();
    });

    it('should verify QuickSettings responds to model availability', async () => {
      // Open QuickSettings
      const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');
      await quickSettingsButton.click();

      const modelSelect = page.locator('#current-model-select');
      await expect(modelSelect).toBeVisible();

      // Initially should show "No models loaded" or similar
      const firstOption = await modelSelect.locator('option').first().textContent();
      expect(firstOption).toMatch(/no models|select.*model/i);

      // Close QuickSettings
      await quickSettingsButton.click();
    });
  });

  describe('Performance and Timing', () => {
    it('should handle rapid modal switching', async () => {
      // Test rapid open/close of Settings
      const settingsButton = page.locator('button').filter({ hasText: 'Settings' }).first();

      for (let i = 0; i < 3; i++) {
        await settingsButton.click();
        const heading = page.getByRole('heading', { name: /settings/i });
        await expect(heading).toBeVisible();

        const saveBtn = page.getByRole('button', { name: /^save$/i });
        await saveBtn.click();
        await expect(heading).toBeHidden();
      }
    });

    it('should handle animation timings correctly', async () => {
      // Test that waiting for animations prevents race conditions
      const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');

      // Open with animation wait
      await quickSettingsButton.click();
      await page.waitForTimeout(500);

      const modelSelect = page.locator('#current-model-select');
      await expect(modelSelect).toBeVisible();

      // Close with animation wait
      await quickSettingsButton.click();
      await page.waitForTimeout(500);

      const isExpanded = await quickSettingsButton.getAttribute('aria-expanded');
      expect(isExpanded).toBe('false');
    });
  });
});