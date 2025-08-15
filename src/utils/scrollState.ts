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
  private rafId: number | null = null;
  private restoreRetries = 0;
  private suspended = false;
  private static readonly MAX_RESTORE_RETRIES = 8;
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
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.restoreRetries = 0;
  }

  setActiveKey(key: string | number | null) {
    const k = key == null ? null : String(key);
    if (this.key === k) return;
    // Persist any in-progress scrolling before switching
    this.saveCurrent();
    this.key = k;
    // Cancel any in-flight restore scheduling and reset retries for the new key
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.restoreRetries = 0;
    // Defer saving for the new key until we perform an initial restore,
    // to avoid capturing a transient/clamped scrollTop caused by DOM changes.
    this.pendingRestore = true;
  }

  setSuspended(suspended: boolean) {
    this.suspended = !!suspended;
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
    if (!this.container || this.key == null || this.pendingRestore || this.suspended) return;
    const denom = this.container.scrollHeight - this.container.clientHeight;
    // Ignore saves while not scrollable; this avoids overwriting a meaningful ratio with 0
    // when switching from an empty chat to a long chat.
    if (denom <= 0) return;
    const ratio = this.container.scrollTop / denom;
    this.ratios.set(this.key, this.clamp01(ratio));
  }

  restoreCurrent() {
    this.tryRestore(/*scheduleIfNeeded*/ false);
  }

  restoreCurrentAfterFrame() {
    this.tryRestore(/*scheduleIfNeeded*/ true);
  }

  private scheduleRestore() {
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.tryRestore(/*scheduleIfNeeded*/ true);
    });
  }

  private tryRestore(scheduleIfNeeded: boolean) {
    const container = this.container;
    const key = this.key;
    if (!container || key == null) return;
    if (this.suspended) return;

    const ratio = this.getRatioForKey(key);
    const denom = container.scrollHeight - container.clientHeight;

    if (denom <= 0 && ratio > 0 && this.restoreRetries < ScrollMemory.MAX_RESTORE_RETRIES) {
      // Content not scrollable yet but we need a non-top position. Try again next frame.
      this.restoreRetries++;
      if (scheduleIfNeeded) {
        this.scheduleRestore();
      }
      return;
    }

    // Apply whatever position we have (0 when no memory or still unscrollable).
    this.applyRatio(ratio);

    // If content is scrollable (or we gave up / only needed top), allow saves again.
    if (denom > 0 || ratio === 0 || this.restoreRetries >= ScrollMemory.MAX_RESTORE_RETRIES) {
      this.pendingRestore = false;
      this.restoreRetries = 0;
    } else if (scheduleIfNeeded) {
      // As a fallback, keep trying a bit more if still unscrollable and ratio>0.
      this.scheduleRestore();
    }
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
