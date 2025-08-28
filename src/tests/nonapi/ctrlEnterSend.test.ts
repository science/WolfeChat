import { test } from '../testHarness.js';
import { shouldSendOnEnter, type EnterBehaviorOption } from '../../utils/keyboard.js';

test({
  id: 'ctrl-enter-send-basic',
  name: 'Ctrl+Enter sends message when not streaming',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, 'Ctrl+Enter should send when not streaming');
  }
});

test({
  id: 'ctrl-enter-no-send-streaming',
  name: 'Ctrl+Enter does not send when streaming',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: true,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, 'Ctrl+Enter should not send when streaming');
  }
});

test({
  id: 'ctrl-enter-with-shift',
  name: 'Ctrl+Shift+Enter does not send',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: true,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, 'Ctrl+Shift+Enter should not send');
  }
});

test({
  id: 'ctrl-enter-with-meta',
  name: 'Ctrl+Meta+Enter does not send',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: true,
      metaKey: true
    });
    assert.that(result === false, 'Ctrl+Meta+Enter should not send');
  }
});

test({
  id: 'ctrl-enter-overrides-newline-behavior',
  name: 'Ctrl+Enter sends even when behavior is newline',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, 'Ctrl+Enter should override newline behavior');
  }
});

test({
  id: 'ctrl-enter-works-with-send-behavior',
  name: 'Ctrl+Enter sends when behavior is send',
  tags: ['keyboard', 'ctrl-enter'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'send',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, 'Ctrl+Enter should send when behavior is send');
  }
});

test({
  id: 'regular-enter-respects-behavior',
  name: 'Regular Enter respects behavior setting',
  tags: ['keyboard'],
  fn: (assert) => {
    // Test with newline behavior
    const newlineResult = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(newlineResult === false, 'Regular Enter should not send with newline behavior');

    // Test with send behavior
    const sendResult = shouldSendOnEnter({
      behavior: 'send',
      isStreaming: false,
      key: 'Enter',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(sendResult === true, 'Regular Enter should send with send behavior');
  }
});

test({
  id: 'shift-enter-always-newline',
  name: 'Shift+Enter always inserts newline',
  tags: ['keyboard'],
  fn: (assert) => {
    // Test with send behavior
    const sendBehaviorResult = shouldSendOnEnter({
      behavior: 'send',
      isStreaming: false,
      key: 'Enter',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(sendBehaviorResult === false, 'Shift+Enter should not send even with send behavior');

    // Test with newline behavior
    const newlineBehaviorResult = shouldSendOnEnter({
      behavior: 'newline',
      isStreaming: false,
      key: 'Enter',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(newlineBehaviorResult === false, 'Shift+Enter should not send with newline behavior');
  }
});

test({
  id: 'non-enter-keys-ignored',
  name: 'Non-Enter keys are ignored',
  tags: ['keyboard'],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: 'send',
      isStreaming: false,
      key: 'a',
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, 'Non-Enter keys should not trigger send');
  }
});
