/**
 * Debug QuickSettings Click
 *
 * See what actually happens when we click the QuickSettings button
 */

import { test, expect } from '@playwright/test';

test.describe('Debug QuickSettings Click', () => {
  test('should examine DOM changes when clicking QuickSettings', async ({ page }) => {
    console.log('=== Debugging QuickSettings Click ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check initial DOM state
    console.log('STEP 1: Initial DOM state');
    const initialDOM = await page.evaluate(() => {
      return {
        allSelects: Array.from(document.querySelectorAll('select')).map(s => ({
          id: s.id,
          className: s.className,
          visible: s.offsetParent !== null
        })),
        allInputs: Array.from(document.querySelectorAll('input')).map(i => ({
          id: i.id,
          type: i.type,
          className: i.className,
          visible: i.offsetParent !== null
        })),
        quickSettingsArea: (() => {
          const button = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent?.includes('Quick Settings')
          );
          return {
            found: !!button,
            text: button?.textContent,
            nextSibling: button?.nextElementSibling?.tagName,
            parent: button?.parentElement?.className
          };
        })()
      };
    });

    console.log('Initial DOM:', JSON.stringify(initialDOM, null, 2));

    // Click the QuickSettings button
    console.log('STEP 2: Click QuickSettings button');
    const quickSettingsButton = await page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    await quickSettingsButton.click();

    // Wait a moment for any changes
    await page.waitForTimeout(1000);

    // Check DOM state after click
    console.log('STEP 3: DOM state after click');
    const afterClickDOM = await page.evaluate(() => {
      return {
        allSelects: Array.from(document.querySelectorAll('select')).map(s => ({
          id: s.id,
          className: s.className,
          visible: s.offsetParent !== null,
          optionCount: s.options.length
        })),
        allInputs: Array.from(document.querySelectorAll('input')).map(i => ({
          id: i.id,
          type: i.type,
          className: i.className,
          visible: i.offsetParent !== null
        })),
        quickSettingsArea: (() => {
          const button = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent?.includes('Quick Settings')
          );
          return {
            found: !!button,
            text: button?.textContent,
            nextSibling: button?.nextElementSibling?.tagName,
            nextSiblingClass: button?.nextElementSibling?.className,
            nextSiblingVisible: button?.nextElementSibling?.offsetParent !== null,
            parent: button?.parentElement?.className
          };
        })(),
        // Look for any elements that might have appeared
        hiddenElements: Array.from(document.querySelectorAll('[style*="display"]')).map(el => ({
          tagName: el.tagName,
          className: el.className,
          style: el.getAttribute('style')
        }))
      };
    });

    console.log('After click DOM:', JSON.stringify(afterClickDOM, null, 2));

    // Compare the two states
    const selectCountBefore = initialDOM.allSelects.length;
    const selectCountAfter = afterClickDOM.allSelects.length;
    const inputCountBefore = initialDOM.allInputs.length;
    const inputCountAfter = afterClickDOM.allInputs.length;

    console.log(`Select elements: ${selectCountBefore} → ${selectCountAfter}`);
    console.log(`Input elements: ${inputCountBefore} → ${inputCountAfter}`);

    if (selectCountAfter > selectCountBefore) {
      console.log('✅ New select elements appeared after click');
    } else if (selectCountAfter === selectCountBefore && selectCountBefore === 0) {
      console.log('🚨 ISSUE: Still no select elements after clicking QuickSettings');
    }

    // Check if button text changed (might indicate expansion state)
    const buttonTextBefore = initialDOM.quickSettingsArea.text;
    const buttonTextAfter = afterClickDOM.quickSettingsArea.text;

    if (buttonTextBefore !== buttonTextAfter) {
      console.log(`Button text changed: "${buttonTextBefore}" → "${buttonTextAfter}"`);
    } else {
      console.log('Button text unchanged - might not be expanding properly');
    }

    // Take screenshot after click for visual debugging
    await page.screenshot({ path: 'quicksettings-after-click.png', fullPage: true });
    console.log('Screenshot saved as quicksettings-after-click.png');
  });

  test('should examine QuickSettings component source', async ({ page }) => {
    console.log('=== Examining QuickSettings Component ===');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for the QuickSettings component structure
    const componentStructure = await page.evaluate(() => {
      // Find the QuickSettings button and examine its context
      const button = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Quick Settings')
      );

      if (!button) return { error: 'QuickSettings button not found' };

      const getElementInfo = (el) => {
        if (!el) return null;
        return {
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          innerHTML: el.innerHTML?.substring(0, 200) + (el.innerHTML?.length > 200 ? '...' : ''),
          childCount: el.children.length,
          children: Array.from(el.children).map(child => ({
            tagName: child.tagName,
            className: child.className,
            id: child.id
          }))
        };
      };

      return {
        button: getElementInfo(button),
        parent: getElementInfo(button.parentElement),
        grandparent: getElementInfo(button.parentElement?.parentElement),
        siblings: Array.from(button.parentElement?.children || []).map(getElementInfo),
        // Look for any Svelte component indicators
        svelteComponents: Array.from(document.querySelectorAll('[class*="svelte"]')).map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id
        })).slice(0, 10) // Limit output
      };
    });

    console.log('Component structure:', JSON.stringify(componentStructure, null, 2));
  });
});