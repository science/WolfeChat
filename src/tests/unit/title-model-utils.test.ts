/**
 * Title Generation Utilities Tests
 *
 * Covers the resolver getEffectiveTitleModel (disabled flag, explicit pick,
 * conversation-model fallback) and the reasoning-off policy
 * getTitleReasoningOptions across model families.
 */

import { test } from '../testHarness.js';
import { get } from 'svelte/store';

async function resetStores() {
  const { titleGenerationEnabled, titleGenerationModel } =
    await import('../../stores/titleGenerationStore.js');
  titleGenerationEnabled.set(true);
  titleGenerationModel.set(null);
}

// ============================================================================
// getEffectiveTitleModel
// ============================================================================

test({
  id: 'title-resolver-disabled-returns-null',
  name: 'getEffectiveTitleModel returns null when titleGenerationEnabled is false',
  fn: async (assert) => {
    await resetStores();
    const { titleGenerationEnabled } = await import('../../stores/titleGenerationStore.js');
    const { getEffectiveTitleModel } = await import('../../lib/titleModelUtils.js');

    titleGenerationEnabled.set(false);
    assert.that(getEffectiveTitleModel('conv-any') === null,
      'expected null when disabled');
  }
});

test({
  id: 'title-resolver-explicit-model-wins',
  name: 'getEffectiveTitleModel returns the explicitly chosen model',
  fn: async (assert) => {
    await resetStores();
    const { titleGenerationModel } = await import('../../stores/titleGenerationStore.js');
    const { getEffectiveTitleModel } = await import('../../lib/titleModelUtils.js');

    titleGenerationModel.set('gpt-5.4-nano');
    const result = getEffectiveTitleModel('conv-any');
    assert.that(result === 'gpt-5.4-nano',
      `expected 'gpt-5.4-nano', got ${result}`);
  }
});

test({
  id: 'title-resolver-falls-back-to-conv-model',
  name: 'getEffectiveTitleModel falls back to per-conversation model when no explicit pick',
  fn: async (assert) => {
    await resetStores();
    const { conversationQuickSettings } =
      await import('../../stores/conversationQuickSettingsStore.js');
    const { getEffectiveTitleModel } = await import('../../lib/titleModelUtils.js');

    conversationQuickSettings.setSettings('conv-fallback-test', { model: 'claude-sonnet-4-5-20250929' });
    const result = getEffectiveTitleModel('conv-fallback-test');
    assert.that(result === 'claude-sonnet-4-5-20250929',
      `expected claude-sonnet-4-5-20250929, got ${result}`);
  }
});

test({
  id: 'title-resolver-explicit-beats-conv-model',
  name: 'getEffectiveTitleModel prefers explicit model over conversation model',
  fn: async (assert) => {
    await resetStores();
    const { titleGenerationModel } = await import('../../stores/titleGenerationStore.js');
    const { conversationQuickSettings } =
      await import('../../stores/conversationQuickSettingsStore.js');
    const { getEffectiveTitleModel } = await import('../../lib/titleModelUtils.js');

    titleGenerationModel.set('gpt-5.4-nano');
    conversationQuickSettings.setSettings('conv-priority-test', { model: 'claude-3-haiku-20240307' });
    const result = getEffectiveTitleModel('conv-priority-test');
    assert.that(result === 'gpt-5.4-nano',
      `expected explicit gpt-5.4-nano to win, got ${result}`);
  }
});

// ============================================================================
// getTitleReasoningOptions
// ============================================================================

test({
  id: 'title-reasoning-anthropic-omits-thinking',
  name: 'getTitleReasoningOptions returns empty options for Anthropic models',
  fn: async (assert) => {
    const { getTitleReasoningOptions } = await import('../../lib/titleModelUtils.js');
    const opts = getTitleReasoningOptions('claude-sonnet-4-5-20250929');
    assert.that(!opts.reasoningEffort && !opts.verbosity,
      `expected empty options for Anthropic, got ${JSON.stringify(opts)}`);
  }
});

test({
  id: 'title-reasoning-non-reasoning-openai-empty',
  name: 'getTitleReasoningOptions returns empty for non-reasoning OpenAI models',
  fn: async (assert) => {
    const { getTitleReasoningOptions } = await import('../../lib/titleModelUtils.js');
    const opts = getTitleReasoningOptions('gpt-4.1-nano');
    assert.that(!opts.reasoningEffort,
      `expected no reasoningEffort for gpt-4.1-nano, got ${JSON.stringify(opts)}`);
  }
});

test({
  id: 'title-reasoning-modern-uses-none',
  name: "getTitleReasoningOptions returns effort='none' for modern reasoning models",
  fn: async (assert) => {
    const { getTitleReasoningOptions } = await import('../../lib/titleModelUtils.js');
    const opts = getTitleReasoningOptions('gpt-5.4-nano');
    assert.that(opts.reasoningEffort === 'none',
      `expected 'none' for gpt-5.4-nano, got ${opts.reasoningEffort}`);
    assert.that(opts.verbosity === 'low',
      `expected verbosity 'low', got ${opts.verbosity}`);
  }
});

test({
  id: 'title-reasoning-legacy-uses-minimal',
  name: "getTitleReasoningOptions returns effort='minimal' for legacy reasoning models",
  fn: async (assert) => {
    const { getTitleReasoningOptions } = await import('../../lib/titleModelUtils.js');
    const optsNano = getTitleReasoningOptions('gpt-5-nano');
    assert.that(optsNano.reasoningEffort === 'minimal',
      `expected 'minimal' for gpt-5-nano, got ${optsNano.reasoningEffort}`);

    const optsO3 = getTitleReasoningOptions('o3-mini');
    assert.that(optsO3.reasoningEffort === 'minimal',
      `expected 'minimal' for o3-mini, got ${optsO3.reasoningEffort}`);
  }
});
