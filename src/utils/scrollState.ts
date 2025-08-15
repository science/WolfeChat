/**
 * ScrollMemory: maintains per-key scroll ratio memory for a scrollable container.
 * - Saves ratio on user/programmatic scrolls.
 * - Restores ratio when switching keys or after content size changes.
 */
export class ScrollMemory {
  private container: HTMLElement | null = null;
  private key: string | null = null;
  private ratios = new Map<string, number>();
  // When true, ignore scroll-driven saves until a restore occurs for the active key.
  private pendingRestore = false;
  private onScroll = () => this.saveCurrent();

  attach(container: HTMLElement) {
    if (this.container === container) return;
    this.detach();
    this.container = container;
    this.container.addEventListener('scroll', this.onScroll, { passive: true } as any);
  }

  detach() {
    if (this.container) {
      this.container.removeEventListener('scroll', this.onScroll as any);
      this.container = null;
    }
  }

  setActiveKey(key: string | number | null) {
    const k = key == null ? null : String(key);
    if (this.key === k) return;
    // Persist any in-progress scrolling before switching
    this.saveCurrent();
    this.key = k;
    // Defer saving for the new key until we perform an initial restore,
    // to avoid capturing a transient/clamped scrollTop caused by DOM changes.
    this.pendingRestore = true;
  }

  getRatioForKey(key: string | number | null): number {
    const k = key == null ? null : String(key);
    if (k == null) return 0;
    return this.ratios.get(k) ?? 0;
  }

  setRatioForKey(key: string | number, ratio: number) {
    this.ratios.set(String(key), this.clamp01(ratio));
  }

  saveCurrent() {
    if (!this.container || this.key == null || this.pendingRestore) return;
    const denom = this.container.scrollHeight - this.container.clientHeight;
    const ratio = denom > 0 ? this.container.scrollTop / denom : 0;
    this.ratios.set(this.key, this.clamp01(ratio));
  }

  restoreCurrent() {
    if (!this.container || this.key == null) return;
    const ratio = this.getRatioForKey(this.key);
    this.applyRatio(ratio);
    // Now that we've applied the intended position, allow saves again.
    this.pendingRestore = false;
  }

  restoreCurrentAfterFrame() {
    if (!this.container) return;
    requestAnimationFrame(() => this.restoreCurrent());
  }

  private applyRatio(ratio: number) {
    if (!this.container) return;
    const denom = this.container.scrollHeight - this.container.clientHeight;
    const target = denom > 0 ? Math.round(denom * this.clamp01(ratio)) : 0;
    this.container.scrollTop = target;
  }

  private clamp01(x: number) {
    if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }
}
