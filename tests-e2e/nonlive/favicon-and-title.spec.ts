/**
 * Favicon and Page Title Tests
 *
 * Tests for:
 * 1. Favicon should load without 404
 * 2. Page title should follow "WolfeChat: [chat title]" format
 */

import { test, expect } from '@playwright/test';

test.describe('Favicon', () => {

  test('should have a valid favicon href that loads successfully', async ({ page }) => {
    // Track all network responses for favicon-related requests
    const faviconResponses: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('favicon') || url.includes('.ico')) {
        faviconResponses.push({ url, status: response.status() });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify the favicon link element has a valid non-empty href pointing to an actual icon file
    const faviconLink = page.locator('link[rel="icon"]');
    const faviconHref = await faviconLink.getAttribute('href');

    // The href must be non-empty and point to an actual icon file
    expect(faviconHref, 'Favicon href should not be empty').toBeTruthy();
    expect(faviconHref, 'Favicon href should not be empty string').not.toBe('');
    expect(faviconHref, 'Favicon should point to an SVG or ICO file').toMatch(/\.(svg|ico|png)$/);

    // Check that any favicon.ico request didn't 404
    const failed404 = faviconResponses.find(r => r.status === 404);
    expect(failed404, 'No favicon requests should return 404').toBeUndefined();
  });

});

test.describe('Page Title', () => {

  test('should show "WolfeChat" for new conversation without title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    // New conversation has no title, so page title should just be "WolfeChat"
    expect(title).toBe('WolfeChat');
  });

  test('should show "WolfeChat: [chat title]" when conversation has a title', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up a conversation with a title in localStorage before page loads
    await context.addInitScript(() => {
      const conversation = {
        id: 'test-123',
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        conversationTokens: 100,
        assistantRole: '',
        title: 'My Test Chat'
      };
      localStorage.setItem('conversations', JSON.stringify([conversation]));
      localStorage.setItem('chosenConversation', JSON.stringify(0));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    // Page title should be "WolfeChat: My Test Chat"
    expect(title).toBe('WolfeChat: My Test Chat');

    await context.close();
  });

});
