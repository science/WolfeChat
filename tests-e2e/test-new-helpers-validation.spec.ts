import { test, expect } from '@playwright/test';
import {
  ensureSettingsClosed,
  withSettingsOpen,
  operateQuickSettings,
  mockOpenAIAPI
} from './live/helpers';
import { debugInfo } from './debug-utils';

test.describe('New Helper Functions Validation', () => {
  test.beforeEach(async ({ page }) => {
    await mockOpenAIAPI(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('ensureSettingsClosed() should safely close Settings if open', async ({ page }) => {
    debugInfo('=== Testing ensureSettingsClosed() ===');

    // First, manually open Settings
    debugInfo('Manually opening Settings...');
    const settingsButton = page.getByRole('button', { name: /^settings/i });
    await settingsButton.click();

    // Verify Settings is open
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    debugInfo('✅ Settings is open');

    // Use ensureSettingsClosed to close it
    debugInfo('Calling ensureSettingsClosed()...');
    await ensureSettingsClosed(page);

    // Verify Settings is closed
    await expect(settingsHeading).toBeHidden();
    debugInfo('✅ Settings is now closed');
  });

  test('withSettingsOpen() should open Settings and provide handle', async ({ page }) => {
    debugInfo('=== Testing withSettingsOpen() ===');

    // Use withSettingsOpen
    debugInfo('Calling withSettingsOpen()...');
    const settingsHandle = await withSettingsOpen(page);

    // Verify Settings is open
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    debugInfo('✅ Settings opened via withSettingsOpen()');

    // Use handle to close
    debugInfo('Closing via handle...');
    await settingsHandle.close();

    // Verify Settings is closed
    await expect(settingsHeading).toBeHidden();
    debugInfo('✅ Settings closed via handle');
  });

  test('operateQuickSettings() should auto-resolve Settings conflicts', async ({ page }) => {
    debugInfo('=== Testing operateQuickSettings() conflict resolution ===');

    // First, manually open Settings to create a conflict
    debugInfo('Creating Settings conflict...');
    const settingsButton = page.getByRole('button', { name: /^settings/i });
    await settingsButton.click();

    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    debugInfo('✅ Settings conflict created');

    // Now try to use operateQuickSettings - should auto-resolve conflict
    debugInfo('Calling operateQuickSettings() - should auto-resolve...');
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // Verify Settings is closed and QuickSettings is open
    await expect(settingsHeading).toBeHidden();
    debugInfo('✅ Settings auto-closed');

    const quickSettingsBody = page.locator('#quick-settings-body');
    await expect(quickSettingsBody).toBeVisible();
    debugInfo('✅ QuickSettings opened successfully');

    // Clean up
    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });

  test('Settings and QuickSettings should not be open simultaneously', async ({ page }) => {
    debugInfo('=== Testing mutual exclusion ===');

    // Open Settings first
    const settingsHandle = await withSettingsOpen(page);
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    debugInfo('✅ Settings opened');

    // Try to open QuickSettings - should auto-close Settings
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // Verify Settings is closed, QuickSettings is open
    await expect(settingsHeading).toBeHidden();
    const quickSettingsBody = page.locator('#quick-settings-body');
    await expect(quickSettingsBody).toBeVisible();
    debugInfo('✅ Mutual exclusion working - Settings closed, QuickSettings open');

    // Clean up
    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });
});