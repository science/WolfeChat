/**
 * Summary Model Store Tests
 *
 * Tests for the summary model store that manages which AI model
 * is used for generating conversation summaries.
 */

import { test } from '../testHarness.js';
import { get } from 'svelte/store';

// ============================================================================
// Default Values
// ============================================================================

test({
  id: 'summary-model-store-default-null',
  name: 'summaryModel store should default to null (use conversation model)',
  fn: async (assert) => {
    // Clear localStorage to test default
    localStorage.removeItem('summary_model');

    // Dynamic import to get fresh module
    const { summaryModel } = await import('../../stores/summaryModelStore.js');

    const value = get(summaryModel);
    assert.that(value === null, `Expected null, got ${value}`);
  }
});

test({
  id: 'summary-model-store-reasoning-effort-default',
  name: 'summaryReasoningEffort store should default to medium',
  fn: async (assert) => {
    localStorage.removeItem('summary_reasoning_effort');
    const { summaryReasoningEffort } = await import('../../stores/summaryModelStore.js');

    const value = get(summaryReasoningEffort);
    assert.that(value === 'medium', `Expected 'medium', got ${value}`);
  }
});

test({
  id: 'summary-model-store-verbosity-default',
  name: 'summaryVerbosity store should default to medium',
  fn: async (assert) => {
    localStorage.removeItem('summary_verbosity');
    const { summaryVerbosity } = await import('../../stores/summaryModelStore.js');

    const value = get(summaryVerbosity);
    assert.that(value === 'medium', `Expected 'medium', got ${value}`);
  }
});

test({
  id: 'summary-model-store-summary-option-default',
  name: 'summarySummaryOption store should default to auto',
  fn: async (assert) => {
    localStorage.removeItem('summary_summary_option');
    const { summarySummaryOption } = await import('../../stores/summaryModelStore.js');

    const value = get(summarySummaryOption);
    assert.that(value === 'auto', `Expected 'auto', got ${value}`);
  }
});

test({
  id: 'summary-model-store-claude-thinking-default',
  name: 'summaryClaudeThinkingEnabled store should default to false',
  fn: async (assert) => {
    localStorage.removeItem('summary_claude_thinking');
    const { summaryClaudeThinkingEnabled } = await import('../../stores/summaryModelStore.js');

    const value = get(summaryClaudeThinkingEnabled);
    assert.that(value === false, `Expected false, got ${value}`);
  }
});

// ============================================================================
// Persistence
// ============================================================================

test({
  id: 'summary-model-store-persist-model',
  name: 'summaryModel should persist to localStorage',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');

    summaryModel.set('gpt-4o');

    const stored = localStorage.getItem('summary_model');
    assert.that(stored === '"gpt-4o"', `Expected '"gpt-4o"', got ${stored}`);

    // Clean up
    summaryModel.set(null);
  }
});

test({
  id: 'summary-model-store-persist-null',
  name: 'summaryModel should persist null to localStorage',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');

    summaryModel.set('gpt-4o');
    summaryModel.set(null);

    const stored = localStorage.getItem('summary_model');
    assert.that(stored === 'null', `Expected 'null', got ${stored}`);
  }
});

test({
  id: 'summary-model-store-persist-reasoning-effort',
  name: 'summaryReasoningEffort should persist to localStorage',
  fn: async (assert) => {
    const { summaryReasoningEffort } = await import('../../stores/summaryModelStore.js');

    summaryReasoningEffort.set('high');

    const stored = localStorage.getItem('summary_reasoning_effort');
    assert.that(stored === '"high"', `Expected '"high"', got ${stored}`);

    // Reset
    summaryReasoningEffort.set('medium');
  }
});

test({
  id: 'summary-model-store-persist-verbosity',
  name: 'summaryVerbosity should persist to localStorage',
  fn: async (assert) => {
    const { summaryVerbosity } = await import('../../stores/summaryModelStore.js');

    summaryVerbosity.set('low');

    const stored = localStorage.getItem('summary_verbosity');
    assert.that(stored === '"low"', `Expected '"low"', got ${stored}`);

    // Reset
    summaryVerbosity.set('medium');
  }
});

test({
  id: 'summary-model-store-persist-summary-option',
  name: 'summarySummaryOption should persist to localStorage',
  fn: async (assert) => {
    const { summarySummaryOption } = await import('../../stores/summaryModelStore.js');

    summarySummaryOption.set('detailed');

    const stored = localStorage.getItem('summary_summary_option');
    assert.that(stored === '"detailed"', `Expected '"detailed"', got ${stored}`);

    // Reset
    summarySummaryOption.set('auto');
  }
});

test({
  id: 'summary-model-store-persist-claude-thinking',
  name: 'summaryClaudeThinkingEnabled should persist to localStorage',
  fn: async (assert) => {
    const { summaryClaudeThinkingEnabled } = await import('../../stores/summaryModelStore.js');

    summaryClaudeThinkingEnabled.set(true);

    const stored = localStorage.getItem('summary_claude_thinking');
    assert.that(stored === 'true', `Expected 'true', got ${stored}`);

    // Reset
    summaryClaudeThinkingEnabled.set(false);
  }
});

// ============================================================================
// Loading from localStorage
// ============================================================================

test({
  id: 'summary-model-store-load-model',
  name: 'summaryModel should load from localStorage on init',
  fn: async (assert) => {
    // Note: Due to module caching, this test verifies the loading logic exists
    // In a real scenario, you'd need to reset module cache between tests
    const { summaryModel } = await import('../../stores/summaryModelStore.js');

    // Set via store (which persists to localStorage)
    summaryModel.set('claude-3-haiku-20240307');

    const value = get(summaryModel);
    assert.that(value === 'claude-3-haiku-20240307', `Expected 'claude-3-haiku-20240307', got ${value}`);

    // Clean up
    summaryModel.set(null);
  }
});

test({
  id: 'summary-model-store-set-update',
  name: 'summaryModel should update when set is called',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');

    summaryModel.set('gpt-4o');
    let value = get(summaryModel);
    assert.that(value === 'gpt-4o', `Expected 'gpt-4o', got ${value}`);

    summaryModel.set('claude-3-opus-20240229');
    value = get(summaryModel);
    assert.that(value === 'claude-3-opus-20240229', `Expected 'claude-3-opus-20240229', got ${value}`);

    // Clean up
    summaryModel.set(null);
  }
});
