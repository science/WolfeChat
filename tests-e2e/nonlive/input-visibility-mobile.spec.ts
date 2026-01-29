/**
 * TDD RED Phase: Input Visibility Bug Reproduction
 * GitHub Issue #24: Long messages push edge of input box below visible frame
 *
 * This test should FAIL initially, proving the bug exists.
 * We capture screenshots at each step to visually verify the bug.
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Input Visibility - Issue #24', () => {

  test('textarea remains visible after auto-expand on mobile viewport', async ({ page }) => {
    // This test simulates the REALISTIC mobile scenario:
    // 1. User focuses textarea (keyboard appears, viewport shrinks)
    // 2. User types (autoExpand + scrollIntoView keeps textarea visible)

    // 1. Set mobile viewport (iPhone SE dimensions)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Screenshot: Initial state
    await page.screenshot({ path: '/tmp/issue24-01-initial-mobile.png', fullPage: false });

    // 2. Get textarea using semantic selector
    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible();

    // 3. Focus the textarea (simulates user tapping to type)
    await textarea.click({ force: true });
    await page.screenshot({ path: '/tmp/issue24-02-focused.png', fullPage: false });

    // 4. REALISTIC: Keyboard appears IMMEDIATELY when user taps textarea
    // Simulate soft keyboard appearing by reducing viewport height BEFORE typing
    await page.setViewportSize({ width: 375, height: 350 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(100);

    await page.screenshot({ path: '/tmp/issue24-03-keyboard-appeared.png', fullPage: false });

    // 5. NOW user types with keyboard visible (realistic scenario)
    const longMessage = [
      'Line 1: Testing input visibility on mobile devices',
      'Line 2: When the soft keyboard appears, the viewport shrinks',
      'Line 3: The textarea should remain visible',
      'Line 4: Even as it auto-expands with more content',
      'Line 5: This is a reproduction of GitHub Issue #24',
      'Line 6: The bug causes text to disappear below keyboard',
      'Line 7: Users cannot see what they are typing',
      'Line 8: This affects Firefox Android primarily',
    ].join('\n');

    await textarea.fill(longMessage);
    await page.waitForTimeout(200); // Allow autoExpand to process

    // Screenshot: After typing with keyboard visible
    await page.screenshot({ path: '/tmp/issue24-04-after-typing.png', fullPage: false });

    // 6. Get textarea bounding box
    const box = await textarea.boundingBox();
    const viewportHeight = 350;
    console.log('Textarea position after typing with keyboard:', JSON.stringify(box));

    if (box) {
      const textareaBottom = box.y + box.height;
      console.log(`Textarea bottom: ${textareaBottom}px, Viewport: ${viewportHeight}px`);
      console.log(`Textarea is ${textareaBottom > viewportHeight ? 'BELOW' : 'WITHIN'} visible viewport`);

      // ASSERTION: bottom of textarea must be within viewport
      expect(textareaBottom).toBeLessThanOrEqual(viewportHeight);
    } else {
      throw new Error('Could not get textarea bounding box');
    }
  });

  test('textarea scrolls into view when expanding on constrained desktop viewport', async ({ page }) => {
    // Desktop but with very constrained height (simulates issue on desktop)
    await page.setViewportSize({ width: 800, height: 400 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: '/tmp/issue24-05-desktop-initial.png', fullPage: false });

    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible();

    // Focus and type a very long message
    await textarea.click({ force: true });

    // Type enough to trigger multiple auto-expands
    const longMessage = Array(20).fill('This is a line of text that should trigger auto-expand behavior').join('\n');
    await textarea.fill(longMessage);

    // Wait for autoExpand to process
    await page.waitForTimeout(200);

    await page.screenshot({ path: '/tmp/issue24-06-desktop-after-typing.png', fullPage: false });

    // Get position info
    const box = await textarea.boundingBox();
    console.log('Desktop textarea position:', JSON.stringify(box));
    const viewportHeight = 400;
    if (box) {
      const textareaBottom = box.y + box.height;
      console.log(`Desktop: Textarea bottom: ${textareaBottom}px, Viewport: ${viewportHeight}px`);
      console.log(`Desktop: Textarea is ${textareaBottom > viewportHeight ? 'BELOW' : 'WITHIN'} visible viewport`);

      // ASSERTION: bottom of textarea must be within viewport
      expect(textareaBottom).toBeLessThanOrEqual(viewportHeight);
    } else {
      throw new Error('Could not get textarea bounding box');
    }
  });

  test('extreme case - very long message with simulated keyboard', async ({ page }) => {
    // This test simulates the exact user scenario:
    // User types on mobile, keyboard takes up screen, textarea expands and gets pushed down

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea[aria-label="Chat input"]');
    await expect(textarea).toBeVisible();
    await textarea.click({ force: true });

    await page.screenshot({ path: '/tmp/issue24-07-extreme-start.png', fullPage: false });

    // Simulate keyboard appearing FIRST (this is the realistic scenario)
    // User focuses textarea, keyboard appears, THEN they type
    await page.setViewportSize({ width: 375, height: 350 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(100);

    await page.screenshot({ path: '/tmp/issue24-08-keyboard-up-before-typing.png', fullPage: false });

    // Now type with keyboard already up
    const lines: string[] = [];
    for (let i = 1; i <= 12; i++) {
      lines.push(`Line ${i}: Typing with keyboard visible - testing auto-expand behavior`);
    }

    await textarea.fill(lines.join('\n'));
    await page.waitForTimeout(200);

    await page.screenshot({ path: '/tmp/issue24-09-extreme-final.png', fullPage: false });

    // Check position
    const box = await textarea.boundingBox();
    console.log('Extreme case - textarea position:', JSON.stringify(box));
    const viewportHeight = 350;
    if (box) {
      const textareaBottom = box.y + box.height;
      console.log(`Extreme: Textarea bottom: ${textareaBottom}px, Viewport: ${viewportHeight}px`);

      // Also check if cursor area (bottom of textarea) is visible
      // The actual typed text appears at the bottom of the textarea
      const cursorY = box.y + box.height; // Bottom of textarea where cursor is
      console.log(`Cursor position Y: ${cursorY}px`);
      console.log(`Cursor is ${cursorY > viewportHeight ? 'BELOW KEYBOARD (BUG!)' : 'VISIBLE (OK)'}`);

      // ASSERTION: bottom of textarea (where cursor is) must be within viewport
      expect(textareaBottom).toBeLessThanOrEqual(viewportHeight);
    } else {
      throw new Error('Could not get textarea bounding box');
    }
  });

});
