/**
 * Unit tests for icon styling consistency
 *
 * TDD tests to ensure all toolbelt icons use consistent styling:
 * - Grey/white color scheme (not black)
 * - Hover state increases brightness
 * - Consistent filter values across all icons
 */

import { test } from '../testHarness.js';

test({
  id: 'icon-style-toolbelt-default',
  name: 'getToolbeltIconClasses: should return grey filter classes for default state',
  fn: async (assert) => {
    const { getToolbeltIconClasses } = await import('../../lib/iconStyleUtils.js');

    const classes = getToolbeltIconClasses();

    // Should include filter to make icons grey/white
    assert.that(classes.includes('toolbelt-icon'), 'Should have toolbelt-icon class');
    assert.that(!classes.includes('opacity-60'), 'Should NOT use opacity for color (use filter instead)');
  }
});

test({
  id: 'icon-style-toolbelt-size',
  name: 'getToolbeltIconClasses: should include size classes',
  fn: async (assert) => {
    const { getToolbeltIconClasses } = await import('../../lib/iconStyleUtils.js');

    const classes = getToolbeltIconClasses();

    // Should have consistent size
    assert.that(classes.includes('w-4') || classes.includes('w-5'), 'Should have width class');
    assert.that(classes.includes('h-4') || classes.includes('h-5'), 'Should have height class');
  }
});

test({
  id: 'icon-style-summary-toolbelt',
  name: 'getSummaryToolbeltIconClasses: should return classes for summary box icons',
  fn: async (assert) => {
    const { getSummaryToolbeltIconClasses } = await import('../../lib/iconStyleUtils.js');

    const classes = getSummaryToolbeltIconClasses();

    // Summary icons should also use filter for consistent grey/white styling
    assert.that(classes.includes('summary-toolbelt-icon'), 'Should have summary-toolbelt-icon class');
    assert.that(classes.includes('w-4'), 'Should have w-4 for smaller size in summary');
    assert.that(classes.includes('h-4'), 'Should have h-4 for smaller size in summary');
  }
});

test({
  id: 'icon-style-summarize-button',
  name: 'getSummarizeButtonIconClasses: should return classes for summarize button icon',
  fn: async (assert) => {
    const { getSummarizeButtonIconClasses } = await import('../../lib/iconStyleUtils.js');

    const classes = getSummarizeButtonIconClasses();

    // Summarize button icon should match other toolbelt icons
    assert.that(classes.includes('summarize-icon'), 'Should have summarize-icon class');
    assert.that(classes.includes('toolbelt-icon'), 'Should also have toolbelt-icon for consistent styling');
  }
});
