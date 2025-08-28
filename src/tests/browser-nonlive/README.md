# Browser Non-Live Tests

This directory contains tests that require a real browser environment but do not need internet connectivity.

## Characteristics
- Require a real browser with full DOM/layout capabilities
- Need Svelte components to be properly mounted and rendered
- Depend on accurate CSS layout and scroll measurements
- May test UI interactions and visual behavior
- Do not require network connectivity

## Running Tests
**Note: Browser test infrastructure is not yet implemented. These tests are separated for future implementation.**

Once implemented, tests will be run using:
```bash
# Run browser tests (future)
npm run test:browser
# or
node run-tests.mjs --suite browser-nonlive
```

## Test Files
- `chatStreamingScrollAppLike.test.ts` - App-like streaming scroll behavior with real layout
- `conversationNavigationAnchors.test.ts` - Quick Settings UI navigation between conversation turns
- `reasoningWindowsPlacement.test.ts` - Reasoning windows UI placement and behavior

## Future Implementation
These tests will require:
1. A browser automation framework (e.g., Playwright, Puppeteer)
2. A test server to serve the Svelte app
3. Proper Svelte component mounting
4. Real browser DOM and layout engine

## Writing Browser Tests
Browser tests should:
- Test full UI interactions and visual behavior
- Verify correct rendering and layout
- Test scroll behavior with accurate measurements
- Validate component lifecycle and state management

Example (future):
```typescript
import { test, expect } from '@playwright/test';

test('Quick Settings navigation works', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('[aria-controls="quick-settings-body"]');
  await expect(page.locator('#quick-settings-body')).toBeVisible();
  await page.click('button:has-text("Up")');
  // ... verify scroll position changed
});
```