# Perf / flakiness triage — 2026-04-19

First-pass baseline collected against commit `4957a28`. Source data:

- `tests-e2e/perf-baselines/nonlive.json` — 97 tests, ~82 s total, 0 flaky
- `tests-e2e/perf-baselines/stability-nonlive.json` — 291 runs (× 3), 0 flaky
- `tests-e2e/perf-baselines/live.json` — 96 tests, 14.8 min total, 3 failed
- `tests-e2e/perf-baselines/stability-live.json` — 288 runs (× 3), 41.8 min, 4 flaky, 2 failed

## Headline

- **Nonlive suite is healthy.** Slowest test is 4.4 s (debug/verify specs);
  stability run across 3 repeats produced 0 flakes. Replay determinism
  validated.
- **Live suite has real issues.** 15 tests take >15 s each; 4 take >45 s;
  3 tests fail outright. The distribution (53 tests <5 s, 43 tests ≥5 s)
  says roughly half the live suite is a candidate for speedup.

## Failures (0 % pass rate on the single baseline run)

| Test | File | Cause |
|---|---|---|
| `should show message count in summary` | `summary-ui.spec.ts:148` | Waits 60 s then fails: `[data-testid="summary-message"]` not found. Either app regression (testid removed/renamed) or upstream setup (clickSummarizeButton / waitForSummaryComplete) silently failed. Needs investigation against current app. |
| `fixture harness: record+replay OpenAI reasoning SSE` | `probe-fixture-harness.spec.ts` | Fixture `probe-reasoning-openai.body` missing — was not committed. Spec is marked "PHASE 0 SMOKE — delete after validated" at line 1. Delete candidate. |
| `fixture harness: record+replay Anthropic reasoning stream` | `probe-fixture-anthropic.spec.ts` | Same — fixture missing, same deletion marker. |

## Slow live tests (top 20, sorted by medianMs)

| ms | status | file :: test | disposition |
|---|---|---|---|
| 80693 | ✓ | quick-settings-conversation-state-bug :: settings persist and are honored when submitting | Investigate — 81 s is a lot even for live. May be migrate-to-replay candidate. |
| 65849 | ✗ | summary-ui :: should show message count in summary | Fix the failure first (see above). |
| 47528 | ✓ | provider-quick-settings :: recent models include both providers | Live API cycles across provider switches. Likely migrate-to-replay. |
| 47493 | ✓ | provider-quick-settings :: can switch models between providers | Same — likely replay. |
| 46199 | ✓ | quick-settings-recent-models :: switching models and sending messages | Same — likely replay. |
| 31980 | ✓ | anthropic-reasoning-auto-close :: auto-close for multiple consecutive | Replay candidate — pure UI invariant. |
| 25797 | ✓ | reasoning-window-conversation-id-bug-tdd :: fresh localStorage clear | Replay candidate. |
| 25516 | ✓ | anthropic-reasoning-auto-close :: auto-close when assistant starts | Replay candidate. |
| 24423 | ✓ | quick-settings-recent-models :: sending message adds to recent list | Replay candidate. |
| 21631 | ✓ | token-counting :: Claude Sonnet with reasoning | **Keep live** — asserts real token counts. |
| 20518 | ✓ | api-error-preserves-conversation :: Network error during streaming | Replay candidate (can mock the network error). |
| 19430 | ✓ | api-error-preserves-conversation :: Invalid API key | **Keep live** — asserts real error shape. |
| 18269 | ✓ | stop-button-reasoning :: OpenAI stop during reasoning | **Keep live** — mid-stream abort can't be mocked (same as Anthropic orphan case). |
| 15893 | ✓ | stop-button-reasoning :: Reasoning panels stop updating | Likely keep live — stop semantics. |
| 15288 | ✓ | stop-button-reasoning :: Anthropic stop during content | Keep live. |
| 14508 | ✓ | reasoning-sse-events-simple :: Capture exact SSE events | **Keep live** — whole point is real SSE shape. |
| 11747 | ✓ | test-dropdown-helper :: empty dropdown state | Helper-testing spec. Likely delete or migrate. |
| 11417 | ✓ | delete-all-below :: deletes messages below pivot | Replay candidate. |
| 10861 | ✓ | anthropic_two_messages_simple :: Two reasoning messages | Replay candidate. |
| 10320 | ✓ | stop-button-reasoning :: prevent reasoning windows from completing | Keep live — stop semantics. |

## Known slow nonlive outlier

- `reasoning-windows.spec.ts :: reasoning window reopens and minimizes correctly for consecutive messages` — median 42.3 s in the stability run (though only 2.0 s in single-run baseline; timing-race intermittent). Root cause: `waitForAssistantDone` has a 20 s internal `waitForResponse` that times out twice in this test under replay. Fix: swap to `waitForStreamIdle` (5-minute change).

## Suggested action plan (for a follow-up)

Rough payoff estimate based on ~14.8 min live suite:

1. **Fix `summary-ui` failure** — unknown payoff (need to diagnose).
2. **Delete the two probe specs** — removes 2 chronic failures from every
   run; ~1-min payoff.
3. **Swap consecutive-messages test to `waitForStreamIdle`** — nonlive
   regression: 42 s → ~1 s per run.
4. **Migrate the 4–5 provider-switching / recent-models live tests** —
   they take 46–47 s each in live, would be ~1-2 s in replay. ~3-4 min
   off the live suite.
5. **Investigate 81 s quick-settings-conversation-state-bug** — either
   migrate or tighten the spec's waits.
6. **Migrate anthropic-reasoning-auto-close (2 tests, 32 s + 25 s)** —
   ~55 s off live suite.

Total potential live-suite savings: ~5-7 min of 14.8 min (~35-45 %).

## Flakiness results (from stability-live, 3 × 96 tests = 288 runs)

### Persistent failures (0 / 3 passed)

| Test | Cause | Action |
|---|---|---|
| `probe-fixture-harness :: fixture harness: record+replay OpenAI reasoning SSE` | Fixture `probe-reasoning-openai.body` not committed. Spec is marked "PHASE 0 SMOKE — delete after validated." | **Delete**. |
| `probe-fixture-anthropic :: fixture harness: record+replay Anthropic reasoning stream` | Same — fixture missing, same marker. | **Delete**. |

### Flaky tests (2 / 3 passed, ≈67 % pass rate)

| Test | Median | p95 | File | Likely cause |
|---|---|---|---|---|
| `reasoning window should show content after fresh localStorage clear` | 26 s | 29 s | `reasoning-window-conversation-id-bug-tdd.spec.ts` | TDD test for a reported bug. Flakiness could be the bug manifesting. Needs investigation. |
| `summary should include message count in header` | 9 s | 66 s | `summary-model-settings.spec.ts` | Huge duration spread (9 s → 66 s) — a failing run hits the full 60 s timeout. Timing-sensitive summary-stream wait. |
| `should show message count in summary` | 5 s | 6 s | `summary-ui.spec.ts` | Same test that failed 0 / 1 in the single baseline run — so it's genuinely flaky, not a one-off. Likely same underlying cause as the summary-model-settings flake (summary stream race). |
| `checkApiKeysFromState utility works correctly` | 5 s | 6 s | `test-dropdown-helper.spec.ts` | Utility-test spec; may be dropdown state race. |

### Nothing else flaked

92 of 96 live tests passed 3 / 3. The reasoning-UI specs I migrated last
week are no longer in the live suite, so this validates that our
migration eliminated their contribution to live-suite flakiness.

## Suggested action plan (updated)

Priority order, based on combined slow + flaky signal:

1. **Delete the 2 probe specs** (`probe-fixture-*`). They're 100 %
   failing and marked for deletion. ~1-min payoff per live run.
2. **Investigate summary flakes** — two tests
   (`summary-model-settings :: message count in header`,
   `summary-ui :: should show message count in summary`) share a
   pattern: summary-stream wait that times out. Likely one root cause,
   fix yields two tests.
3. **Swap nonlive consecutive-messages test to `waitForStreamIdle`** —
   42 s → ~1 s. Easy win.
4. **Investigate `reasoning-window-conversation-id-bug-tdd` flake** —
   if the TDD bug is still real, file it separately; if the bug is
   fixed, the test is stale and can be migrated.
5. **Investigate `checkApiKeysFromState utility works correctly` flake**
   — utility tests shouldn't be flaky.
6. **Migrate the 46–80 s quick-settings & provider-switching tests to
   replay** — biggest wall-clock payoff (~3–5 min off live suite).
7. **Migrate the 25–32 s anthropic-reasoning-auto-close tests** — ~55 s
   off live.
8. **Investigate 81 s `quick-settings-conversation-state-bug :: Live:
   settings persist`** — slowest single test.

Estimated total savings from items 1–8:
- Wall-clock off live suite: ~6–8 min of 14.8 min (~40–55 %).
- Flakes eliminated: 4 of 4 current flakes, plus 2 persistent failures.
