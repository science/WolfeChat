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

// Helper to dynamically import all tests based on suite selection
async function loadAllTests(suite: 'nonapi' | 'live' | 'all') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname);

  const globby = (await import('fast-glob')).default as any;
  
  // Choose patterns based on suite
  let patterns: string[] = [];
  switch (suite) {
    case 'nonapi':
      patterns = [
        'src/tests/nonapi/**/*.test.ts',
        'src/tests/chatScrollState.test.ts',
        'src/tests/chatStreamingScroll.test.ts'
      ];
      break;
    case 'live':
      patterns = [
        'src/tests/live/**/*.test.ts'
      ];
      break;
    case 'all':
      patterns = [
        'src/tests/nonapi/**/*.test.ts',
        'src/tests/live/**/*.test.ts',
        'src/tests/chatScrollState.test.ts',
        'src/tests/chatStreamingScroll.test.ts'
      ];
      break;
  }
  
  const entries: string[] = await globby(patterns, { cwd: root, absolute: true });
  console.log(`Loading ${entries.length} test files from suite: ${suite}`);

  // Import test files that register with the harness by side effect
  for (const p of entries) {
    const url = pathToFileURL(p).href;
    await import(url);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: { tag?: string; name?: string; suite?: 'nonapi' | 'live' | 'all'; live?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '-t' || a === '--tag') && args[i+1]) { opts.tag = args[++i]; continue; }
    if ((a === '-n' || a === '--name') && args[i+1]) { opts.name = args[++i]; continue; }
    if ((a === '-s' || a === '--suite') && args[i+1]) { 
      const suiteArg = args[++i].toLowerCase();
      if (suiteArg === 'nonapi' || suiteArg === 'live' || suiteArg === 'all') {
        opts.suite = suiteArg;
      }
      continue; 
    }
    if (a === '--live') { opts.live = true; continue; }
  }
  // Backward compatibility: --live sets suite to 'live'
  if (opts.live && !opts.suite) {
    opts.suite = 'live';
  }
  // Default suite is 'nonapi'
  if (!opts.suite) {
    opts.suite = 'nonapi';
  }
  return opts;
}

(async () => {
  try {
  const { tag, name, suite } = parseArgs();

  await loadAllTests(suite!);

  const filter = (t: any) => {
    // Apply secondary filters (tag and name) if provided
    if (tag && !(t.tags || []).includes(tag)) return false;
    if (name && !t.name.toLowerCase().includes(name.toLowerCase())) return false;
    return true;
  };

  const results = await runAllTests({ filter });
  const text = formatSuiteResultsText(results);
  console.log(text);
  process.exitCode = results.failed > 0 ? 1 : 0;

  clearTests();
  } catch (err: any) {
    console.error('Test runner failed:', err?.stack || err?.message || err);
    process.exitCode = 1;
  }
})();
