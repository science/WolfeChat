# Nonlive migration notes

Record / replay harness for reasoning-UI specs — live behaviour captured once,
replayed deterministically thereafter.

## Why

The reasoning-UI specs in `tests-e2e/live/` were ~5–10% flaky under full-suite
load because they depended on OpenAI's `gpt-5.4-nano` non-deterministically
choosing to emit `response.reasoning_summary_*` SSE events. A provider-side
A/B probe confirmed the flakiness was API-side, not client-side. The tests
don't actually need a live API — they assert reasoning-window UI behaviour,
which is provider-agnostic.

## Which specs migrated

| Live path (deleted) | New nonlive path | Fixture files |
|---|---|---|
| `reasoning-windows.spec.ts` | `reasoning-windows.spec.ts` | `reasoning-windows-*.body` (5 fixtures) |
| `reasoning-windows-placement.spec.ts` | `reasoning-windows-placement.spec.ts` | `rw-placement-*.body` (8 fixtures) |
| `reasoning-panels-delete-bug.spec.ts` | `reasoning-panels-delete-bug.spec.ts` | `delete-bug-reasoning.body` |
| `reasoning-orphan-window-bug.spec.ts` (OpenAI half) | `reasoning-orphan-window-openai.spec.ts` | `orphan-openai-*.body` (2 fixtures) |
| `reasoning-auto-collapse-setting.spec.ts` | `reasoning-auto-collapse-setting.spec.ts` | `autocollapse-openai-reasoning.body`, `autocollapse-anthropic-reasoning.body` |

The Anthropic half of `reasoning-orphan-window-bug.spec.ts` stays live because
reproducing the bug requires a mid-stream abort, which replay cannot simulate
(the fixture is fulfilled as one buffered body).

## How the harness works

`tests-e2e/nonlive/mock-helpers.ts` exports three pieces:

- `fixtureRecordOrReplay(page, opts)` — single-fixture variant.
- `fixturesRecordOrReplaySeq(page, opts)` — multi-fixture variant for tests
  that send several messages (fixtures consumed in order).
- `waitForStreamIdle(page, expectedCount)` — DOM-only idle waiter. Replaces
  `waitForAssistantDone` for replay-mode specs. `waitForAssistantDone` has
  a 20s internal `page.waitForResponse` call; in replay, `route.fulfill`
  fires before that subscription exists, so the wait always times out.
  `waitForStreamIdle` checks the same signals via DOM only.

**Recording uses `route.fetch()`, not `page.on('response')`.** Chromium GCs
response bodies when the next request arrives; the old listener-based
approach worked for single-body captures but lost the 2nd-and-later bodies
in a sequence. `route.fetch()` reads the full body synchronously server-side
before the browser sees the response — race-free.

**Playwright HAR does not handle SSE.** Empirically verified 2026-04-18:
`browserContext.routeFromHAR({ update: true })` records metadata for a
`text/event-stream` 200 response but drops the body (`size: -1`, no
`_file`, no `text`). Confirmed public issue
([microsoft/playwright#15353](https://github.com/microsoft/playwright/issues/15353)).
Our plain-text fixture harness bypasses this.

## Regenerating fixtures

The `record` Playwright project exists only for this purpose. It has
`workers: 1`, `fullyParallel: false`, and matches BOTH `nonlive/` and
`live/` spec paths so probes can also record.

```bash
# Single spec:
RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-windows.spec.ts --project=record

# Single test within a spec:
RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-auto-collapse-setting.spec.ts \
  --project=record -g "OpenAI: with auto-collapse enabled"
```

Recording requires the real `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in
the env (the spec's `RECORDING` branch hits `bootstrapLiveAPI`). Each fixture
costs a few cents of API time.

Commit the regenerated `.body` + `.meta.json` pair under
`tests-e2e/fixtures/` alongside the spec change.

## Phase 0 smoke — `probe-fixture-*.spec.ts`

Two live-only probes live in `tests-e2e/live/` to prove the harness keeps
working end-to-end against real APIs:

- `probe-fixture-harness.spec.ts` — OpenAI
- `probe-fixture-anthropic.spec.ts` — Anthropic (SDK-internal fetch)

They're tiny (~40 lines each) and exercise the full record→replay loop.
Delete once the migration has bedded in, or keep as a lightweight drift
detector.
