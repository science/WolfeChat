/**
 * Unit tests for summary loading state styling
 *
 * TDD tests for visual differentiation between loading and completed summaries:
 * - Loading state: muted/grey background
 * - Completed state: purple gradient background
 */

import { test } from '../testHarness.js';

// Test the styling logic - we'll create a utility function to determine classes
// This keeps the logic testable and the component simple

test({
  id: 'summary-style-loading-background',
  name: 'getSummaryBackgroundClasses: should return muted classes when loading',
  fn: async (assert) => {
    const { getSummaryBackgroundClasses } = await import('../../lib/summaryStyleUtils.js');

    const classes = getSummaryBackgroundClasses(true); // isLoading = true

    // Should have a muted/grey background during loading
    assert.that(classes.includes('bg-gray-800'), 'Should have grey background when loading');
    assert.that(!classes.includes('from-indigo-900'), 'Should NOT have indigo gradient when loading');
    assert.that(!classes.includes('to-purple-900'), 'Should NOT have purple gradient when loading');
  }
});

test({
  id: 'summary-style-completed-background',
  name: 'getSummaryBackgroundClasses: should return purple gradient when completed',
  fn: async (assert) => {
    const { getSummaryBackgroundClasses } = await import('../../lib/summaryStyleUtils.js');

    const classes = getSummaryBackgroundClasses(false); // isLoading = false

    // Should have the purple gradient when completed
    assert.that(classes.includes('from-indigo-900'), 'Should have indigo gradient when completed');
    assert.that(classes.includes('to-purple-900'), 'Should have purple gradient when completed');
    assert.that(classes.includes('bg-gradient-to-r'), 'Should use gradient when completed');
  }
});

test({
  id: 'summary-style-border-consistent',
  name: 'getSummaryBackgroundClasses: should include appropriate border styling',
  fn: async (assert) => {
    const { getSummaryBackgroundClasses } = await import('../../lib/summaryStyleUtils.js');

    const loadingClasses = getSummaryBackgroundClasses(true);
    const completedClasses = getSummaryBackgroundClasses(false);

    // Both states should have the left border
    assert.that(loadingClasses.includes('border-l-4'), 'Loading should have left border');
    assert.that(completedClasses.includes('border-l-4'), 'Completed should have left border');

    // Loading has muted grey border, completed has vibrant indigo border
    assert.that(loadingClasses.includes('border-gray-500'), 'Loading should have grey border');
    assert.that(completedClasses.includes('border-indigo-500'), 'Completed should have indigo border');
  }
});

test({
  id: 'summary-style-loading-has-animation',
  name: 'getSummaryBackgroundClasses: loading state should include subtle animation hint',
  fn: async (assert) => {
    const { getSummaryBackgroundClasses } = await import('../../lib/summaryStyleUtils.js');

    const classes = getSummaryBackgroundClasses(true);

    // Loading state could have a pulsing/animated border or different opacity
    // For now, just verify the border color changes to indicate loading
    assert.that(classes.includes('border-gray-500') || classes.includes('border-indigo-400'),
      'Loading should have a distinct border color');
  }
});
