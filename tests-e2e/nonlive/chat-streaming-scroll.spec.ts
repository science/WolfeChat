import { test, expect } from '@playwright/test';

async function runStreamingScenario(page) {
  return await page.evaluate(async () => {
    function nextFrame() { return new Promise<void>((r) => requestAnimationFrame(() => r())); }
    function createScrollContainer() {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-99999px';
      container.style.top = '-99999px';
      container.style.width = '600px';
      container.style.height = '500px';
      container.style.overflow = 'auto';
      container.style.background = 'transparent';
      document.body.appendChild(container);
      return container as HTMLDivElement;
    }
    function createSessionContent(pxHeight: number, label: string) {
      const el = document.createElement('div');
      el.style.height = `${Math.max(0, pxHeight)}px`;
      el.style.boxSizing = 'border-box';
      el.style.border = '0';
      el.style.margin = '0';
      el.style.padding = '0';
      el.textContent = `Session ${label}, simulated height ${pxHeight}px`;
      return el as HTMLDivElement;
    }
    function showSession(container: HTMLDivElement, contentEl: HTMLDivElement) {
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(contentEl);
    }
    function scrollRatio(container: HTMLDivElement) {
      const denom = container.scrollHeight - container.clientHeight;
      if (denom <= 0) return 0;
      return container.scrollTop / denom;
    }
    class ScrollMemory {
      private key: string | null = null; private map = new Map<string, number>(); private el: HTMLDivElement | null = null; private suspended=false;
      attach(el: HTMLDivElement) { this.el = el; }
      detach() { this.el = null; }
      setActiveKey(k: string) { this.key = k; }
      setSuspended(v: boolean) { this.suspended = v; }
      saveCurrent() { if (!this.el || !this.key) return; const d=this.el.scrollHeight-this.el.clientHeight; const r=d<=0?0:this.el.scrollTop/d; this.map.set(this.key,r); }
      restoreCurrent() { if (this.suspended) return; if (!this.el || !this.key) return; const r=this.map.get(this.key)??0; const d=this.el.scrollHeight-this.el.clientHeight; this.el.scrollTop = d>0?Math.floor(d*r):0; }
      restoreCurrentAfterFrame() { if (this.suspended) return; requestAnimationFrame(() => this.restoreCurrent()); }
    }

    async function simulateStreamingAppend(mem: ScrollMemory, container: HTMLDivElement, contentEl: HTMLDivElement, steps: number, pxPerStep: number) {
      for (let i = 0; i < steps; i++) {
        const current = parseInt(contentEl.style.height, 10) || 0;
        contentEl.style.height = `${current + pxPerStep}px`;
        mem.restoreCurrentAfterFrame();
        await nextFrame();
      }
    }

    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const content = createSessionContent(5000, 'chat1');
      showSession(container, content);
      mem.setActiveKey('chat1');
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();

      const denom0 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom0 * 0.4);
      await nextFrame();
      mem.saveCurrent();

      const startTop1 = container.scrollTop;
      const startRatio1 = scrollRatio(container);

      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 10, 150);
      mem.setSuspended(false);

      const after1Top = container.scrollTop;

      const denom1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom1 * 0.6);
      await nextFrame();
      mem.saveCurrent();
      const startTop2 = container.scrollTop;
      const startRatio2 = scrollRatio(container);

      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 12, 120);
      mem.setSuspended(false);

      const after2Top = container.scrollTop;

      const denom2 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denom2 * 0.25);
      await nextFrame();
      mem.saveCurrent();
      const startTop3 = container.scrollTop;
      const startRatio3 = scrollRatio(container);

      mem.setSuspended(true);
      await simulateStreamingAppend(mem, container, content, 8, 180);
      mem.setSuspended(false);

      const after3Top = container.scrollTop;

      return {
        startRatio1, startRatio2, startRatio3,
        delta1: Math.abs(after1Top - startTop1),
        delta2: Math.abs(after2Top - startTop2),
        delta3: Math.abs(after3Top - startTop3),
      };
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  });
}

test.describe('Chat streaming scroll stability (nonlive)', () => {
  test('viewport remains stable while streaming', async ({ page }) => {
    await page.goto('/');
    const res = await runStreamingScenario(page);
    expect(Math.abs(res.startRatio1 - 0.4)).toBeLessThan(0.03);
    expect(res.delta1).toBeLessThanOrEqual(2);
    expect(Math.abs(res.startRatio2 - 0.6)).toBeLessThan(0.03);
    expect(res.delta2).toBeLessThanOrEqual(2);
    expect(Math.abs(res.startRatio3 - 0.25)).toBeLessThan(0.03);
    expect(res.delta3).toBeLessThanOrEqual(2);
  });
});
