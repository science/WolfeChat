/**
 * Unit Test: Conversation Quick Settings - Thinking Toggle
 *
 * TDD test for the thinkingEnabled property in ConversationQuickSettings.
 * This allows per-conversation control of Claude extended thinking.
 */

import { registerTest } from '../testHarness.js';
import { debugInfo } from '../utils/debugLog.js';

registerTest({
  id: 'cqs-thinking-enabled-in-interface',
  name: 'ConversationQuickSettings should support thinkingEnabled property',
  fn: async () => {
    const { createConversationQuickSettingsStore } = await import('../../stores/conversationQuickSettingsStore.js');

    // Create a store with initial settings including thinkingEnabled
    const store = createConversationQuickSettingsStore({
      'conv-1': {
        model: 'claude-opus-4-1-20250805',
        thinkingEnabled: false
      }
    });

    // Get settings for the conversation
    const settings = store.getSettings('conv-1');

    if (settings.thinkingEnabled !== false) {
      throw new Error(`EXPECTED: thinkingEnabled should be false, got ${settings.thinkingEnabled}`);
    }

    debugInfo('✓ thinkingEnabled property accessible in settings');
  }
});

registerTest({
  id: 'cqs-thinking-enabled-default-undefined',
  name: 'thinkingEnabled should be undefined when not set (defaults handled elsewhere)',
  fn: async () => {
    const { createConversationQuickSettingsStore } = await import('../../stores/conversationQuickSettingsStore.js');

    const store = createConversationQuickSettingsStore({
      'conv-1': {
        model: 'claude-opus-4-1-20250805'
        // thinkingEnabled not set
      }
    });

    const settings = store.getSettings('conv-1');

    if (settings.thinkingEnabled !== undefined) {
      throw new Error(`EXPECTED: thinkingEnabled should be undefined when not set, got ${settings.thinkingEnabled}`);
    }

    debugInfo('✓ thinkingEnabled is undefined when not set');
  }
});

registerTest({
  id: 'cqs-thinking-enabled-set-via-setSettings',
  name: 'Should be able to set thinkingEnabled via setSettings',
  fn: async () => {
    const { createConversationQuickSettingsStore } = await import('../../stores/conversationQuickSettingsStore.js');

    const store = createConversationQuickSettingsStore();

    // Set thinkingEnabled to false
    store.setSettings('conv-1', { thinkingEnabled: false });

    const settings = store.getSettings('conv-1');
    if (settings.thinkingEnabled !== false) {
      throw new Error(`EXPECTED: thinkingEnabled should be false after setSettings, got ${settings.thinkingEnabled}`);
    }

    // Update to true
    store.setSettings('conv-1', { thinkingEnabled: true });

    const updatedSettings = store.getSettings('conv-1');
    if (updatedSettings.thinkingEnabled !== true) {
      throw new Error(`EXPECTED: thinkingEnabled should be true after update, got ${updatedSettings.thinkingEnabled}`);
    }

    debugInfo('✓ thinkingEnabled can be set via setSettings');
  }
});

registerTest({
  id: 'cqs-thinking-enabled-preserve-other-settings',
  name: 'Setting thinkingEnabled should preserve other settings',
  fn: async () => {
    const { createConversationQuickSettingsStore } = await import('../../stores/conversationQuickSettingsStore.js');

    const store = createConversationQuickSettingsStore({
      'conv-1': {
        model: 'claude-opus-4-1-20250805',
        reasoningEffort: 'high',
        verbosity: 'medium'
      }
    });

    // Update just thinkingEnabled
    store.setSettings('conv-1', { thinkingEnabled: false });

    const settings = store.getSettings('conv-1');

    if (settings.model !== 'claude-opus-4-1-20250805') {
      throw new Error(`EXPECTED: model should be preserved, got ${settings.model}`);
    }
    if (settings.reasoningEffort !== 'high') {
      throw new Error(`EXPECTED: reasoningEffort should be preserved, got ${settings.reasoningEffort}`);
    }
    if (settings.verbosity !== 'medium') {
      throw new Error(`EXPECTED: verbosity should be preserved, got ${settings.verbosity}`);
    }
    if (settings.thinkingEnabled !== false) {
      throw new Error(`EXPECTED: thinkingEnabled should be false, got ${settings.thinkingEnabled}`);
    }

    debugInfo('✓ Other settings preserved when setting thinkingEnabled');
  }
});
