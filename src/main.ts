import './app.css'
import App from './App.svelte'
import { log } from './lib/logger.js';

const app = new App({
  target: document.getElementById('app'),
});

// In-app test mode: load browser tests and expose a runner when ?testMode=1
(async () => {
  const params = new URLSearchParams(window.location.search);
  const testMode = params.get('testMode') === '1';
  if (!testMode) return;

  const suite = params.get('suite') || 'browser-nonlive';
  log.debug('[testMode] activating; suite=', suite);

  // Reduce motion to stabilize layout in tests
  const style = document.createElement('style');
  style.textContent = `* { transition: none !important; animation: none !important; }`;
  document.head.appendChild(style);

  // Global error telemetry
  window.addEventListener('error', (e) => {
    log.error('[testMode:onerror]', e.message, (e as any).error?.stack || '');
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    log.error('[testMode:unhandledrejection]', (e.reason && (e.reason.message || String(e.reason))) || 'unknown', e.reason?.stack || '');
  });

  // Dynamically import test modules for the chosen suite, guarded per-file to pinpoint failures
  try {
    log.debug('[testMode] importing test modules for suite:', suite);
    let mods: Record<string, () => Promise<unknown>> = {};
    if (suite === 'browser-nonlive') {
      mods = import.meta.glob('/src/tests/browser-nonlive/*.test.ts');
    } else if (suite === 'browser-live') {
      mods = import.meta.glob('/src/tests/browser-live/*.test.ts');
    } else {
      log.error('[testMode] Unknown test suite:', suite);
    }
    let entries = Object.entries(mods);
    // Skip known-incompatible files for browser harness
    entries = entries.filter(([f]) => !f.includes('codeRendererStreaming.integration.test.ts'));
    const files = entries.map(([f]) => f);
    log.debug('[testMode] discovered test modules =', files);
    let loaded = 0;
    for (const f of files) {
      try {
        log.debug('[testMode] loading module:', f);
        await mods[f]!();
        loaded++;
        log.debug('[testMode] loaded ok:', f);
      } catch (err) {
        log.error('[testMode] failed to load module:', f, (err as any)?.message || String(err), (err as any)?.stack || '');
      }
    }
    log.debug('[testMode] total loaded modules =', loaded, 'of', files.length);
  } catch (e) {
    log.error('[testMode] Failed in glob/import loop', e);
  }

  try {
    log.debug('[testMode] importing test harness...');
    const harness = await import('./tests/testHarness.js');
    log.debug('[testMode] harness loaded; exposing __wolfeRunTests');
    // Expose a stable API for Playwright
    // @ts-ignore
    (window as any).__wolfeRunTests = async () => {
      try {
        log.debug('[testMode] __wolfeRunTests invoked');
        const res = await harness.runAllTests();
        log.debug('[testMode] __wolfeRunTests finished; failed=', res.failed);
        // Normalize shape for Playwright check
        return { passed: res.failed === 0, ...res };
      } catch (err) {
        log.error('[testMode] __wolfeRunTests error', err);
        throw err;
      }
    };
    // Optional: list tests helper
    // @ts-ignore
    ;(window as any).__wolfeListTests = () => harness.listTests().map((t: any) => ({ id: t.id, name: t.name }));
    // Live helpers
    // @ts-ignore
    (window as any).__wolfeSetApiKey = async (key: string) => {
      try {
        // Must use JSON.stringify to match how stores persist API keys
        localStorage.setItem('api_key', JSON.stringify(key));
        const stores = await import('./stores/stores.js');
        if ((stores as any).apiKey) (stores as any).apiKey.set(key as any);
        log.debug('[testMode] api key set');
        return true;
      } catch (e) {
        log.error('[testMode] failed to set api key', e);
        return false;
      }
    };
    // @ts-ignore
    (window as any).__wolfePreloadModels = async () => {
      try {
        const modelStore = await import('./stores/modelStore.js');
        if (typeof (modelStore as any).loadModels === 'function') {
          await (modelStore as any).loadModels();
          log.debug('[testMode] models preloaded');
          return true;
        }
        log.warn('[testMode] loadModels not available');
        return false;
      } catch (e) {
        log.error('[testMode] preload models error', e);
        return false;
      }
    };
  } catch (e) {
    log.error('[testMode] Failed to initialize test harness', e);
  }
})();

export default app
