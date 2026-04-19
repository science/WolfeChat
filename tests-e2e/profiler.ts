/**
 * E2E Test Profiler
 *
 * Lightweight phase-timing utility for understanding where test time is spent.
 *
 * Usage in tests:
 *   import { createProfiler } from '../profiler';
 *   const prof = createProfiler('my-test');
 *   prof.start('bootstrap');
 *   await bootstrapLiveAPI(page);
 *   prof.end('bootstrap');
 *   prof.start('send-message');
 *   await sendMessage(page, 'Hello');
 *   prof.end('send-message');
 *   prof.start('wait-response');
 *   await waitForAssistantDone(page);
 *   prof.end('wait-response');
 *   prof.report(); // prints summary
 *
 * Usage with page-level network tracking:
 *   prof.attachNetworkTracking(page);
 *   // ... test code ...
 *   prof.report(); // includes network stats
 *
 * Environment:
 *   PROFILE=1  Enable profiling output (always-on if createProfiler is called)
 */

import type { Page } from '@playwright/test';

interface PhaseEntry {
  name: string;
  startMs: number;
  endMs: number | null;
  durationMs: number | null;
}

interface NetworkEntry {
  url: string;
  method: string;
  startMs: number;
  endMs: number | null;
  durationMs: number | null;
  status: number | null;
  phase: string | null; // which phase was active when request started
}

export interface TestProfiler {
  /** Mark the start of a named phase */
  start(phase: string): void;
  /** Mark the end of the current or named phase */
  end(phase?: string): void;
  /** Attach network request/response tracking to a Playwright page */
  attachNetworkTracking(page: Page): void;
  /** Print a summary report to console */
  report(): ProfileReport;
  /** Get raw data for programmatic use */
  getData(): ProfileReport;
}

export interface ProfileReport {
  testName: string;
  totalMs: number;
  phases: Array<{ name: string; durationMs: number; pct: string }>;
  network: {
    totalRequests: number;
    apiRequests: number;
    apiTotalMs: number;
    slowestRequest: { url: string; durationMs: number } | null;
    requests: Array<{ url: string; method: string; durationMs: number; status: number | null; phase: string | null }>;
  };
  unaccountedMs: number;
}

// Global store: profiler data keyed by test name, so the reporter can access it
const _globalProfilerStore = new Map<string, ProfileReport>();

/** Access the global profiler store (used by the reporter) */
export function getProfilerStore(): Map<string, ProfileReport> {
  return _globalProfilerStore;
}

export function createProfiler(testName: string): TestProfiler {
  const createdAt = Date.now();
  const phases: PhaseEntry[] = [];
  const networkEntries: NetworkEntry[] = [];
  let currentPhase: string | null = null;

  function getCurrentPhase(): string | null {
    return currentPhase;
  }

  return {
    start(phase: string) {
      // Auto-end previous phase if still open
      if (currentPhase) {
        this.end(currentPhase);
      }
      phases.push({
        name: phase,
        startMs: Date.now(),
        endMs: null,
        durationMs: null,
      });
      currentPhase = phase;
    },

    end(phase?: string) {
      const targetName = phase || currentPhase;
      if (!targetName) return;

      const entry = phases.find(p => p.name === targetName && p.endMs === null);
      if (entry) {
        entry.endMs = Date.now();
        entry.durationMs = entry.endMs - entry.startMs;
      }
      if (currentPhase === targetName) {
        currentPhase = null;
      }
    },

    attachNetworkTracking(page: Page) {
      const requestTimestamps = new Map<string, { startMs: number; phase: string | null; url: string; method: string }>();

      page.on('request', (request) => {
        const url = request.url();
        // Track API calls and any slow requests
        if (url.includes('api.openai.com') || url.includes('api.anthropic.com') || url.includes('/v1/')) {
          const key = `${request.method()}:${url}:${Date.now()}`;
          requestTimestamps.set(key, {
            startMs: Date.now(),
            phase: getCurrentPhase(),
            url: url,
            method: request.method(),
          });
          // Store the key on the request for lookup in response handler
          (request as any).__profilerKey = key;
        }
      });

      page.on('response', (response) => {
        const request = response.request();
        const key = (request as any).__profilerKey;
        if (key && requestTimestamps.has(key)) {
          const entry = requestTimestamps.get(key)!;
          const endMs = Date.now();
          networkEntries.push({
            url: entry.url,
            method: entry.method,
            startMs: entry.startMs,
            endMs,
            durationMs: endMs - entry.startMs,
            status: response.status(),
            phase: entry.phase,
          });
          requestTimestamps.delete(key);
        }
      });

      // Handle failed requests (aborted, etc.)
      page.on('requestfailed', (request) => {
        const key = (request as any).__profilerKey;
        if (key && requestTimestamps.has(key)) {
          const entry = requestTimestamps.get(key)!;
          const endMs = Date.now();
          networkEntries.push({
            url: entry.url,
            method: entry.method,
            startMs: entry.startMs,
            endMs,
            durationMs: endMs - entry.startMs,
            status: null,
            phase: entry.phase,
          });
          requestTimestamps.delete(key);
        }
      });
    },

    report(): ProfileReport {
      // Auto-end any open phase
      if (currentPhase) {
        this.end(currentPhase);
      }

      const totalMs = Date.now() - createdAt;
      const phaseDurations = phases
        .filter(p => p.durationMs !== null)
        .map(p => ({
          name: p.name,
          durationMs: p.durationMs!,
          pct: totalMs > 0 ? ((p.durationMs! / totalMs) * 100).toFixed(1) + '%' : '0%',
        }));

      const accountedMs = phaseDurations.reduce((sum, p) => sum + p.durationMs, 0);
      const unaccountedMs = totalMs - accountedMs;

      // Network summary
      const apiRequests = networkEntries.filter(n =>
        n.url.includes('api.openai.com') || n.url.includes('api.anthropic.com')
      );
      const apiTotalMs = apiRequests.reduce((sum, n) => sum + (n.durationMs || 0), 0);
      const slowest = networkEntries.length > 0
        ? networkEntries.reduce((a, b) => (a.durationMs || 0) > (b.durationMs || 0) ? a : b)
        : null;

      const report: ProfileReport = {
        testName,
        totalMs,
        phases: phaseDurations,
        network: {
          totalRequests: networkEntries.length,
          apiRequests: apiRequests.length,
          apiTotalMs,
          slowestRequest: slowest ? { url: shortUrl(slowest.url), durationMs: slowest.durationMs || 0 } : null,
          requests: networkEntries.map(n => ({
            url: shortUrl(n.url),
            method: n.method,
            durationMs: n.durationMs || 0,
            status: n.status,
            phase: n.phase,
          })),
        },
        unaccountedMs,
      };

      // Print report
      const enabled = process.env.PROFILE || process.env.DEBUG;
      if (enabled) {
        printReport(report);
      }

      // Store in global map for reporter access
      _globalProfilerStore.set(testName, report);

      return report;
    },

    getData(): ProfileReport {
      return this.report();
    },
  };
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/v1\//, '');
  } catch {
    return url.slice(-60);
  }
}

function printReport(report: ProfileReport) {
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ⏱  PROFILE: ${report.testName} (${formatMs(report.totalMs)} total)`);
  lines.push('  ' + '─'.repeat(68));

  // Phase breakdown
  if (report.phases.length > 0) {
    const maxNameLen = Math.max(...report.phases.map(p => p.name.length));
    for (const phase of report.phases) {
      const bar = makeBar(phase.durationMs, report.totalMs, 30);
      lines.push(`  ${phase.name.padEnd(maxNameLen)}  ${formatMs(phase.durationMs).padStart(8)}  ${phase.pct.padStart(6)}  ${bar}`);
    }
    if (report.unaccountedMs > 50) {
      const pct = ((report.unaccountedMs / report.totalMs) * 100).toFixed(1) + '%';
      const bar = makeBar(report.unaccountedMs, report.totalMs, 30);
      lines.push(`  ${'(untracked)'.padEnd(Math.max(...report.phases.map(p => p.name.length)))}  ${formatMs(report.unaccountedMs).padStart(8)}  ${pct.padStart(6)}  ${bar}`);
    }
  }

  // Network summary
  if (report.network.totalRequests > 0) {
    lines.push('  ' + '─'.repeat(68));
    lines.push(`  Network: ${report.network.totalRequests} requests, ${report.network.apiRequests} API calls (${formatMs(report.network.apiTotalMs)} total API wait)`);
    if (report.network.slowestRequest) {
      lines.push(`  Slowest: ${report.network.slowestRequest.url} (${formatMs(report.network.slowestRequest.durationMs)})`);
    }
    // Show individual API requests
    for (const req of report.network.requests) {
      const phase = req.phase ? ` [${req.phase}]` : '';
      const status = req.status ? ` ${req.status}` : ' FAIL';
      lines.push(`    ${req.method.padEnd(4)} ${req.url.padEnd(30)} ${formatMs(req.durationMs).padStart(8)}${status}${phase}`);
    }
  }

  lines.push('');
  console.log(lines.join('\n'));
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function makeBar(value: number, total: number, width: number): string {
  if (total === 0) return '';
  const filled = Math.round((value / total) * width);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}
