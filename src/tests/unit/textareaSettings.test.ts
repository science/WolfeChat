import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';

// Storage keys used by the store
const MAX_HEIGHT_KEY = 'textarea_max_height';
const MIN_HEIGHT_KEY = 'textarea_min_height';

// Expected defaults
const DEFAULT_MAX_HEIGHT = 288;
const DEFAULT_MIN_HEIGHT = 96;

// Expected bounds
const EXPECTED_MAX_HEIGHT_BOUNDS = { min: 100, max: 600 };
const EXPECTED_MIN_HEIGHT_BOUNDS = { min: 32, max: 200 };

registerTest({
  id: 'textarea-max-height-default',
  name: 'textareaMaxHeight has default value of 288',
  fn: async (assert) => {
    // Clear localStorage to ensure default
    localStorage.removeItem(MAX_HEIGHT_KEY);

    // Re-import to get fresh store
    const { textareaMaxHeight } = await import('../../stores/textareaSettings.js');
    const value = get(textareaMaxHeight);

    assert.that(value === DEFAULT_MAX_HEIGHT, `Expected default max height of ${DEFAULT_MAX_HEIGHT}, got ${value}`);
  }
});

registerTest({
  id: 'textarea-min-height-default',
  name: 'textareaMinHeight has default value of 96',
  fn: async (assert) => {
    // Clear localStorage to ensure default
    localStorage.removeItem(MIN_HEIGHT_KEY);

    // Re-import to get fresh store
    const { textareaMinHeight } = await import('../../stores/textareaSettings.js');
    const value = get(textareaMinHeight);

    assert.that(value === DEFAULT_MIN_HEIGHT, `Expected default min height of ${DEFAULT_MIN_HEIGHT}, got ${value}`);
  }
});

registerTest({
  id: 'textarea-max-height-persistence',
  name: 'textareaMaxHeight persists to localStorage when updated',
  fn: async (assert) => {
    const { textareaMaxHeight } = await import('../../stores/textareaSettings.js');
    const testValue = 250;

    textareaMaxHeight.set(testValue);

    const stored = localStorage.getItem(MAX_HEIGHT_KEY);
    assert.that(stored === String(testValue), `Expected localStorage to contain "${testValue}", got "${stored}"`);

    // Reset to default
    textareaMaxHeight.set(DEFAULT_MAX_HEIGHT);
  }
});

registerTest({
  id: 'textarea-min-height-persistence',
  name: 'textareaMinHeight persists to localStorage when updated',
  fn: async (assert) => {
    const { textareaMinHeight } = await import('../../stores/textareaSettings.js');
    const testValue = 64;

    textareaMinHeight.set(testValue);

    const stored = localStorage.getItem(MIN_HEIGHT_KEY);
    assert.that(stored === String(testValue), `Expected localStorage to contain "${testValue}", got "${stored}"`);

    // Reset to default
    textareaMinHeight.set(DEFAULT_MIN_HEIGHT);
  }
});

registerTest({
  id: 'textarea-max-height-bounds-exported',
  name: 'MAX_HEIGHT_BOUNDS is exported with correct values',
  fn: async (assert) => {
    const { MAX_HEIGHT_BOUNDS } = await import('../../stores/textareaSettings.js');

    assert.that(MAX_HEIGHT_BOUNDS.min === EXPECTED_MAX_HEIGHT_BOUNDS.min,
      `Expected MAX_HEIGHT_BOUNDS.min to be ${EXPECTED_MAX_HEIGHT_BOUNDS.min}, got ${MAX_HEIGHT_BOUNDS.min}`);
    assert.that(MAX_HEIGHT_BOUNDS.max === EXPECTED_MAX_HEIGHT_BOUNDS.max,
      `Expected MAX_HEIGHT_BOUNDS.max to be ${EXPECTED_MAX_HEIGHT_BOUNDS.max}, got ${MAX_HEIGHT_BOUNDS.max}`);
  }
});

registerTest({
  id: 'textarea-min-height-bounds-exported',
  name: 'MIN_HEIGHT_BOUNDS is exported with correct values',
  fn: async (assert) => {
    const { MIN_HEIGHT_BOUNDS } = await import('../../stores/textareaSettings.js');

    assert.that(MIN_HEIGHT_BOUNDS.min === EXPECTED_MIN_HEIGHT_BOUNDS.min,
      `Expected MIN_HEIGHT_BOUNDS.min to be ${EXPECTED_MIN_HEIGHT_BOUNDS.min}, got ${MIN_HEIGHT_BOUNDS.min}`);
    assert.that(MIN_HEIGHT_BOUNDS.max === EXPECTED_MIN_HEIGHT_BOUNDS.max,
      `Expected MIN_HEIGHT_BOUNDS.max to be ${EXPECTED_MIN_HEIGHT_BOUNDS.max}, got ${MIN_HEIGHT_BOUNDS.max}`);
  }
});
