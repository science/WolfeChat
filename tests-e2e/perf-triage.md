# Perf / flakiness triage — 2026-04-19

First-pass baseline collected against commit `4957a28`. Source data:

- `tests-e2e/perf-baselines/nonlive.json` — 97 tests, ~82 s total, 0 flaky
- `tests-e2e/perf-baselines/stability-nonlive.json` — 291 runs (× 3), 0 flaky
- `tests-e2e/perf-baselines/live.json` — 96 tests, 14.8 min total, 3 failed
- `tests-e2e/perf-baselines/stability-live.json` — pending (running 3 ×)

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

## Deferred until stability-live completes

Flakiness stats will show up once the 3× live run finishes. Any test
with `passRate < 1.0` is a top priority for migration regardless of
speed.
