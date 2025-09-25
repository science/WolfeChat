#!/usr/bin/env node
/**
 * Test runner for Wolfechat - runs tests directly in Node.js
 * Bypasses ts-node compilation issues by using native Node.js ES modules
 */
import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';
import { TextDecoder } from 'util';
import fastGlob from 'fast-glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = clearTimeout;
global.performance = performance;
global.TextDecoder = TextDecoder;

// Mock localStorage
const localStorageMap = new Map();
global.localStorage = {
  getItem: (key) => localStorageMap.get(key) || null,
  setItem: (key, value) => localStorageMap.set(key, String(value)),
  removeItem: (key) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
};

// Add MutationObserver polyfill for test environment
global.MutationObserver = class MutationObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Add IndexedDB mock for test environment
global.indexedDB = {
  open: () => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      createObjectStore: () => ({}),
      transaction: () => ({
        objectStore: () => ({
          put: () => ({ onsuccess: null, onerror: null }),
          get: () => ({ onsuccess: null, onerror: null, result: null }),
          delete: () => ({ onsuccess: null, onerror: null })
        })
      }),
      close: () => {}
    }
  }),
  deleteDatabase: () => ({ onsuccess: null, onerror: null })
};

// Add Prism mock for test environment
global.Prism = {
  highlight: (code, grammar, language) => {
    // Simple mock that wraps code in spans to simulate tokenization
    return `<span class="token">${code}</span>`;
  },
  languages: {
    javascript: {},
    typescript: {},
    python: {},
    html: {},
    css: {},
    json: {}
  },
  highlightElement: (element) => {
    if (element && element.textContent) {
      element.innerHTML = `<span class="token">${element.textContent}</span>`;
    }
  }
};

// Seed stores; map env key if available
function seedTestStores() {
  // Seed model cache with reasoning-capable models
  const models = [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' }
  ];
  localStorageMap.set('models', JSON.stringify(models));
  localStorageMap.set('selectedModel', 'gpt-5-nano'); // Use reasoning-capable model
  
  // Seed reasoning settings with defaults
  localStorageMap.set('reasoning_effort', 'medium');
  localStorageMap.set('reasoning_verbosity', 'medium');
  localStorageMap.set('reasoning_summary', 'auto');
  
  // Set other required defaults
  localStorageMap.set('selectedVoice', 'alloy');
  localStorageMap.set('selectedMode', 'GPT');
  localStorageMap.set('selectedSize', '1024x1024');
  localStorageMap.set('selectedQuality', 'standard');

  // Prefer real env key for live tests; fallback for unit tests
  const envKey = process.env.OPENAI_API_KEY || null;
  if (envKey) {
    localStorageMap.set('api_key', JSON.stringify(envKey));
  } else {
    localStorageMap.set('api_key', JSON.stringify('test-api-key'));
  }
  
  // Initialize conversations with proper structure
  const testConversation = {
    id: 'conv-test-123',
    history: [],
    conversationTokens: 0,
    assistantRole: "Test assistant role",
    title: "Test Conversation"
  };
  localStorageMap.set('conversations', JSON.stringify([testConversation]));
  localStorageMap.set('default_assistant_role', JSON.stringify({
    role: "Test assistant",
    type: "system"
  }));
}

// Seed the stores before running tests
seedTestStores();

// Fix DOM measurements for scroll tests
// JSDOM doesn't properly compute layout, so we need to override element properties
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  get: function() {
    // Return the height style if set, otherwise return clientHeight
    const height = parseInt(this.style.height) || 0;
    return Math.max(height, this.clientHeight || 0);
  },
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  get: function() {
    // Return the height style if set
    return parseInt(this.style.height) || 500; // Default container height in tests
  },
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  get: function() {
    return this._scrollTop || 0;
  },
  set: function(value) {
    this._scrollTop = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
    // Trigger scroll event
    const event = new dom.window.Event('scroll');
    this.dispatchEvent(event);
  },
  configurable: true
});

// Import test harness
async function loadTestHarness(suite) {
  try {
    // First compile the test harness and related files
    const { execSync } = await import('child_process');
    
    // Compile TypeScript files to JavaScript - compile each test file separately
    console.log(`Compiling ${suite} test files...`);
    
    // Clean build directory
    execSync(`rm -rf .test-build && mkdir -p .test-build`, { stdio: 'pipe' });
    
    // Determine which test files to compile based on suite
    let patterns = [];
    switch (suite) {
      case 'unit':
        patterns = [
          'src/tests/unit/**/*.test.ts'
        ];
        break;
      case 'browser-nonlive':
        patterns = [
          'src/tests/browser-nonlive/**/*.test.ts'
        ];
        break;
      case 'live':
        patterns = ['src/tests/live/**/*.test.ts'];
        break;
      case 'browser-live':
        patterns = ['src/tests/browser-live/**/*.test.ts'];
        break;
      case 'all':
        patterns = [
          'src/tests/unit/**/*.test.ts',
          'src/tests/browser-nonlive/**/*.test.ts',
          'src/tests/live/**/*.test.ts',
          'src/tests/browser-live/**/*.test.ts'
        ];
        break;
      case 'nonapi': // Deprecated - kept for backward compatibility, maps to unit
        console.log('Note: "nonapi" suite is deprecated. Use "unit" instead.');
        patterns = [
          'src/tests/unit/**/*.test.ts'
        ];
        break;
    }
    
    const testFiles = await fastGlob(patterns, { 
      cwd: __dirname, 
      absolute: false,
      ignore: ['**/deleteAllBelowButton.test.ts'] // Skip tests that require full Svelte environment
    });
    
    // Create a single entry point that imports all test files
    const entryContent = [
      '// Auto-generated test entry point',
      "export { runAllTests, formatSuiteResultsText, clearTests } from './src/tests/testHarness.js';",
      ...testFiles.map(file => `import './${file}';`)
    ].join('\n');
    
    await import('fs').then(fs => 
      fs.promises.writeFile(path.join(__dirname, '.test-entry.ts'), entryContent)
    );
    
    // First copy the mock idb.js to override the real one
    execSync(`cp src/tests/mocks/idb.js src/idb.js.backup 2>/dev/null || true`, { stdio: 'pipe' });
    execSync(`cp src/tests/mocks/idb.js src/idb.js`, { stdio: 'pipe' });
    
    try {
      // Bundle everything together
      execSync(`npx esbuild \
        .test-entry.ts \
        --bundle \
        --platform=node \
        --format=esm \
        --outfile=.test-build/bundle.js \
        --external:jsdom \
        --external:fast-glob \
        --external:svelte \
        --external:svelte/* \
        --external:openai \
        --external:prismjs \
        --external:sse.js \
        --external:puppeteer \
        --external:svelte-markdown \
        --loader:.svelte=empty`, {
        stdio: 'pipe'
      });
    } finally {
      // Restore the original idb.js if it existed
      execSync(`mv src/idb.js.backup src/idb.js 2>/dev/null || rm -f src/idb.js 2>/dev/null || true`, { stdio: 'pipe' });
    }
    
    console.log(`Compiled ${testFiles.length} test files into bundle`);
    
    // Load the bundled module which includes test harness and all tests
    const bundleModule = await import(path.join(__dirname, '.test-build/bundle.js'));
    return bundleModule;
  } catch (error) {
    console.error('Failed to load test harness:', error);
    process.exit(1);
  }
}

async function loadAllTests(suite) {
  // The bundle already contains all tests for the suite, just return the harness
  console.log(`Tests loaded for suite: ${suite}`);
  return;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { tag: null, name: null, suite: 'unit' };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-t' || arg === '--tag') && args[i + 1]) {
      opts.tag = args[++i];
    } else if ((arg === '-n' || arg === '--name') && args[i + 1]) {
      opts.name = args[++i];
    } else if ((arg === '-s' || arg === '--suite' || arg === '--group') && args[i + 1]) {
      const suiteArg = args[++i].toLowerCase();
      if (['unit', 'browser-nonlive', 'live', 'browser-live', 'all', 'nonapi'].includes(suiteArg)) {
        opts.suite = suiteArg;
      }
    } else if (arg === '--live') {
      opts.suite = 'live';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node run-tests.mjs [options]

Options:
  -s, --suite <name>   Run test suite: 'unit' (default), 'browser-nonlive', 'live', 'browser-live', or 'all'
  --group <name>       Alias for --suite
  --live               Shorthand for --suite live
  -t, --tag <tag>      Filter tests by tag
  -n, --name <name>    Filter tests by name (substring match)
  -h, --help           Show this help message

Test Suites:
  unit             Unit tests that run in Node.js with JSDOM
  browser-nonlive  Tests that require a browser environment (not yet implemented)
  live             Tests that require internet connectivity
  all              Run all test suites
  nonapi           (Deprecated) Alias for 'unit'

Examples:
  node run-tests.mjs                    # Run unit tests (default)
  node run-tests.mjs --suite live       # Run live/API tests
  node run-tests.mjs --suite all        # Run all tests
  node run-tests.mjs --tag keyboard     # Run tests tagged 'keyboard'
`);
      process.exit(0);
    }
  }
  
  return opts;
}

async function main() {
  try {
    const { tag, name, suite } = parseArgs();
    
    const harness = await loadTestHarness(suite);
    const { runAllTests, formatSuiteResultsText, clearTests } = harness;
    
    await loadAllTests(suite);
    
    const filter = (test) => {
      if (tag && !(test.tags || []).includes(tag)) return false;
      if (name && !test.name.toLowerCase().includes(name.toLowerCase())) return false;
      return true;
    };
    
    const results = await runAllTests({ filter });
    const text = formatSuiteResultsText(results);
    console.log(text);
    
    clearTests();

    // Clean teardown: close JSDOM window to release timers/handles keeping event loop alive
    try {
      if (global.window && typeof global.window.close === 'function') {
        global.window.close();
      }
    } catch {}

    process.exitCode = results.failed > 0 ? 1 : 0;
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exitCode = 1;
  }
}

main();