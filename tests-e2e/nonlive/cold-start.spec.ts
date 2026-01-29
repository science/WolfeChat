/**
 * Cold Start Tests
 *
 * These tests verify the app can boot successfully in various localStorage states,
 * simulating new users and edge cases like corrupted data.
 *
 * Unlike other tests that do `goto('/') -> localStorage.clear() -> reload()`,
 * these tests use Playwright's `context.addInitScript()` to set up localStorage
 * BEFORE the page loads, testing true cold-start scenarios.
 */

import { test, expect } from '@playwright/test';

test.describe('Cold Start - New User Experience', () => {

  test('app boots successfully with completely empty localStorage', async ({ browser }) => {
    // Create a fresh context with no storage
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to app - this is a true cold start with empty localStorage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should not crash - verify basic UI elements are present
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Settings button should be accessible (use specific selector to avoid Quick Settings match)
    const settingsButton = page.getByRole('button', { name: /^settings/i });
    await expect(settingsButton.first()).toBeVisible();

    await context.close();
  });

  test('app boots successfully with corrupted api_key in localStorage', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set corrupted localStorage BEFORE page loads
    await context.addInitScript(() => {
      // Simulate corrupted api_key (raw string, not JSON-encoded)
      localStorage.setItem('api_key', 'sk-corrupted-not-json');
    });

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should not crash - verify basic UI elements are present
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('app boots successfully with corrupted openai_api_key in localStorage', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set corrupted localStorage BEFORE page loads
    await context.addInitScript(() => {
      // Simulate corrupted openai_api_key (raw string, not JSON-encoded)
      localStorage.setItem('openai_api_key', 'sk-corrupted-not-json');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('app boots successfully with corrupted anthropic_api_key in localStorage', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await context.addInitScript(() => {
      localStorage.setItem('anthropic_api_key', 'sk-ant-corrupted-not-json');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('app boots with various malformed localStorage values', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set multiple malformed values BEFORE page loads
    await context.addInitScript(() => {
      // Various corruption scenarios
      localStorage.setItem('api_key', 'undefined');  // String "undefined"
      localStorage.setItem('openai_api_key', '');    // Empty string
      localStorage.setItem('anthropic_api_key', 'null');  // String "null" (not JSON null)
      localStorage.setItem('selectedModel', '');     // Empty model
      localStorage.setItem('conversations', '{invalid json}');  // Malformed JSON
      localStorage.setItem('textarea_max_height', 'not-a-number');  // Invalid number
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should handle all corruption gracefully
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('new user can open Settings and configure API key', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open Settings (use specific selector to avoid Quick Settings match)
    const settingsButton = page.getByRole('button', { name: /^settings/i }).first();
    await settingsButton.click({ force: true });

    // Settings modal should open
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();

    // API key input should be visible and empty for new user
    const apiInput = page.locator('#api-key');
    await expect(apiInput).toBeVisible();

    // New user can type an API key
    await apiInput.fill('sk-test-new-user-key');

    // Save button should be available
    const saveButton = page.getByRole('button', { name: /^save$/i });
    await expect(saveButton).toBeVisible();

    await context.close();
  });

});
