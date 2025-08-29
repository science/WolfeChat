/**
 * src/tests/testHarness.ts
 * Simple test registry, runner, assertion helper, and global hook.
 */

export interface TestResult {
  id: string;
  name: string;
  success: boolean;
  durationMs: number;
  assertions: number;
  failures: number;
  details?: string;
  error?: any;
  meta?: Record<string, any>;
}

export interface Test {
  id: string;
  name: string;
  tags?: string[];
  timeoutMs?: number;
  fn: (assert: Assert) => Promise<void> | void;
}

export class Assert {
  assertions = 0;
  failures = 0;
  notes: string[] = [];
  that(cond: any, message: string) {
    this.assertions++;
    if (!cond) {
      this.failures++;
      this.notes.push(`FAIL: ${message}`);
    } else {
      this.notes.push(`OK: ${message}`);
    }
  }
}

type SuiteOptions = {
  filter?: (t: Test) => boolean;
};

let registry: Test[] = [];

export function registerTest(test: Test) {
  if (registry.some(t => t.id === test.id)) return;
  registry.push(test);
}

// Convenience function for defining and registering tests
export function test(testDef: Test) {
  registerTest(testDef);
}

export function clearTests() {
  registry = [];
}

export function listTests(): Test[] {
  return [...registry];
}

async function runOne(test: Test): Promise<TestResult> {
  const start = performance.now();
  const assert = new Assert();

  const run = async () => {
    await test.fn(assert);
  };

  const timeoutMs = test.timeoutMs ?? 30_000;
  let error: any | undefined;
  try {
    await Promise.race([
      run(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)),
    ]);
  } catch (e) {
    error = e;
    assert.notes.push(`ERROR: ${e?.message ?? String(e)}`);
    assert.failures++;
  }

  const durationMs = performance.now() - start;
  return {
    id: test.id,
    name: test.name,
    success: assert.failures === 0 && !error,
    durationMs,
    assertions: assert.assertions,
    failures: assert.failures,
    details: assert.notes.join('\n'),
    error,
  };
}

export interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

// Test isolation utilities
export function clearTestEnvironment() {
  // Clear all localStorage keys that could affect tests
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('selectedModel');
    localStorage.removeItem('conversations');
    localStorage.removeItem('default_assistant_role');
    localStorage.removeItem('selectedMode');
    localStorage.removeItem('selectedVoice');
    localStorage.removeItem('selectedSize');
    localStorage.removeItem('selectedQuality');
    localStorage.removeItem('combined_tokens');
    localStorage.removeItem('show_tokens');
    localStorage.removeItem('api_key'); // Be careful with this one - only clear if needed
  }
}

export async function withCleanEnvironment<T>(fn: () => Promise<T>): Promise<T> {
  clearTestEnvironment();
  try {
    return await fn();
  } finally {
    // Optionally restore environment if needed
  }
}

export async function withModel<T>(model: string, fn: () => Promise<T>): Promise<T> {
  if (typeof localStorage !== 'undefined') {
    const previousModel = localStorage.getItem('selectedModel');
    localStorage.setItem('selectedModel', model);
    
    // Also update the store if available
    try {
      const { selectedModel } = await import('../stores/stores.js');
      selectedModel.set(model);
    } catch (e) {
      // Store might not be available in all test contexts
    }
    
    try {
      return await fn();
    } finally {
      // Restore previous model
      if (previousModel !== null) {
        localStorage.setItem('selectedModel', previousModel);
      } else {
        localStorage.removeItem('selectedModel');
      }
    }
  } else {
    return await fn();
  }
}

export async function runAllTests(opts?: SuiteOptions): Promise<SuiteResult> {
  // Clear environment before running test suite
  clearTestEnvironment();
  
  // Set default model for tests if using the test model
  try {
    const { getReasoningModel } = await import('../tests/testModel.js');
    const { selectedModel } = await import('../stores/stores.js');
    const testModel = getReasoningModel();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('selectedModel', testModel);
    }
    selectedModel.set(testModel);
  } catch (e) {
    // Test model might not be available in all contexts
  }
  
  const tests = (opts?.filter ? registry.filter(opts.filter) : registry).slice();
  const suiteStart = performance.now();
  const results: TestResult[] = [];
  for (const t of tests) {
    // Run sequentially to avoid hitting rate limits
    const r = await runOne(t);
    results.push(r);
  }
  const durationMs = performance.now() - suiteStart;
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  return { total: results.length, passed, failed, durationMs, results };
}

export function formatSuiteResultsText(suite: SuiteResult): string {
  const lines: string[] = [];
  lines.push(`=== Test Harness Results ===`);
  lines.push(`Total: ${suite.total} | Passed: ${suite.passed} | Failed: ${suite.failed} | Duration: ${suite.durationMs.toFixed(0)}ms`);
  lines.push('');
  for (const r of suite.results) {
    lines.push(`- [${r.success ? 'PASS' : 'FAIL'}] ${r.name} (${r.durationMs.toFixed(0)}ms)`);
    if (r.details) {
      lines.push(r.details);
    }
    if (r.error) {
      lines.push(`Error: ${r.error?.message ?? String(r.error)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// Optional global hook for CI/CD or manual execution in browser console
declare global {
  interface Window {
    SmoothGPTTestHarness?: {
      listTests: () => Test[];
      runAll: () => Promise<SuiteResult>;
    };
  }
}

if (typeof window !== 'undefined') {
  window.SmoothGPTTestHarness = {
    listTests,
    runAll: () => runAllTests(),
  };
}
