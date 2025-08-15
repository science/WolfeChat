/**
 * chatScrollState.test.ts
 * Demonstrates the bug: a single scroll container is reused across chats without
 * per-conversation scroll "memory". These tests assert the desired behavior
 * (position should persist per chat) and will currently FAIL, exposing the bug.
 */

import { registerTest, Assert } from './testHarness';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function createScrollContainer(): HTMLDivElement {
  const container = document.createElement('div');
  // Place off-screen to avoid impacting visible UI
  container.style.position = 'absolute';
  container.style.left = '-99999px';
  container.style.top = '-99999px';
  container.style.width = '600px';
  container.style.height = '500px';
  container.style.overflow = 'auto';
  container.style.background = 'transparent';
  document.body.appendChild(container);
  return container;
}

function createSessionContent(pxHeight: number, label: string): HTMLDivElement {
  const el = document.createElement('div');
  // Create a block with a fixed height to simulate chat content of varying sizes
  el.style.height = `${Math.max(0, pxHeight)}px`;
  el.style.boxSizing = 'border-box';
  el.style.border = '0';
  el.style.margin = '0';
  el.style.padding = '0';
  el.textContent = `Session ${label}, simulated height ${pxHeight}px`;
  return el;
}

function showSession(container: HTMLDivElement, contentEl: HTMLDivElement) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(contentEl);
}

function scrollRatio(container: HTMLDivElement): number {
  const denom = container.scrollHeight - container.clientHeight;
  if (denom <= 0) return 0;
  return container.scrollTop / denom;
}

// Test 1: Switching from a long chat to a shorter chat should preserve position ratio per chat.
// Current behavior (bug) will NOT preserve it, so this test is expected to FAIL.
registerTest({
  id: 'ui-scroll-per-conv-shorter',
  name: 'Chat scroll: switching to shorter chat should preserve position ratio (expected to fail)',
  tags: ['ui', 'dom'],
  timeoutMs: 5000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    try {
      const chat1 = createSessionContent(100000, 'chat1'); // 100k px
      const chat2 = createSessionContent(10000, 'chat2');  // 10k px

      // Open Chat1 and scroll to ~25%
      showSession(container, chat1);
      await nextFrame();
      await sleep(0);

      const maxScroll1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll1 * 0.25);
      await nextFrame();

      const ratio1 = scrollRatio(container);
      assert.that(Math.abs(ratio1 - 0.25) < 0.02, `Precondition: Chat1 should be ~25% scrolled (got ${(ratio1 * 100).toFixed(1)}%).`);

      // Switch to Chat2 (shorter)
      showSession(container, chat2);
      await nextFrame();
      await sleep(0);

      const ratio2 = scrollRatio(container);

      // Desired behavior: ratio2 should be ~25% as well, but current implementation shares a single
      // container without per-chat memory, so this will typically be near 100% (clamped to bottom).
      assert.that(Math.abs(ratio2 - ratio1) < 0.05, `Expected scroll ratio to persist (~${(ratio1 * 100).toFixed(1)}%), but got ${(ratio2 * 100).toFixed(1)}%.`);
    } finally {
      document.body.removeChild(container);
    }
  }
});

// Test 2: Switching through an empty chat should not reset the original chat's position.
// Current behavior (bug) resets to top after visiting an empty chat, so this is expected to FAIL.
registerTest({
  id: 'ui-scroll-reset-via-empty',
  name: 'Chat scroll: visiting empty chat should not reset other chats (expected to fail)',
  tags: ['ui', 'dom'],
  timeoutMs: 5000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    try {
      const chat1 = createSessionContent(100000, 'chat1'); // 100k px
      const chat3 = createSessionContent(0, 'chat3-empty'); // empty

      // Open Chat1 and scroll to ~25%
      showSession(container, chat1);
      await nextFrame();
      await sleep(0);

      const maxScroll1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll1 * 0.25);
      await nextFrame();

      const ratio1 = scrollRatio(container);
      assert.that(Math.abs(ratio1 - 0.25) < 0.02, `Precondition: Chat1 should be ~25% scrolled (got ${(ratio1 * 100).toFixed(1)}%).`);

      // Switch to empty Chat3
      showSession(container, chat3);
      await nextFrame();
      await sleep(0);

      // Switch back to Chat1
      showSession(container, chat1);
      await nextFrame();
      await sleep(0);

      const ratioBack = scrollRatio(container);

      // Desired behavior: Should restore ~25%. Current behavior will be ~0% (top).
      assert.that(Math.abs(ratioBack - ratio1) < 0.05, `Expected Chat1 scroll ratio to be restored (~${(ratio1 * 100).toFixed(1)}%), but got ${(ratioBack * 100).toFixed(1)}%.`);
    } finally {
      document.body.removeChild(container);
    }
  }
});
