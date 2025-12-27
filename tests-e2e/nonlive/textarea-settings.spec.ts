/**
 * E2E tests for textarea size settings
 *
 * Tests that users can configure the min and max height of the input textarea
 * through the Settings UI.
 */

import { test, expect } from '@playwright/test';
import { openSettings, saveAndCloseSettings } from '../live/helpers';

test.describe('Textarea Size Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure default values
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Settings: shows textarea height controls', async ({ page }) => {
    await openSettings(page);

    // Verify both controls exist
    const maxHeightInput = page.locator('#textarea-max-height');
    const minHeightInput = page.locator('#textarea-min-height');

    await expect(maxHeightInput).toBeVisible();
    await expect(minHeightInput).toBeVisible();

    await saveAndCloseSettings(page);
  });

  test('Settings: max height has default value of 288', async ({ page }) => {
    await openSettings(page);

    const maxHeightInput = page.locator('#textarea-max-height');
    await expect(maxHeightInput).toHaveValue('288');

    await saveAndCloseSettings(page);
  });

  test('Settings: min height has default value of 96', async ({ page }) => {
    await openSettings(page);

    const minHeightInput = page.locator('#textarea-min-height');
    await expect(minHeightInput).toHaveValue('96');

    await saveAndCloseSettings(page);
  });

  test('Settings: max height can be changed and persists', async ({ page }) => {
    await openSettings(page);

    const maxHeightInput = page.locator('#textarea-max-height');
    await maxHeightInput.fill('200');

    await saveAndCloseSettings(page);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    await openSettings(page);
    await expect(page.locator('#textarea-max-height')).toHaveValue('200');

    await saveAndCloseSettings(page);
  });

  test('Settings: min height can be changed and persists', async ({ page }) => {
    await openSettings(page);

    const minHeightInput = page.locator('#textarea-min-height');
    await minHeightInput.fill('64');

    await saveAndCloseSettings(page);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    await openSettings(page);
    await expect(page.locator('#textarea-min-height')).toHaveValue('64');

    await saveAndCloseSettings(page);
  });

  test('Textarea respects max height setting when expanding', async ({ page }) => {
    // Set max height to 150
    await openSettings(page);
    const maxHeightInput = page.locator('#textarea-max-height');
    await maxHeightInput.fill('150');
    await saveAndCloseSettings(page);

    // Type enough text to trigger auto-expand
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible();

    // Fill with many lines to trigger expansion
    const longMessage = Array(20).fill('This is a line of text that should trigger auto-expand').join('\n');
    await textarea.fill(longMessage);

    // Wait for autoExpand to process
    await page.waitForTimeout(200);

    // Verify height is capped at max
    const height = await textarea.evaluate(el => el.offsetHeight);
    expect(height).toBeLessThanOrEqual(155); // Allow small tolerance for borders
  });

  test('Textarea uses min height as initial height', async ({ page }) => {
    // Set min height to 120
    await openSettings(page);
    const minHeightInput = page.locator('#textarea-min-height');
    await minHeightInput.fill('120');
    await saveAndCloseSettings(page);

    // Reload to apply the new min height
    await page.reload();
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible();

    // Verify initial height matches min height
    const height = await textarea.evaluate(el => el.offsetHeight);
    expect(height).toBeGreaterThanOrEqual(115); // Allow tolerance for borders
    expect(height).toBeLessThanOrEqual(130);
  });

  test('Settings: max height input has valid bounds (100-600)', async ({ page }) => {
    await openSettings(page);

    const maxHeightInput = page.locator('#textarea-max-height');

    // Check that the input has min/max attributes
    const min = await maxHeightInput.getAttribute('min');
    const max = await maxHeightInput.getAttribute('max');

    expect(min).toBe('100');
    expect(max).toBe('600');

    await saveAndCloseSettings(page);
  });

  test('Settings: min height input has valid bounds (32-200)', async ({ page }) => {
    await openSettings(page);

    const minHeightInput = page.locator('#textarea-min-height');

    // Check that the input has min/max attributes
    const min = await minHeightInput.getAttribute('min');
    const max = await minHeightInput.getAttribute('max');

    expect(min).toBe('32');
    expect(max).toBe('200');

    await saveAndCloseSettings(page);
  });
});
