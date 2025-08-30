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

  // Reduce motion to stabilize layout in tests
  const style = document.createElement('style');
  style.textContent = `* { transition: none !important; animation: none !important; }`;
  document.head.appendChild(style);

  // Dynamically import test modules for the chosen suite
  try {
    if (suite === 'browser-nonlive') {
      const modules = import.meta.glob('/src/tests/browser-nonlive/*.test.ts', { eager: true });
      void modules; // side-effects register tests
    } else if (suite === 'browser-live') {
      const modules = import.meta.glob('/src/tests/browser-live/*.test.ts', { eager: true });
      void modules;
    } else {
      console.error('Unknown test suite:', suite);
    }
  } catch (e) {
    console.error('Failed to import test modules', e);
  }

  try {
    const harness = await import('./tests/testHarness.js');
    // Expose a stable API for Playwright
    // @ts-ignore
    (window as any).__wolfeRunTests = async () => {
      const res = await harness.runAllTests();
      // Normalize shape for Playwright check
      return { passed: res.failed === 0, ...res };
    };
    // Optional: list tests helper
    // @ts-ignore
    ;(window as any).__wolfeListTests = () => harness.listTests().map(t => ({ id: t.id, name: t.name }));
  } catch (e) {
    console.error('Failed to initialize test harness', e);
  }
})();

export default app
