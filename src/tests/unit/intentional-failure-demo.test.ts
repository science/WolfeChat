/**
 * Intentional Failure Test - Demo of verbose failure output
 *
 * This test intentionally fails to demonstrate that failure output is verbose and helpful.
 * SKIP THIS TEST by commenting it out after verifying failure output is good.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

// UNCOMMENT TO SEE FAILURE OUTPUT:
/*
registerTest({
  id: 'intentional-failure-demo',
  name: 'Demo: This test intentionally fails to show verbose output',
  fn: (assert) => {
    assert.that(true, 'This assertion passes');
    assert.that(true, 'This one passes too');
    assert.that(false, 'This assertion FAILS - and you should see this message clearly!');
    assert.that(true, 'This one would pass but test already failed');
  }
});
*/

// Test to verify failure output format
registerTest({
  id: 'verify-failure-output-is-verbose',
  name: 'Verify that test failures produce verbose, helpful output',
  fn: async (assert) => {
    const { formatSuiteResultsText } = await import('../testHarness.js');

    const failureResult = {
      total: 1,
      passed: 0,
      failed: 1,
      durationMs: 10,
      results: [{
        id: 'failing-test',
        name: 'Example failing test',
        success: false,
        durationMs: 10,
        assertions: 3,
        failures: 1,
        details: 'OK: First check passed\nOK: Second check passed\nFAIL: Third check failed - expected value to be 42 but got 0',
        error: new Error('Assertion failed')
      }]
    };

    const output = formatSuiteResultsText(failureResult);

    // Should show [x] marker (Rails-style)
    assert.that(output.includes('[x]'),
      'Should have [x] marker for failing tests');

    // Should show the test name
    assert.that(output.includes('Example failing test'),
      'Should show failing test name');

    // Should show the detailed failure message
    assert.that(output.includes('Third check failed - expected value to be 42 but got 0'),
      'Should show detailed failure message');

    // Should show error
    assert.that(output.includes('Assertion failed'),
      'Should show error message');

    // Should show all details (OK and FAIL lines)
    assert.that(output.includes('First check passed'),
      'Should show passing assertions for context');
  }
});
