import { registerTest } from './testHarness';
import { enterBehavior } from '../stores/keyboardSettings';
import { get } from 'svelte/store';
import { shouldSendOnEnter } from '../utils/keyboard';

registerTest({
  id: 'enter-behavior-send',
  name: 'Enter sends when "Send message" is selected',
  fn: async (assert) => {
    const prev = get(enterBehavior);
    try {
      enterBehavior.set('send');
      const shouldSend = shouldSendOnEnter({
        behavior: 'send',
        isStreaming: false,
        key: 'Enter',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      assert.that(shouldSend === true, 'Enter triggers send when behavior is "send" and no modifiers are pressed');
    } finally {
      enterBehavior.set(prev as any);
    }
  }
});

registerTest({
  id: 'enter-behavior-newline',
  name: 'Enter inserts newline when "Insert a new line" is selected',
  fn: async (assert) => {
    const prev = get(enterBehavior);
    try {
      enterBehavior.set('newline');
      const shouldSend = shouldSendOnEnter({
        behavior: 'newline',
        isStreaming: false,
        key: 'Enter',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      assert.that(shouldSend === false, 'Enter does not send when behavior is "newline" (default)');
    } finally {
      enterBehavior.set(prev as any);
    }
  }
});
