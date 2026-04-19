# Test perf + stability — operator guide

Every Playwright run prints a timing summary and writes machine-readable
JSON to `test-results/perf.json`. Use it to find slow tests and catch
flakes.

## Where the data lives

- **Console summary** — printed by `ProfileReporter` after `list` output.
  Shows slowest tests, per-file totals, and a ⚠ Flaky section if any
  test failed some runs.
- **JSON** — `test-results/perf.json` (gitignored). Rewritten on every
  Playwright run. Fields:
  - `runs[]` — one entry per TestResult (multiple entries per test when
    `--repeat-each` or `--retries` is active).
  - `tests[]` — aggregated per `{file, title}`: `runs`, `passes`, `fails`,
    `passRate`, `status` (`passed` / `flaky` / `failed` / `skipped`),
    `medianMs`, `p95Ms`.
  - `flakyCount`, `failedCount` — headline counts.
- **Committed baselines** — `tests-e2e/perf-baselines/*.json`. Snapshots
  of known-good runs. Compare against them to spot regressions.

## Finding slow tests

Run either E2E suite; sort the `tests` array in the JSON by `medianMs`:

```bash
npm run test:browser        # nonlive
npm run test:browser-live   # live

jq '.tests | sort_by(-.medianMs) | .[0:10]' test-results/perf.json
```

Slowness bands:
- **< 5 s** — fine, don't optimise.
- **5–15 s** — worth investigating, usually fixable with the replay
  harness (for live) or a DOM-only idle waiter (for nonlive).
- **> 15 s** — unless it's an explicit timing/regression test, it
  should be migrated.

## Finding flaky tests

Flakiness needs multiple runs of the same test:

```bash
npm run test:stability          # --project=live  --repeat-each=3
npm run test:stability-nonlive  # --project=nonlive --repeat-each=3
```

Tests with `passRate < 1.0` appear in the ⚠ Flaky section of the console
output and as `status: "flaky"` in the JSON. Nonlive should be 100%
deterministic — a flaky nonlive test is a test bug, not a provider
issue.

## Triage categories

From `FAILING-TESTS-ANALYSIS.md` (pre-reasoning-migration) plus what the
replay harness added:

| Category | Signal | Fix |
|---|---|---|
| Provider-agnostic live test, flaky | OpenAI/Anthropic test that asserts UI state | Migrate to replay (see `nonlive/MIGRATION_NOTES.md`) |
| Nonlive uses `waitForAssistantDone` | ~20 s per wait in replay | Swap for `waitForStreamIdle` from `mock-helpers.ts` |
| WSL2 screenshot hang | Test contains `page.screenshot()` + hangs 60/120 s | Delete the debug screenshot (not an assertion) |
| Stale model/assertion names | Test expects a model id that no longer exists | Update pattern |
| Genuinely timing-sensitive | `title-generation-async-timing.spec.ts` and friends | Accept; document here |

## Regenerating a baseline

After landing perf improvements (or when the test set changes):

```bash
npm run test:browser
cp test-results/perf.json tests-e2e/perf-baselines/nonlive.json

npm run test:browser-live
cp test-results/perf.json tests-e2e/perf-baselines/live.json

npm run test:stability
cp test-results/perf.json tests-e2e/perf-baselines/stability-live.json
```

Commit the diffs.

## Deep-diving a single slow test

`tests-e2e/profiler.ts` + `tests-e2e/profiled-test.ts` add per-phase +
per-request timing inside one spec. Import `test` from `profiled-test`
instead of `@playwright/test`, sprinkle `profiler.start('phase')` /
`profiler.end()` calls, and run with `PROFILE=1`. Useful when a test is
slow but you don't know which of setup/stream/teardown owns the time.
