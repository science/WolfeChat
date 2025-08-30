import './app.css'
import App from './App.svelte'
import chatIcon from './assets/chat.svg';

const app = new App({
  target: document.getElementById('app'),
})

window.addEventListener('load', () => {
  const linkIcon = document.querySelector('link[rel="icon"]');
  if (linkIcon) linkIcon.setAttribute('href', chatIcon);
});

// In-app test mode: load browser tests and expose a runner when ?testMode=1
(async () => {
  const params = new URLSearchParams(window.location.search);
  const testMode = params.get('testMode') === '1';
  if (!testMode) return;

  const suite = params.get('suite') || 'browser-nonlive';
  console.log('[testMode] activating; suite=', suite);

  // Reduce motion to stabilize layout in tests
  const style = document.createElement('style');
  style.textContent = `* { transition: none !important; animation: none !important; }`;
  document.head.appendChild(style);

  // Global error telemetry
  window.addEventListener('error', (e) => {
    console.error('[testMode:onerror]', e.message, (e as any).error?.stack || '');
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    console.error('[testMode:unhandledrejection]', (e.reason && (e.reason.message || String(e.reason))) || 'unknown', e.reason?.stack || '');
  });

  // Dynamically import test modules for the chosen suite, guarded per-file to pinpoint failures
  try {
    console.log('[testMode] importing test modules for suite:', suite);
    let mods: Record<string, () => Promise<unknown>> = {};
    if (suite === 'browser-nonlive') {
      mods = import.meta.glob('/src/tests/browser-nonlive/*.test.ts');
    } else if (suite === 'browser-live') {
      mods = import.meta.glob('/src/tests/browser-live/*.test.ts');
    } else {
      console.error('[testMode] Unknown test suite:', suite);
    }
    let entries = Object.entries(mods);
    // Skip known-incompatible files for browser harness
    entries = entries.filter(([f]) => !f.includes('codeRendererStreaming.integration.test.ts'));
    const files = entries.map(([f]) => f);
    console.log('[testMode] discovered test modules =', files);
    let loaded = 0;
    for (const f of files) {
      try {
        console.log('[testMode] loading module:', f);
        await mods[f]!();
        loaded++;
        console.log('[testMode] loaded ok:', f);
      } catch (err) {
        console.error('[testMode] failed to load module:', f, (err as any)?.message || String(err), (err as any)?.stack || '');
      }
    }
    console.log('[testMode] total loaded modules =', loaded, 'of', files.length);
  } catch (e) {
    console.error('[testMode] Failed in glob/import loop', e);
  }

  try {
    console.log('[testMode] importing test harness...');
    const harness = await import('./tests/testHarness.js');
    console.log('[testMode] harness loaded; exposing __wolfeRunTests');
    // Expose a stable API for Playwright
    // @ts-ignore
    (window as any).__wolfeRunTests = async () => {
      try {
        console.log('[testMode] __wolfeRunTests invoked');
        const res = await harness.runAllTests();
        console.log('[testMode] __wolfeRunTests finished; failed=', res.failed);
        // Normalize shape for Playwright check
        return { passed: res.failed === 0, ...res };
      } catch (err) {
        console.error('[testMode] __wolfeRunTests error', err);
        throw err;
      }
    };
    // Optional: list tests helper
    // @ts-ignore
    ;(window as any).__wolfeListTests = () => harness.listTests().map((t: any) => ({ id: t.id, name: t.name }));
  } catch (e) {
    console.error('[testMode] Failed to initialize test harness', e);
  }
})();

export default app
