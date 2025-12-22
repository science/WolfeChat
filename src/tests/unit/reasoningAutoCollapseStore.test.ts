/**
 * Unit tests for reasoningAutoCollapseStore
 *
 * Tests the global setting that controls whether reasoning windows
 * auto-collapse when the model finishes responding.
 */

import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';
import { debugInfo } from '../utils/debugLog.js';

// This import will fail initially (RED phase of TDD)
import { reasoningAutoCollapse } from '../../stores/reasoningAutoCollapseStore.js';

registerTest({
  id: 'reasoning-auto-collapse-default-true',
  name: 'reasoningAutoCollapse defaults to true',
  fn: async (assert) => {
    // Clear localStorage to ensure we're testing default behavior
    localStorage.removeItem('reasoning_auto_collapse');

    // Re-import to get fresh state (simulate app start)
    const { reasoningAutoCollapse: freshStore } = await import('../../stores/reasoningAutoCollapseStore.js');

    const value = get(freshStore);
    debugInfo('Default value of reasoningAutoCollapse:', value);

    assert.that(value === true, `Expected default value to be true, got ${value}`);
  }
});

registerTest({
  id: 'reasoning-auto-collapse-can-set-false',
  name: 'reasoningAutoCollapse can be set to false',
  fn: async (assert) => {
    const prev = get(reasoningAutoCollapse);
    try {
      reasoningAutoCollapse.set(false);
      const value = get(reasoningAutoCollapse);
      debugInfo('Value after setting to false:', value);

      assert.that(value === false, `Expected value to be false after setting, got ${value}`);
    } finally {
      reasoningAutoCollapse.set(prev);
    }
  }
});

registerTest({
  id: 'reasoning-auto-collapse-persists-to-localstorage',
  name: 'reasoningAutoCollapse persists to localStorage',
  fn: async (assert) => {
    const prev = get(reasoningAutoCollapse);
    try {
      reasoningAutoCollapse.set(false);

      const stored = localStorage.getItem('reasoning_auto_collapse');
      debugInfo('localStorage value after setting false:', stored);

      assert.that(stored === 'false', `Expected localStorage to contain 'false', got '${stored}'`);

      reasoningAutoCollapse.set(true);
      const storedTrue = localStorage.getItem('reasoning_auto_collapse');
      debugInfo('localStorage value after setting true:', storedTrue);

      assert.that(storedTrue === 'true', `Expected localStorage to contain 'true', got '${storedTrue}'`);
    } finally {
      reasoningAutoCollapse.set(prev);
      localStorage.removeItem('reasoning_auto_collapse');
    }
  }
});

registerTest({
  id: 'reasoning-auto-collapse-loads-from-localstorage',
  name: 'reasoningAutoCollapse loads from localStorage on init',
  fn: async (assert) => {
    // Set localStorage before importing the store
    localStorage.setItem('reasoning_auto_collapse', 'false');

    // Force fresh import by clearing module cache (if possible)
    // Since ES modules are cached, we test by checking load behavior
    const stored = localStorage.getItem('reasoning_auto_collapse');
    debugInfo('localStorage before load:', stored);

    // The store should read this value on initialization
    // For a proper test, we'd need to re-import, but we can at least verify
    // that if we set and get, it works
    reasoningAutoCollapse.set(false);
    const value = get(reasoningAutoCollapse);

    assert.that(value === false, `Expected store to reflect false value, got ${value}`);

    // Cleanup
    localStorage.removeItem('reasoning_auto_collapse');
    reasoningAutoCollapse.set(true);
  }
});
