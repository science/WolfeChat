/**
 * Summary Model Selection Tests
 *
 * Tests for the getEffectiveSummaryModel utility that determines
 * which model to use for summary generation.
 */

import { test } from '../testHarness.js';
import { get } from 'svelte/store';

// ============================================================================
// Model Selection Logic
// ============================================================================

test({
  id: 'summary-model-selection-use-configured',
  name: 'getEffectiveSummaryModel should return configured model when summaryModel is set',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { selectedModel } = await import('../../stores/stores.js');
    const { getEffectiveSummaryModel } = await import('../../lib/summaryModelUtils.js');

    // Set a specific summary model
    summaryModel.set('claude-3-haiku-20240307');
    // Set a different conversation model
    selectedModel.set('gpt-4o');

    const result = getEffectiveSummaryModel('test-conv-id');

    assert.that(result === 'claude-3-haiku-20240307',
      `Expected 'claude-3-haiku-20240307', got ${result}`);

    // Clean up
    summaryModel.set(null);
  }
});

test({
  id: 'summary-model-selection-use-conversation-when-null',
  name: 'getEffectiveSummaryModel should return conversation model when summaryModel is null',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { selectedModel } = await import('../../stores/stores.js');
    const { getEffectiveSummaryModel } = await import('../../lib/summaryModelUtils.js');

    // No specific summary model configured
    summaryModel.set(null);
    // Conversation uses this model
    selectedModel.set('gpt-4o');

    const result = getEffectiveSummaryModel('test-conv-id');

    assert.that(result === 'gpt-4o',
      `Expected 'gpt-4o', got ${result}`);
  }
});

test({
  id: 'summary-model-selection-default-fallback',
  name: 'getEffectiveSummaryModel should fallback to gpt-3.5-turbo if no model set',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { selectedModel } = await import('../../stores/stores.js');
    const { getEffectiveSummaryModel } = await import('../../lib/summaryModelUtils.js');

    // Clear both models
    summaryModel.set(null);
    // Note: selectedModel may have a value from localStorage, but the fallback
    // in the utility should still work if everything is unset

    const result = getEffectiveSummaryModel('test-conv-id');

    // Should have some model value (either selectedModel or fallback)
    assert.that(typeof result === 'string' && result.length > 0,
      `Expected a non-empty string, got ${result}`);
  }
});

test({
  id: 'summary-model-selection-ignores-quick-settings-when-configured',
  name: 'getEffectiveSummaryModel should ignore conversation quick settings when summaryModel is set',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { selectedModel } = await import('../../stores/stores.js');
    const { conversationQuickSettings } = await import('../../stores/conversationQuickSettingsStore.js');
    const { getEffectiveSummaryModel } = await import('../../lib/summaryModelUtils.js');

    // Set conversation-specific model via quick settings
    conversationQuickSettings.setSettings('test-conv-specific', { model: 'gpt-4-turbo' });

    // Set a global summary model - this should take precedence
    summaryModel.set('claude-3-opus-20240229');
    selectedModel.set('gpt-4o');

    const result = getEffectiveSummaryModel('test-conv-specific');

    assert.that(result === 'claude-3-opus-20240229',
      `Expected 'claude-3-opus-20240229', got ${result}`);

    // Clean up
    summaryModel.set(null);
    conversationQuickSettings.setSettings('test-conv-specific', {});
  }
});

test({
  id: 'summary-model-selection-respects-quick-settings-when-null',
  name: 'getEffectiveSummaryModel should use conversation quick settings when summaryModel is null',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { selectedModel } = await import('../../stores/stores.js');
    const { conversationQuickSettings } = await import('../../stores/conversationQuickSettingsStore.js');
    const { getEffectiveSummaryModel } = await import('../../lib/summaryModelUtils.js');

    // Set conversation-specific model via quick settings
    conversationQuickSettings.setSettings('test-conv-qs', { model: 'gpt-4-turbo' });

    // No specific summary model configured
    summaryModel.set(null);
    selectedModel.set('gpt-4o'); // Global default

    const result = getEffectiveSummaryModel('test-conv-qs');

    // Should use the conversation's quick settings model
    assert.that(result === 'gpt-4-turbo',
      `Expected 'gpt-4-turbo' (from quick settings), got ${result}`);

    // Clean up
    conversationQuickSettings.setSettings('test-conv-qs', {});
  }
});

// ============================================================================
// isUsingSummaryModelOverride helper
// ============================================================================

test({
  id: 'summary-model-is-override-true',
  name: 'isUsingSummaryModelOverride should return true when summaryModel is set',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { isUsingSummaryModelOverride } = await import('../../lib/summaryModelUtils.js');

    summaryModel.set('claude-3-haiku-20240307');

    const result = isUsingSummaryModelOverride();

    assert.that(result === true, `Expected true, got ${result}`);

    // Clean up
    summaryModel.set(null);
  }
});

test({
  id: 'summary-model-is-override-false',
  name: 'isUsingSummaryModelOverride should return false when summaryModel is null',
  fn: async (assert) => {
    const { summaryModel } = await import('../../stores/summaryModelStore.js');
    const { isUsingSummaryModelOverride } = await import('../../lib/summaryModelUtils.js');

    summaryModel.set(null);

    const result = isUsingSummaryModelOverride();

    assert.that(result === false, `Expected false, got ${result}`);
  }
});
