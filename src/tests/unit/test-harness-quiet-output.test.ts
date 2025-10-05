/**
 * Unit Test: Test Harness Quiet Output
 *
 * Tests that the test harness produces minimal output for passing tests
 * and detailed output for failing tests (like Rails dot notation)
 */

import { registerTest } from '../testHarness.js';

registerTest({
  id: 'test-harness-quiet-success-format',
  name: 'Test harness should format passing tests quietly',
  fn: async (assert) => {
    // Import the formatting functions
    const { formatSuiteResultsText } = await import('../testHarness.js');

    // Create a mock suite result with passing tests
    const mockSuiteResult = {
      total: 3,
      passed: 3,
      failed: 0,
      durationMs: 100,
      results: [
        {
          id: 'test-1',
          name: 'First passing test',
          success: true,
          durationMs: 10,
          assertions: 5,
          failures: 0,
          details: 'OK: assertion 1\nOK: assertion 2\nOK: assertion 3\nOK: assertion 4\nOK: assertion 5'
        },
        {
          id: 'test-2',
          name: 'Second passing test',
          success: true,
          durationMs: 20,
          assertions: 3,
          failures: 0,
          details: 'OK: assertion A\nOK: assertion B\nOK: assertion C'
        },
        {
          id: 'test-3',
          name: 'Third passing test',
          success: true,
          durationMs: 15,
          assertions: 2,
          failures: 0,
          details: 'OK: simple check\nOK: another check'
        }
      ]
    };

    const output = formatSuiteResultsText(mockSuiteResult);

    // The output should NOT contain all the "OK:" assertion details for passing tests
    const okLineCount = (output.match(/OK:/g) || []).length;
    assert.that(okLineCount === 0,
      'Passing test output should not contain OK: assertion details');

    // The output SHOULD contain the summary
    assert.that(output.includes('Total: 3 | Passed: 3 | Failed: 0'),
      'Output should contain test summary');

    // Rails-style: passing tests should NOT show names (just symbols)
    assert.that(!output.includes('First passing test'),
      'Passing tests should not show names (Rails-style compression)');

    // Should have compressed checkmarks
    const checkmarkCount = (output.match(/✓/g) || []).length;
    assert.that(checkmarkCount === 3,
      'Should have 3 checkmarks for 3 passing tests');
  }
});

registerTest({
  id: 'test-harness-verbose-failure-format',
  name: 'Test harness should format failing tests verbosely',
  fn: async (assert) => {
    const { formatSuiteResultsText } = await import('../testHarness.js');

    // Create a mock suite result with a failing test
    const mockSuiteResult = {
      total: 2,
      passed: 1,
      failed: 1,
      durationMs: 100,
      results: [
        {
          id: 'test-pass',
          name: 'Passing test',
          success: true,
          durationMs: 10,
          assertions: 2,
          failures: 0,
          details: 'OK: check 1\nOK: check 2'
        },
        {
          id: 'test-fail',
          name: 'Failing test',
          success: false,
          durationMs: 20,
          assertions: 3,
          failures: 1,
          details: 'OK: first assertion\nFAIL: second assertion failed here\nOK: third assertion',
          error: new Error('Test failed due to assertion failure')
        }
      ]
    };

    const output = formatSuiteResultsText(mockSuiteResult);

    // Should NOT show OK details from passing test
    const passingOkCount = (output.match(/OK: check/g) || []).length;
    assert.that(passingOkCount === 0,
      'Should not show OK details from passing tests');

    // SHOULD show FAIL details from failing test
    assert.that(output.includes('FAIL: second assertion failed here'),
      'Should show FAIL details from failing tests');

    // Should show the error message
    assert.that(output.includes('Test failed due to assertion failure'),
      'Should show error message for failing tests');

    // Should still show test names
    assert.that(output.includes('Failing test'),
      'Should show failing test name');
  }
});

registerTest({
  id: 'test-harness-progress-indicator',
  name: 'Test harness should show progress for passing tests',
  fn: async (assert) => {
    const { formatSuiteResultsText } = await import('../testHarness.js');

    const mockSuiteResult = {
      total: 5,
      passed: 5,
      failed: 0,
      durationMs: 50,
      results: Array(5).fill(null).map((_, i) => ({
        id: `test-${i}`,
        name: `Test ${i}`,
        success: true,
        durationMs: 10,
        assertions: 1,
        failures: 0,
        details: 'OK: assertion'
      }))
    };

    const output = formatSuiteResultsText(mockSuiteResult);

    // Should show some form of progress (dots, checkmarks, or compact PASS indicators)
    // But NOT verbose OK: lines
    const okLines = (output.match(/OK:/g) || []).length;
    assert.that(okLines === 0,
      'Should not show verbose OK: lines for passing tests');

    // Should have the summary
    assert.that(output.includes('Total: 5 | Passed: 5'),
      'Should show summary');
  }
});

registerTest({
  id: 'test-harness-rails-style-compression',
  name: 'Test harness should compress passing tests like Rails (dots inline)',
  fn: async (assert) => {
    const { formatSuiteResultsText } = await import('../testHarness.js');

    // Create 10 passing tests
    const mockSuiteResult = {
      total: 10,
      passed: 10,
      failed: 0,
      durationMs: 100,
      results: Array(10).fill(null).map((_, i) => ({
        id: `test-${i}`,
        name: `Test ${i}`,
        success: true,
        durationMs: 10,
        assertions: 1,
        failures: 0,
        details: 'OK: assertion'
      }))
    };

    const output = formatSuiteResultsText(mockSuiteResult);
    const lines = output.split('\n');

    // Count how many lines have checkmarks
    const checkmarkLines = lines.filter(line => line.includes('✓')).length;

    // Should compress into fewer lines than number of tests
    // Rails style: ✓✓✓✓✓✓✓✓✓✓ on one line instead of 10 lines
    assert.that(checkmarkLines < 10,
      'Should compress 10 passing tests into fewer than 10 lines (Rails style)');

    // Should have at least one line with multiple checkmarks
    const hasCompressedLine = lines.some(line => (line.match(/✓/g) || []).length > 1);
    assert.that(hasCompressedLine,
      'Should have at least one line with multiple checkmarks (e.g., ✓✓✓)');
  }
});

registerTest({
  id: 'test-harness-failures-not-compressed',
  name: 'Test harness should NOT compress failures (keep verbose)',
  fn: async (assert) => {
    const { formatSuiteResultsText } = await import('../testHarness.js');

    const mockSuiteResult = {
      total: 3,
      passed: 2,
      failed: 1,
      durationMs: 50,
      results: [
        {
          id: 'test-1',
          name: 'First passing test',
          success: true,
          durationMs: 10,
          assertions: 1,
          failures: 0,
          details: 'OK: check'
        },
        {
          id: 'test-fail',
          name: 'Failing test',
          success: false,
          durationMs: 20,
          assertions: 2,
          failures: 1,
          details: 'OK: first check\nFAIL: This is the failure',
          error: new Error('Test failed')
        },
        {
          id: 'test-3',
          name: 'Third passing test',
          success: true,
          durationMs: 10,
          assertions: 1,
          failures: 0,
          details: 'OK: check'
        }
      ]
    };

    const output = formatSuiteResultsText(mockSuiteResult);

    // Failure should have its own section with full details
    assert.that(output.includes('Failing test'),
      'Should show failing test name');

    assert.that(output.includes('FAIL: This is the failure'),
      'Should show failure details');

    assert.that(output.includes('Test failed'),
      'Should show error message');

    // Passing tests should be compressed (checkmarks without verbose details)
    const totalCheckmarks = output.match(/✓/g)?.length || 0;
    assert.that(totalCheckmarks === 2,
      'Should have 2 checkmarks for 2 passing tests');

    // Should NOT have verbose test names for passing tests (like "✓ Test name")
    assert.that(!output.includes('✓ First passing test'),
      'Should not show full test name for passing tests');

    assert.that(!output.includes('✓ Third passing test'),
      'Should not show full test name for passing tests');

    // Just checkmarks (compressed), not "✓ Test Name" (verbose)
    const hasVerbosePassingOutput = output.match(/✓\s+\w+\s+\w+\s+test/i);
    assert.that(!hasVerbosePassingOutput,
      'Passing tests should show just ✓, not "✓ Test Name"');
  }
});
