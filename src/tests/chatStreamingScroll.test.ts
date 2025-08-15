/**
 * chatStreamingScroll.test.ts
 * Verifies that while "streaming" appends content to the bottom, the viewport does not drift.
 * We simulate streaming by increasing the content height and triggering restore calls the app would do.
 */

import { registerTest, Assert } from './testHarness';
import { ScrollMemory } from '../utils/scrollState';

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function createScrollContainer(): HTMLDivElement {
  const container = document.createElement('div');
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

async function simulateStreamingAppend(
  mem: ScrollMemory,
  container: HTMLDivElement,
  contentEl: HTMLDivElement,
  steps: number,
  pxPerStep: number
) {
  // App behavior: on each DOM mutation, it triggers a restore attempt next frame.
  for (let i = 0; i < steps; i++) {
    const current = parseInt(contentEl.style.height, 10) || 0;
    contentEl.style.height = `${current + pxPerStep}px`;
    // Mimic mutation observer scheduling a restore
    mem.restoreCurrentAfterFrame();
    await nextFrame();
  }
}

registerTest({
  id: 'ui-scroll-streaming-stable-viewport',
  name: 'Chat scroll: viewport stable while streaming (multiple responses)',
  tags: ['ui', 'dom'],
  timeoutMs: 8000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      // Initial long content and position
      const content = createSessionContent(5000, 'chat1');
      showSession(container, content);
      mem.setActiveKey('chat1');
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      // Scroll to ~40%
      const denom0 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom0 * 0.4);
      await nextFrame();
      mem.saveCurrent();

      const startTop1 = container.scrollTop;
      const startRatio1 = scrollRatio(container);
      assert.that(Math.abs(startRatio1 - 0.4) < 0.03, `Precondition ~40% (got ${(startRatio1 * 100).toFixed(1)}%).`);

      // Response 1 streaming: growing bottom content shouldn't shift viewport
      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 10, 150);
      mem.setSuspended(false);

      const after1Top = container.scrollTop;
      assert.that(Math.abs(after1Top - startTop1) <= 2, `Viewport stable during first stream (Δ=${Math.abs(after1Top - startTop1)}px).`);

      // User scrolls to ~60%, save memory
      const denom1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom1 * 0.6);
      await nextFrame();
      mem.saveCurrent();
      const startTop2 = container.scrollTop;
      const startRatio2 = scrollRatio(container);
      assert.that(Math.abs(startRatio2 - 0.6) < 0.03, `Scrolled to ~60% (got ${(startRatio2 * 100).toFixed(1)}%).`);

      // Response 2 streaming
      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 12, 120);
      mem.setSuspended(false);

      const after2Top = container.scrollTop;
      assert.that(Math.abs(after2Top - startTop2) <= 2, `Viewport stable during second stream (Δ=${Math.abs(after2Top - startTop2)}px).`);

      // User scrolls to ~25%
      const denom2 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom2 * 0.25);
      await nextFrame();
      mem.saveCurrent();
      const startTop3 = container.scrollTop;
      const startRatio3 = scrollRatio(container);
      assert.that(Math.abs(startRatio3 - 0.25) < 0.03, `Scrolled to ~25% (got ${(startRatio3 * 100).toFixed(1)}%).`);

      // Response 3 streaming
      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 8, 180);
      mem.setSuspended(false);

      const after3Top = container.scrollTop;
      assert.that(Math.abs(after3Top - startTop3) <= 2, `Viewport stable during third stream (Δ=${Math.abs(after3Top - startTop3)}px).`);
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  }
});
