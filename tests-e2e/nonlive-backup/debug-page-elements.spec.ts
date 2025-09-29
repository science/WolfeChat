/**
 * Debug Page Elements
 *
 * Figure out what's actually on the page and find the right selectors
 */

import { test, expect } from '@playwright/test';
import { debugInfo, debugWarn, debugErr } from '../debug-utils';

test.describe('Debug Page Elements', () => {
  test('should find what elements exist on page', async ({ page }) => {
    debugInfo('=== Checking what exists on the page ===');

    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find all select elements
    const allSelects = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.map((select, index) => ({
        index,
        id: select.id || 'no-id',
        className: select.className || 'no-class',
        name: select.name || 'no-name',
        optionCount: select.options.length,
        options: Array.from(select.options).map(opt => ({
          text: opt.text,
          value: opt.value
        })),
        isVisible: select.offsetParent !== null
      }));
    });

    debugInfo('All select elements found:', { allSelects });

    // Find all buttons
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map((button, index) => ({
        index,
        id: button.id || 'no-id',
        className: button.className || 'no-class',
        title: button.title || 'no-title',
        textContent: button.textContent?.trim() || 'no-text',
        innerHTML: button.innerHTML,
        isVisible: button.offsetParent !== null
      }));
    });

    debugInfo('All button elements found:', { allButtons });

    // Check for Quick Settings component
    const quickSettingsInfo = await page.evaluate(() => {
      // Look for various possible selectors
      const possibleSelectors = [
        '#model-selection',
        'select[id*="model"]',
        'select[name*="model"]',
        '.quick-settings select',
        '[data-testid*="model"]'
      ];

      const results = {};
      possibleSelectors.forEach(selector => {
        try {
          const element = document.querySelector(selector);
          results[selector] = {
            found: !!element,
            visible: element ? element.offsetParent !== null : false,
            optionCount: element?.options?.length || 0
          };
        } catch (e) {
          results[selector] = { error: e.message };
        }
      });

      return results;
    });

    debugInfo('Quick Settings selectors check:', { quickSettingsInfo });

    // Check for Settings button
    const settingsButtonInfo = await page.evaluate(() => {
      const possibleSelectors = [
        'button[title="Open Settings"]',
        'button[title*="Settings"]',
        'button:has-text("Settings")',
        '[data-testid*="settings"]',
        '.settings-button'
      ];

      const results = {};
      possibleSelectors.forEach(selector => {
        try {
          const element = document.querySelector(selector);
          results[selector] = {
            found: !!element,
            visible: element ? element.offsetParent !== null : false,
            text: element?.textContent?.trim() || 'no-text'
          };
        } catch (e) {
          results[selector] = { error: e.message };
        }
      });

      return results;
    });

    debugInfo('Settings button selectors check:', { settingsButtonInfo });

    // Check if stores are accessible
    const storeInfo = await page.evaluate(() => {
      return {
        hasWindowStores: 'stores' in window,
        storeKeys: window.stores ? Object.keys(window.stores) : []
      };
    });

    debugInfo('Store info:', { storeInfo });

    // Screenshot for visual debugging
    await page.screenshot({ path: 'debug-page-state.png', fullPage: true });
    debugInfo('Screenshot saved as debug-page-state.png');

    // Don't assert anything, just investigate
  });

  test('should find model selection in Quick Settings area', async ({ page }) => {
    debugInfo('=== Looking specifically for Quick Settings ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for the Quick Settings component area
    const quickSettingsArea = await page.evaluate(() => {
      // Find any element that might contain model selection
      const possibleContainers = [
        document.querySelector('.quick-settings'),
        document.querySelector('[class*="quick"]'),
        document.querySelector('[class*="model"]'),
        document.querySelector('[data-testid*="quick"]')
      ].filter(Boolean);

      const results = [];
      possibleContainers.forEach((container, index) => {
        const selects = container.querySelectorAll('select');
        results.push({
          containerIndex: index,
          containerClass: container.className,
          containerTag: container.tagName,
          selectCount: selects.length,
          selects: Array.from(selects).map(select => ({
            id: select.id,
            name: select.name,
            optionCount: select.options.length,
            currentValue: select.value,
            options: Array.from(select.options).map(opt => opt.text)
          }))
        });
      });

      // Also check the whole document for any selects with "gpt" options
      const allSelects = Array.from(document.querySelectorAll('select'));
      const selectsWithGPT = allSelects.filter(select => {
        return Array.from(select.options).some(opt =>
          opt.text.toLowerCase().includes('gpt') || opt.value.toLowerCase().includes('gpt')
        );
      });

      return {
        quickSettingsContainers: results,
        selectsWithGPTOptions: selectsWithGPT.map(select => ({
          id: select.id,
          className: select.className,
          optionCount: select.options.length,
          gptOptions: Array.from(select.options)
            .filter(opt => opt.text.toLowerCase().includes('gpt') || opt.value.toLowerCase().includes('gpt'))
            .map(opt => ({ text: opt.text, value: opt.value }))
        }))
      };
    });

    debugInfo('Quick Settings investigation:', { quickSettingsArea });
  });
});