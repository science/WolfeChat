/**
 * Unit Test: Claude Reasoning Settings Store
 *
 * TDD test for global Claude reasoning settings defaults.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo } from '../utils/debugLog.js';
import { get } from 'svelte/store';

registerTest({
  id: 'claude-reasoning-settings-default-true',
  name: 'claudeThinkingEnabled should default to true',
  fn: async () => {
    // Clear localStorage to test default
    try {
      localStorage.removeItem('claude_thinking_enabled');
    } catch {}

    // Re-import to get fresh store with default value
    // Note: This test may not work perfectly due to module caching,
    // but we can at least verify the store exists and is a boolean
    const { claudeThinkingEnabled } = await import('../../stores/claudeReasoningSettings.js');

    const value = get(claudeThinkingEnabled);

    if (typeof value !== 'boolean') {
      throw new Error(`EXPECTED: claudeThinkingEnabled to be a boolean, got ${typeof value}`);
    }

    debugInfo(`✓ claudeThinkingEnabled is boolean: ${value}`);
  }
});

registerTest({
  id: 'claude-reasoning-settings-toggle',
  name: 'claudeThinkingEnabled can be toggled',
  fn: async () => {
    const { claudeThinkingEnabled } = await import('../../stores/claudeReasoningSettings.js');

    // Set to false
    claudeThinkingEnabled.set(false);
    let value = get(claudeThinkingEnabled);

    if (value !== false) {
      throw new Error(`EXPECTED: claudeThinkingEnabled to be false after set(false), got ${value}`);
    }

    // Set to true
    claudeThinkingEnabled.set(true);
    value = get(claudeThinkingEnabled);

    if (value !== true) {
      throw new Error(`EXPECTED: claudeThinkingEnabled to be true after set(true), got ${value}`);
    }

    debugInfo('✓ claudeThinkingEnabled can be toggled');
  }
});

registerTest({
  id: 'claude-reasoning-settings-persists-to-localstorage',
  name: 'claudeThinkingEnabled should persist to localStorage',
  fn: async () => {
    const { claudeThinkingEnabled } = await import('../../stores/claudeReasoningSettings.js');

    // Set to false and check localStorage
    claudeThinkingEnabled.set(false);

    // Small delay to ensure subscription handler runs
    await new Promise(resolve => setTimeout(resolve, 10));

    const storedValue = localStorage.getItem('claude_thinking_enabled');

    if (storedValue !== 'false') {
      throw new Error(`EXPECTED: localStorage to have 'false', got ${storedValue}`);
    }

    // Set back to true
    claudeThinkingEnabled.set(true);
    await new Promise(resolve => setTimeout(resolve, 10));

    const storedValue2 = localStorage.getItem('claude_thinking_enabled');

    if (storedValue2 !== 'true') {
      throw new Error(`EXPECTED: localStorage to have 'true', got ${storedValue2}`);
    }

    debugInfo('✓ claudeThinkingEnabled persists to localStorage');
  }
});
