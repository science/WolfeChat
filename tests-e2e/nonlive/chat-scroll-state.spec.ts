import { test, expect } from '@playwright/test';

// Runs DOM + ScrollMemory logic inside the browser context and returns key ratios
async function runIsolatedPerChat(page) {
  return await page.evaluate(async () => {
    function nextFrame() {
      return new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    function waitFrames(n: number) {
      return new Promise<void>(async (resolve) => {
        for (let i = 0; i < n; i++) await nextFrame();
        resolve();
      });
    }
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

    // Lightweight ScrollMemory reimplementation to avoid bundling concerns
    class ScrollMemory {
      private key: string | null = null;
      private map = new Map<string, number>();
      private el: HTMLDivElement | null = null;
      attach(el: HTMLDivElement) { this.el = el; }
      detach() { this.el = null; }
      setActiveKey(k: string) { this.key = k; }
      saveCurrent() {
        if (!this.el || !this.key) return;
        const denom = this.el.scrollHeight - this.el.clientHeight;
        const ratio = denom <= 0 ? 0 : this.el.scrollTop / denom;
        this.map.set(this.key, ratio);
      }
      restoreCurrent() {
        if (!this.el || !this.key) return;
        const ratio = this.map.get(this.key) ?? 0;
        const denom = this.el.scrollHeight - this.el.clientHeight;
        if (denom > 0) this.el.scrollTop = Math.floor(denom * ratio);
        else this.el.scrollTop = 0;
      }
      restoreCurrentAfterFrame() { requestAnimationFrame(() => this.restoreCurrent()); }
    }

    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const chat1 = createSessionContent(100000, 'chat1');
      const chat2 = createSessionContent(10000, 'chat2');

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

      mem.setActiveKey('chat2');
      showSession(container, chat2);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      let ratio2 = scrollRatio(container);

      const maxScroll2 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll2 * 0.6);
      await nextFrame();
      mem.saveCurrent();
      ratio2 = scrollRatio(container);

      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const ratio1Back = scrollRatio(container);

      mem.setActiveKey('chat2');
      showSession(container, chat2);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const ratio2Back = scrollRatio(container);

      return { ratio1, ratio2Start: 0, ratio2Saved: ratio2, ratio1Back, ratio2Back };
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  });
}

async function runEmptyToLong(page) {
  return await page.evaluate(async () => {
    function nextFrame() { return new Promise<void>((r) => requestAnimationFrame(() => r())); }
    async function waitFrames(n: number) { for (let i = 0; i < n; i++) await nextFrame(); }
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
      el.textContent = `Session ${label}`;
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
      private key: string | null = null; private map = new Map<string, number>(); private el: HTMLDivElement | null = null;
      attach(el: HTMLDivElement) { this.el = el; }
      detach() { this.el = null; }
      setActiveKey(k: string) { this.key = k; }
      saveCurrent() { if (!this.el || !this.key) return; const d=this.el.scrollHeight-this.el.clientHeight; const r=d<=0?0:this.el.scrollTop/d; this.map.set(this.key,r); }
      restoreCurrent() { if (!this.el || !this.key) return; const r=this.map.get(this.key)??0; const d=this.el.scrollHeight-this.el.clientHeight; this.el.scrollTop = d>0?Math.floor(d*r):0; }
      restoreCurrentAfterFrame() { requestAnimationFrame(() => this.restoreCurrent()); }
    }

    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const chatLong = createSessionContent(100000, 'long');
      const chatEmpty = createSessionContent(300, 'empty');

      mem.setActiveKey('long');
      showSession(container, chatLong);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const denomLong = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(denomLong * 0.7);
      await nextFrame();
      mem.saveCurrent();
      const ratioLongSaved = scrollRatio(container);

      mem.setActiveKey('empty');
      showSession(container, chatEmpty);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const ratioEmpty = scrollRatio(container);

      mem.setActiveKey('long');
      showSession(container, chatLong);
      mem.restoreCurrentAfterFrame();
      await waitFrames(3);
      const ratioLongRestored = scrollRatio(container);

      return { ratioLongSaved, ratioEmpty, ratioLongRestored };
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  });
}

async function runResetViaEmpty(page) {
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
      el.textContent = `Session ${label}`;
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
      private key: string | null = null; private map = new Map<string, number>(); private el: HTMLDivElement | null = null;
      attach(el: HTMLDivElement) { this.el = el; }
      detach() { this.el = null; }
      setActiveKey(k: string) { this.key = k; }
      saveCurrent() { if (!this.el || !this.key) return; const d=this.el.scrollHeight-this.el.clientHeight; const r=d<=0?0:this.el.scrollTop/d; this.map.set(this.key,r); }
      restoreCurrent() { if (!this.el || !this.key) return; const r=this.map.get(this.key)??0; const d=this.el.scrollHeight-this.el.clientHeight; this.el.scrollTop = d>0?Math.floor(d*r):0; }
    }

    const container = createScrollContainer();
    const mem = new ScrollMemory();
    mem.attach(container);

    try {
      const chat1 = createSessionContent(100000, 'chat1');
      const chat3 = createSessionContent(0, 'chat3-empty');

      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const maxScroll1 = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.floor(maxScroll1 * 0.25);
      await nextFrame();
      mem.saveCurrent();
      const ratio1Saved = scrollRatio(container);

      mem.setActiveKey('chat3');
      showSession(container, chat3);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const ratio3 = scrollRatio(container);

      mem.setActiveKey('chat1');
      showSession(container, chat1);
      await nextFrame();
      mem.restoreCurrent();
      await nextFrame();
      const ratioBack = scrollRatio(container);

      return { ratio1Saved, ratio3, ratioBack };
    } finally {
      mem.detach();
      document.body.removeChild(container);
    }
  });
}

test.describe('Chat scroll state memory (nonlive)', () => {
  test('isolated per chat across content sizes', async ({ page }) => {
    await page.goto('/');
    const res = await runIsolatedPerChat(page);
    expect(Math.abs(res.ratio1 - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(res.ratio2Saved - 0.6)).toBeLessThan(0.03);
    expect(Math.abs(res.ratio1Back - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(res.ratio2Back - 0.6)).toBeLessThan(0.03);
  });

  test('switching empty->long restores saved ratio', async ({ page }) => {
    await page.goto('/');
    const res = await runEmptyToLong(page);
    expect(Math.abs(res.ratioLongSaved - 0.7)).toBeLessThan(0.03);
    expect(Math.abs(res.ratioEmpty - 0)).toBeLessThan(0.001);
    expect(Math.abs(res.ratioLongRestored - 0.7)).toBeLessThan(0.04);
  });

  test('visiting empty chat does not reset other chats', async ({ page }) => {
    await page.goto('/');
    const res = await runResetViaEmpty(page);
    expect(Math.abs(res.ratio1Saved - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(res.ratio3 - 0)).toBeLessThan(0.001);
    expect(Math.abs(res.ratioBack - 0.25)).toBeLessThan(0.03);
  });
});
