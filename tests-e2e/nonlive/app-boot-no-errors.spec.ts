/**
 * App Boot Error Test
 *
 * Verifies that the app boots without JavaScript errors.
 * This catches ASI (Automatic Semicolon Insertion) bugs and other syntax issues.
 */

import { test, expect } from '@playwright/test';

test.describe('App Boot', () => {

  test('should boot without JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];

    // Capture all JavaScript errors
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no JS errors occurred during boot
    expect(jsErrors, `JavaScript errors during boot: ${jsErrors.join(', ')}`).toHaveLength(0);

    // Also verify the app actually rendered
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

});
