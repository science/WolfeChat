#!/usr/bin/env ts-node
/**
 * Node CLI test runner for Wolfechat test harness.
 * Runs the same src/tests using a minimal DOM shim when needed.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { pathToFileURL } from 'url';
import { runAllTests, formatSuiteResultsText, clearTests } from './src/tests/testHarness.js';

// Setup JSDOM for DOM-based tests
if (typeof (globalThis as any).window === 'undefined' || typeof (globalThis as any).document === 'undefined') {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  (globalThis as any).window = dom.window as any;
  (globalThis as any).document = dom.window.document as any;
  (globalThis as any).navigator = dom.window.navigator as any;
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
}
if (typeof (globalThis as any).performance === 'undefined') {
  const hr = process.hrtime;
  const start = hr.bigint();
  (globalThis as any).performance = {
    now: () => Number((hr.bigint() - start) / 1000000n)
  } as any;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = (await import('util')).TextDecoder as any;
}

// Load Svelte stores dependency surface minimally for tests that import them
// Provide no-op localStorage to satisfy svelte/store persistence if used
if (typeof (globalThis as any).localStorage === 'undefined') {
  const mem = new Map<string,string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); }
  } as any;
}

// Helper to dynamically import all tests under src/tests/**
async function loadAllTests() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname);

  const globby = (await import('fast-glob')).default as any;
  const patterns = [
    'src/tests/**/*.test.ts',
    'src/tests/**/smokeTests.ts',
    'src/tests/**/smoke.test.ts',
    'src/tests/**/*.ts'
  ];
  const entries: string[] = await globby(patterns, { cwd: root, absolute: true });

  // Also import test files that register with the harness by side effect
  for (const p of entries) {
    const url = pathToFileURL(p).href;
    await import(url);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: { tag?: string; name?: string; live?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '-t' || a === '--tag') && args[i+1]) { opts.tag = args[++i]; continue; }
    if ((a === '-n' || a === '--name') && args[i+1]) { opts.name = args[++i]; continue; }
    if (a === '--live') { opts.live = true; continue; }
  }
  return opts;
}

(async () => {
  try {
  const { tag, name, live } = parseArgs();

  await loadAllTests();

  const filter = (t: any) => {
    if (live === false) {
      // No-op; default includes all
    }
    if (tag && !(t.tags || []).includes(tag)) return false;
    if (name && !t.name.toLowerCase().includes(name.toLowerCase())) return false;
    // If --live not set, skip tests tagged 'live'
    if (!live && (t.tags || []).includes('live')) return false;
    return true;
  };

  const suite = await runAllTests({ filter });
  const text = formatSuiteResultsText(suite);
  console.log(text);
  process.exitCode = suite.failed > 0 ? 1 : 0;

  clearTests();
  } catch (err: any) {
    console.error('Test runner failed:', err?.stack || err?.message || err);
    process.exitCode = 1;
  }
})();
