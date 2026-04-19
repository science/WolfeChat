/**
 * Profiled test fixture
 *
 * Extends Playwright's test with automatic profiling when PROFILE=1 is set.
 * Wraps key helper functions with timing instrumentation.
 *
 * Usage in test files:
 *   import { test, expect } from '../profiled-test';
 *   // That's it — bootstrapLiveAPI, sendMessage, etc. are auto-profiled.
 *
 * Or for manual phase tracking:
 *   test('my test', async ({ page, profiler }) => {
 *     profiler.start('custom-phase');
 *     // ... do something ...
 *     profiler.end('custom-phase');
 *   });
 *
 * Run with:
 *   PROFILE=1 npx playwright test --project=live
 */

import { test as base, expect } from '@playwright/test';
import { createProfiler, type TestProfiler } from './profiler';

export { expect };

// Extend the base test with a profiler fixture
export const test = base.extend<{ profiler: TestProfiler }>({
  profiler: async ({ page }, use, testInfo) => {
    const profiler = createProfiler(testInfo.title);

    // Only attach network tracking if profiling is enabled
    if (process.env.PROFILE) {
      profiler.attachNetworkTracking(page);
    }

    // Wrap page.goto to auto-profile navigation
    const originalGoto = page.goto.bind(page);
    page.goto = async function (url: string, options?: any) {
      profiler.start('navigate');
      const result = await originalGoto(url, options);
      profiler.end('navigate');
      return result;
    } as typeof page.goto;

    await use(profiler);

    // Auto-report at end of test
    if (process.env.PROFILE) {
      profiler.report();
    }
  },
});
