/**
 * chatStreamingScrollAppLike.test.ts
 *
 * Goal: Reproduce the real app's MutationObserver-driven restore behavior and show that
 * during a second (and subsequent) "streaming response" the viewport drifts when
 * scroll memory restores run while content is growing. This test is expected to FAIL
 * with the current configuration if streaming is not properly suspending restores.
 *
 * Why this is "deeper":
 * - Uses a MutationObserver (like App.svelte) to schedule restoreCurrentAfterFrame()
 *   on every DOM mutation (childList/characterData), instead of directly calling restore.
 * - Simulates multiple streaming responses, where only the first stream is suspended.
 *   The second stream runs without suspension to mimic the reported real-world behavior.
 */

import { registerTest, Assert } from '../testHarness';
import { ScrollMemory } from '../../utils/scrollState';

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

/**
 * Create an "app-like" content root that grows as chunks are appended,
 * similar to chat messages being added at the end of the history.
 */
function createContentRoot(initialHeightPx: number): HTMLDivElement {
  const root = document.createElement('div');
  root.style.position = 'relative';
  root.style.width = '100%';
  root.style.boxSizing = 'border-box';
  root.style.padding = '0';
  root.style.margin = '0';

  // Seed with a tall block so the container is scrollable from the start.
  const seed = document.createElement('div');
  seed.style.height = `${initialHeightPx}px`;
  seed.style.boxSizing = 'border-box';
  root.appendChild(seed);

  return root;
}

function appendChunk(parent: HTMLElement, pxHeight: number, label?: string) {
  const chunk = document.createElement('div');
  chunk.style.height = `${pxHeight}px`;
  chunk.style.boxSizing = 'border-box';
  chunk.style.border = '0';
  chunk.style.margin = '0';
  chunk.style.padding = '0';
  if (label) chunk.textContent = label;
  parent.appendChild(chunk);
}

async function simulateStreamingAppendAppLike(
  parent: HTMLElement,
  steps: number,
  pxPerStep: number,
  delayFrames = 1
) {
  for (let i = 0; i < steps; i++) {
    appendChunk(parent, pxPerStep, `stream chunk ${i + 1}`);
    // Let MutationObserver fire and any scheduled restore run on the next animation frame(s)
    for (let f = 0; f < delayFrames; f++) {
      await nextFrame();
    }
  }
}

function scrollRatio(container: HTMLDivElement): number {
  const denom = container.scrollHeight - container.clientHeight;
  if (denom <= 0) return 0;
  return container.scrollTop / denom;
}

registerTest({
  id: 'ui-scroll-streaming-app-like-second-response-drift',
  name: 'Chat scroll (app-like): viewport should not drift across multiple streaming responses',
  tags: ['ui', 'dom', 'non-api'],
  timeoutMs: 10000,
  fn: async (assert: Assert) => {
    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    // App-like MutationObserver: schedule restore after every mutation
    const observer = new MutationObserver(() => {
      mem.restoreCurrentAfterFrame();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    try {
      // Mount initial content
      const contentRoot = createContentRoot(4000);
      container.appendChild(contentRoot);

      // Activate a "chat session"
      mem.setActiveKey('chat-1');
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      // User scrolls to ~40% and we save that ratio
      const denom0 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom0 * 0.4);
      await nextFrame();
      mem.saveCurrent();

      const baseTop = container.scrollTop;
      const baseRatio = scrollRatio(container);
      assert.that(Math.abs(baseRatio - 0.4) < 0.03, `Precondition ~40% (got ${(baseRatio * 100).toFixed(1)}%).`);

      // STREAM 1: proper suspension (expected correct behavior)
      mem.setSuspended(true);
      await simulateStreamingAppendAppLike(contentRoot, 8, 160, 1);
      mem.setSuspended(false);

      const after1Top = container.scrollTop;
      assert.that(Math.abs(after1Top - baseTop) <= 2, `Viewport stable during first stream (Δ=${Math.abs(after1Top - baseTop)}px).`);

      // STREAM 2: NO SUSPENSION (mimic bug on subsequent responses)
      // App's MutationObserver will keep scheduling restore while content grows.
      // With ratio-based restore active, as scrollHeight increases, scrollTop is adjusted to keep the ratio constant,
      // which shifts the viewport (undesired). We ASSERT stability; current behavior is expected to FAIL here.
      await simulateStreamingAppendAppLike(contentRoot, 10, 150, 1);

      const after2Top = container.scrollTop;
      const delta2 = Math.abs(after2Top - after1Top);

      // This is the key assertion that will likely FAIL with current behavior.
      // If it fails, it proves the viewport drifts on the second streaming response.
      assert.that(delta2 <= 2, `Viewport should remain stable during second stream (observed drift Δ=${delta2}px).`);

      // STREAM 3: suspension restored (future-proofing; should be stable again)
      mem.setSuspended(true);
      await simulateStreamingAppendAppLike(contentRoot, 6, 180, 1);
      mem.setSuspended(false);

      const after3Top = container.scrollTop;
      assert.that(Math.abs(after3Top - after2Top) <= 2, `Viewport stable during third stream (Δ=${Math.abs(after3Top - after2Top)}px).`);
    } finally {
      mem.detach();
      observer.disconnect();
      document.body.removeChild(container);
    }
  }
});
