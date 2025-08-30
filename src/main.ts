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

  // Dynamically import test modules for the chosen suite
  try {
    console.log('[testMode] importing test modules for suite:', suite);
    let modules: Record<string, unknown> = {};
    if (suite === 'browser-nonlive') {
      modules = import.meta.glob('src/tests/browser-nonlive/*.test.ts', { eager: true });
    } else if (suite === 'browser-live') {
      modules = import.meta.glob('src/tests/browser-live/*.test.ts', { eager: true });
    } else {
      console.error('[testMode] Unknown test suite:', suite);
    }
    console.log('[testMode] imported module count =', Object.keys(modules).length);
    console.log('[testMode] imported modules =', Object.keys(modules));
  } catch (e) {
    console.error('[testMode] Failed to import test modules', e);
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
