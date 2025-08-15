/**
 * chatScrollState.test.ts
 * Tests the per-conversation scroll memory helper. These should PASS when the
 * ScrollMemory utility is used in the app.
 */

import { registerTest, Assert } from './testHarness';
import { ScrollMemory } from '../utils/scrollState';

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

// Test 1: Per-chat isolation and persistence across different content sizes.
registerTest({
  id: 'ui-scroll-isolated-per-chat',
  name: 'Chat scroll: isolated per-chat memory across different sizes',
  tags: ['ui', 'dom'],
  timeoutMs: 6000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const chat1 = createSessionContent(100000, 'chat1'); // 100k px
      const chat2 = createSessionContent(10000, 'chat2');  // 10k px

      // Visit Chat1 and scroll to ~25%
      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent(); // initial restore -> 0
      await nextFrame();
      const maxScroll1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll1 * 0.25);
      await nextFrame();
      mem.saveCurrent();

      const ratio1 = scrollRatio(container);
      assert.that(Math.abs(ratio1 - 0.25) < 0.03, `Chat1 precondition: ~25% (got ${(ratio1 * 100).toFixed(1)}%).`);

      // Switch to Chat2 (no prior history -> should start at 0)
      mem.setActiveKey('chat2');
      showSession(container, chat2);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      let ratio2 = scrollRatio(container);
      assert.that(Math.abs(ratio2 - 0) < 0.001, `First visit to Chat2 should start at top (got ${(ratio2 * 100).toFixed(1)}%).`);

      // Scroll Chat2 to ~60% and save
      const maxScroll2 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll2 * 0.6);
      await nextFrame();
      mem.saveCurrent();
      ratio2 = scrollRatio(container);
      assert.that(Math.abs(ratio2 - 0.6) < 0.03, `Chat2 should be ~60% (got ${(ratio2 * 100).toFixed(1)}%).`);

      // Switch back to Chat1 and ensure ~25% is restored
      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const ratio1Back = scrollRatio(container);
      assert.that(Math.abs(ratio1Back - 0.25) < 0.03, `Return to Chat1 should restore ~25% (got ${(ratio1Back * 100).toFixed(1)}%).`);

      // Switch to Chat2 again and ensure ~60% persists
      mem.setActiveKey('chat2');
      showSession(container, chat2);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const ratio2Back = scrollRatio(container);
      assert.that(Math.abs(ratio2Back - 0.6) < 0.03, `Return to Chat2 should restore ~60% (got ${(ratio2Back * 100).toFixed(1)}%).`);
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  }
});

// Test 2: Switching through an empty chat should not reset other chats' positions.
registerTest({
  id: 'ui-scroll-reset-via-empty',
  name: 'Chat scroll: visiting empty chat should not reset other chats',
  tags: ['ui', 'dom'],
  timeoutMs: 6000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const chat1 = createSessionContent(100000, 'chat1');     // 100k px
      const chat3 = createSessionContent(0, 'chat3-empty');    // empty

      // Open Chat1 and scroll to ~25%
      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const maxScroll1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll1 * 0.25);
      await nextFrame();
      mem.saveCurrent();

      const ratio1 = scrollRatio(container);
      assert.that(Math.abs(ratio1 - 0.25) < 0.03, `Chat1 precondition: ~25% (got ${(ratio1 * 100).toFixed(1)}%).`);

      // Switch to empty Chat3 (should be at top, but must not affect Chat1 memory)
      mem.setActiveKey('chat3');
      showSession(container, chat3);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const ratio3 = scrollRatio(container);
      assert.that(Math.abs(ratio3 - 0) < 0.001, `Empty Chat3 should be at top (got ${(ratio3 * 100).toFixed(1)}%).`);

      // Switch back to Chat1 and verify ratio restored
      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const ratioBack = scrollRatio(container);
      assert.that(Math.abs(ratioBack - 0.25) < 0.03, `Returning to Chat1 should restore ~25% (got ${(ratioBack * 100).toFixed(1)}%).`);
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  }
});
