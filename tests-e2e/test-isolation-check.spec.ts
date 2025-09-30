import { test, expect } from '@playwright/test';
import { debugInfo } from './debug-utils';

test.describe('Test isolation check', () => {
  test('test 1 - set localStorage', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'value-from-test-1');
    });
    const value = await page.evaluate(() => localStorage.getItem('test-key'));
    debugInfo('Test 1 localStorage:', { value });
    expect(value).toBe('value-from-test-1');
  });

  test('test 2 - check if localStorage persists', async ({ page }) => {
    await page.goto('http://localhost:5173');
    const value = await page.evaluate(() => localStorage.getItem('test-key'));
    debugInfo('Test 2 localStorage:', { value });
    // If null, tests are isolated. If 'value-from-test-1', they share context
    debugInfo('Tests are', { isolation: value === null ? 'ISOLATED' : 'SHARED' });
  });
});