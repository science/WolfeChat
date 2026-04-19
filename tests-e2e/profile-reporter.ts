/**
 * Playwright Profile Reporter
 *
 * A custom reporter that outputs per-test timing breakdowns.
 * Works in two modes:
 *
 * 1. **Basic mode** (always active): Shows per-test wall-clock time from
 *    Playwright's built-in timing, sorted slowest-first.
 *
 * 2. **Detailed mode** (when tests use createProfiler): Shows phase-level
 *    breakdowns within each test.
 *
 * Usage:
 *   PROFILE=1 npx playwright test --project=live --reporter=./tests-e2e/profile-reporter.ts
 *
 * Or add to playwright.config.ts:
 *   reporter: [['./tests-e2e/profile-reporter.ts']]
 */

import type {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface TestTiming {
  title: string;
  file: string;
  durationMs: number;
  status: string;
  // Breakdown of Playwright's own phases
  phases: {
    setupMs: number;    // beforeEach + fixture setup
    testMs: number;     // actual test body
    teardownMs: number; // afterEach + cleanup
  } | null;
}

class ProfileReporter implements Reporter {
  private testTimings: TestTiming[] = [];
  private suiteStartTime: number = 0;
  private outputFile: string | null = null;

  constructor(options?: { outputFile?: string }) {
    this.outputFile = options?.outputFile || null;
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.suiteStartTime = Date.now();
    this.testTimings = [];
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const file = path.relative(process.cwd(), test.location.file);

    // Extract step-level timing if available
    let phases: TestTiming['phases'] = null;
    if (result.steps && result.steps.length > 0) {
      let setupMs = 0;
      let teardownMs = 0;
      let testMs = 0;

      for (const step of result.steps) {
        const dur = step.duration;
        if (step.category === 'hook' || step.title.includes('Before')) {
          setupMs += dur;
        } else if (step.title.includes('After')) {
          teardownMs += dur;
        } else {
          testMs += dur;
        }
      }
      phases = { setupMs, testMs, teardownMs };
    }

    this.testTimings.push({
      title: test.title,
      file,
      durationMs: result.duration,
      status: result.status,
      phases,
    });
  }

  onEnd(result: FullResult) {
    const totalMs = Date.now() - this.suiteStartTime;

    // Sort by duration descending
    const sorted = [...this.testTimings].sort((a, b) => b.durationMs - a.durationMs);

    // Aggregate by {file, title} so --repeat-each and --retries contribute
    // multiple TestResults under the same key. passRate < 1.0 → flaky.
    interface TestGroup {
      title: string;
      file: string;
      runs: number;
      passes: number;
      fails: number;
      skipped: number;
      passRate: number;
      durations: number[];
      medianMs: number;
      p95Ms: number;
      status: 'passed' | 'flaky' | 'failed' | 'skipped';
    }
    const byGroup = new Map<string, TestGroup>();
    for (const t of this.testTimings) {
      const key = `${t.file}::${t.title}`;
      let g = byGroup.get(key);
      if (!g) {
        g = { title: t.title, file: t.file, runs: 0, passes: 0, fails: 0, skipped: 0,
              passRate: 0, durations: [], medianMs: 0, p95Ms: 0, status: 'passed' };
        byGroup.set(key, g);
      }
      g.runs++;
      if (t.status === 'passed') g.passes++;
      else if (t.status === 'skipped') g.skipped++;
      else g.fails++;
      g.durations.push(t.durationMs);
    }
    for (const g of byGroup.values()) {
      const nonSkipped = g.runs - g.skipped;
      g.passRate = nonSkipped > 0 ? g.passes / nonSkipped : 1;
      g.status = nonSkipped === 0 ? 'skipped'
               : g.passRate === 1 ? 'passed'
               : g.passes === 0 ? 'failed'
               : 'flaky';
      const sortedDur = [...g.durations].sort((a, b) => a - b);
      g.medianMs = percentile(sortedDur, 0.5);
      g.p95Ms = percentile(sortedDur, 0.95);
    }

    const lines: string[] = [];
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════╗');
    lines.push('║                     E2E TEST PROFILE SUMMARY                        ║');
    lines.push('╚══════════════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`  Total suite time: ${formatMs(totalMs)}  |  ${sorted.length} runs  |  ${byGroup.size} distinct tests  |  Status: ${result.status}`);
    lines.push('');

    // Flaky tests section — only interesting when passRate < 1.0
    const flaky = [...byGroup.values()].filter(g => g.status === 'flaky' || g.status === 'failed');
    if (flaky.length > 0) {
      flaky.sort((a, b) => a.passRate - b.passRate);
      lines.push('  ⚠  Flaky / failed tests:');
      lines.push('  ' + '─'.repeat(72));
      for (const f of flaky) {
        const marker = f.status === 'failed' ? '✗' : '⚠';
        const pct = Math.round(f.passRate * 100);
        lines.push(`  ${marker} ${f.title}  —  ${f.passes}/${f.runs - f.skipped} passed (${pct}%)  [${f.file}]`);
      }
      lines.push('');
    }

    // Per-test breakdown, sorted slowest first
    lines.push('  Tests by duration (slowest first):');
    lines.push('  ' + '─'.repeat(72));

    const maxTitleLen = Math.min(45, Math.max(...sorted.map(t => t.title.length)));

    for (const t of sorted) {
      const title = t.title.length > maxTitleLen
        ? t.title.slice(0, maxTitleLen - 2) + '..'
        : t.title.padEnd(maxTitleLen);
      const bar = makeBar(t.durationMs, sorted[0].durationMs, 20);
      const status = t.status === 'passed' ? '✓' : t.status === 'failed' ? '✗' : '○';
      const pct = totalMs > 0 ? ((t.durationMs / totalMs) * 100).toFixed(0) + '%' : '';
      lines.push(`  ${status} ${title}  ${formatMs(t.durationMs).padStart(8)}  ${pct.padStart(4)}  ${bar}`);
    }

    // File-level aggregation
    lines.push('');
    lines.push('  Tests by file:');
    lines.push('  ' + '─'.repeat(72));

    const byFile = new Map<string, { totalMs: number; count: number; tests: TestTiming[] }>();
    for (const t of sorted) {
      const shortFile = t.file.replace(/^tests-e2e\/live\//, '').replace(/\.spec\.ts$/, '');
      if (!byFile.has(shortFile)) {
        byFile.set(shortFile, { totalMs: 0, count: 0, tests: [] });
      }
      const entry = byFile.get(shortFile)!;
      entry.totalMs += t.durationMs;
      entry.count++;
      entry.tests.push(t);
    }

    const filesSorted = [...byFile.entries()].sort((a, b) => b[1].totalMs - a[1].totalMs);
    const maxFileLen = Math.min(40, Math.max(...filesSorted.map(([f]) => f.length)));

    for (const [file, data] of filesSorted) {
      const name = file.length > maxFileLen ? file.slice(0, maxFileLen - 2) + '..' : file.padEnd(maxFileLen);
      const bar = makeBar(data.totalMs, filesSorted[0][1].totalMs, 20);
      const avg = Math.round(data.totalMs / data.count);
      lines.push(`  ${name}  ${formatMs(data.totalMs).padStart(8)}  (${data.count} tests, avg ${formatMs(avg)})  ${bar}`);
    }

    // Timing buckets
    lines.push('');
    lines.push('  Distribution:');
    const buckets = [
      { label: '< 5s', max: 5000 },
      { label: '5-15s', max: 15000 },
      { label: '15-30s', max: 30000 },
      { label: '30-60s', max: 60000 },
      { label: '> 60s', max: Infinity },
    ];
    for (const bucket of buckets) {
      const prev = buckets[buckets.indexOf(bucket) - 1]?.max || 0;
      const count = sorted.filter(t => t.durationMs >= prev && t.durationMs < bucket.max).length;
      if (count > 0) {
        lines.push(`    ${bucket.label.padEnd(8)} ${count} tests`);
      }
    }

    lines.push('');

    console.log(lines.join('\n'));

    // Optionally write JSON for further analysis
    if (this.outputFile) {
      const groupsSorted = [...byGroup.values()].sort((a, b) => b.medianMs - a.medianMs);
      const jsonReport = {
        timestamp: new Date().toISOString(),
        totalMs,
        runCount: sorted.length,
        distinctTestCount: byGroup.size,
        status: result.status,
        flakyCount: [...byGroup.values()].filter(g => g.status === 'flaky').length,
        failedCount: [...byGroup.values()].filter(g => g.status === 'failed').length,
        // Per-run records (multiple entries per test under --repeat-each / --retries)
        runs: sorted.map(t => ({
          title: t.title,
          file: t.file,
          durationMs: t.durationMs,
          status: t.status,
        })),
        // Aggregated per-test stats — the main signal for slow/flaky triage
        tests: groupsSorted.map(g => ({
          title: g.title,
          file: g.file,
          runs: g.runs,
          passes: g.passes,
          fails: g.fails,
          skipped: g.skipped,
          passRate: g.passRate,
          status: g.status,
          medianMs: g.medianMs,
          p95Ms: g.p95Ms,
        })),
        byFile: Object.fromEntries(filesSorted.map(([f, d]) => [f, { totalMs: d.totalMs, count: d.count }])),
      };
      const outPath = path.resolve(process.cwd(), this.outputFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(jsonReport, null, 2));
      console.log(`  Profile data written to: ${outPath}\n`);
    }
  }
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(p * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(0);
  return `${min}m${sec}s`;
}

function makeBar(value: number, total: number, width: number): string {
  if (total === 0) return '';
  const filled = Math.round((value / total) * width);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}

export default ProfileReporter;
