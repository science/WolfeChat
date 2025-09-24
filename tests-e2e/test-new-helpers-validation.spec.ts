import { test, expect } from '@playwright/test';
import {
  ensureSettingsClosed,
  withSettingsOpen,
  operateQuickSettings,
  mockOpenAIAPI
} from './live/helpers';

test.describe('New Helper Functions Validation', () => {
  test.beforeEach(async ({ page }) => {
    await mockOpenAIAPI(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('ensureSettingsClosed() should safely close Settings if open', async ({ page }) => {
    console.log('=== Testing ensureSettingsClosed() ===');

    // First, manually open Settings
    console.log('Manually opening Settings...');
    const settingsButton = page.getByRole('button', { name: /^settings/i });
    await settingsButton.click();

    // Verify Settings is open
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    console.log('✅ Settings is open');

    // Use ensureSettingsClosed to close it
    console.log('Calling ensureSettingsClosed()...');
    await ensureSettingsClosed(page);

    // Verify Settings is closed
    await expect(settingsHeading).toBeHidden();
    console.log('✅ Settings is now closed');
  });

  test('withSettingsOpen() should open Settings and provide handle', async ({ page }) => {
    console.log('=== Testing withSettingsOpen() ===');

    // Use withSettingsOpen
    console.log('Calling withSettingsOpen()...');
    const settingsHandle = await withSettingsOpen(page);

    // Verify Settings is open
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    console.log('✅ Settings opened via withSettingsOpen()');

    // Use handle to close
    console.log('Closing via handle...');
    await settingsHandle.close();

    // Verify Settings is closed
    await expect(settingsHeading).toBeHidden();
    console.log('✅ Settings closed via handle');
  });

  test('operateQuickSettings() should auto-resolve Settings conflicts', async ({ page }) => {
    console.log('=== Testing operateQuickSettings() conflict resolution ===');

    // First, manually open Settings to create a conflict
    console.log('Creating Settings conflict...');
    const settingsButton = page.getByRole('button', { name: /^settings/i });
    await settingsButton.click();

    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    console.log('✅ Settings conflict created');

    // Now try to use operateQuickSettings - should auto-resolve conflict
    console.log('Calling operateQuickSettings() - should auto-resolve...');
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // Verify Settings is closed and QuickSettings is open
    await expect(settingsHeading).toBeHidden();
    console.log('✅ Settings auto-closed');

    const quickSettingsBody = page.locator('#quick-settings-body');
    await expect(quickSettingsBody).toBeVisible();
    console.log('✅ QuickSettings opened successfully');

    // Clean up
    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });

  test('Settings and QuickSettings should not be open simultaneously', async ({ page }) => {
    console.log('=== Testing mutual exclusion ===');

    // Open Settings first
    const settingsHandle = await withSettingsOpen(page);
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
    console.log('✅ Settings opened');

    // Try to open QuickSettings - should auto-close Settings
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // Verify Settings is closed, QuickSettings is open
    await expect(settingsHeading).toBeHidden();
    const quickSettingsBody = page.locator('#quick-settings-body');
    await expect(quickSettingsBody).toBeVisible();
    console.log('✅ Mutual exclusion working - Settings closed, QuickSettings open');

    // Clean up
    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });
});