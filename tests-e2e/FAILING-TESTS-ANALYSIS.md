# Failing E2E Tests Analysis

**Date:** 2026-01-29
**Baseline:** 113 passed, 24 failed, 4 did not run (out of 141 total)

## Root Cause Categories

### Category A: `page.screenshot()` hangs (8-10 tests)

**Root cause:** Same WSL2 headless Chrome issue as the click/waitForFunction fix.
`page.screenshot()` requires a rendering frame from the browser, which never fires
in headless Chromium on WSL2. All stop-button tests contain `page.screenshot()` calls
that hang, causing the test to timeout at 60s or 120s.

**Files affected:**
- `stop-button.spec.ts` (2 screenshot calls, lines 58, 209)
- `stop-button-reasoning.spec.ts` (6 screenshot calls)
- `reasoning-panels-delete-bug.spec.ts` (1 screenshot call)
- `reasoning-orphan-window-bug.spec.ts` (1 screenshot call)

**Fix:** Remove or conditionally skip `page.screenshot()` calls. These are debug
screenshots, not test assertions.

### Category B: `expect(locator).toHaveValue('')` in sendMessage (2 tests)

**Root cause:** The `sendMessage` helper's `waitForEmpty` check uses
`expect(input).toHaveValue('', { timeout: 5000 })` which relies on Playwright's
auto-retrying assertions. These may use rAF-based polling internally and could
be hanging. Alternatively, the app may genuinely not clear the input in some
conditions (e.g., when streaming is active from a previous message).

**Files affected:**
- `reasoning-windows-placement.spec.ts:97` (RW placement stability)
- `reasoning-windows-placement.spec.ts:168` (non-reasoning vs reasoning)

**Investigation needed:** Determine if `toHaveValue` hangs (infrastructure) or
if the input genuinely doesn't clear (app bug).

### Category C: Stale model name assertions (2-4 tests)

**Root cause:** Test expectations hardcode model names that no longer exist in
the API response. Anthropic models have been renamed/updated.

**Files affected:**
- `provider-api-validation.spec.ts:77` — expects `claude-4-opus` or `claude-3-opus`
- `provider-api-validation.spec.ts:127` — Anthropic invalid key test
- `test-dropdown-helper.spec.ts:157` — provider detection returns `"unknown"`

**Fix:** Update model name patterns to match current API responses.

### Category D: API timing / transient failures (5-7 tests)

**Root cause:** Live API responses don't arrive within timeout, or reasoning
models take too long. These are inherently flaky with live APIs.

**Files affected:**
- Various reasoning-auto-collapse, reasoning-window, token-counting tests
- `quick-settings-conversation-state-bug.spec.ts`

**Not fixable:** These are transient live API issues. May improve with longer
timeouts or retry configuration.

### Category E: Summary feature test failure (1 test)

**Root cause:** `summary-model-settings.spec.ts:109` — summary-message element
never appeared. May be API timing or a genuine summary feature bug.

## Priority Order

1. **Category A** (screenshot hang) — pure infrastructure, easy fix, unblocks 8+ tests
2. **Category B** (toHaveValue) — needs investigation, could be app bug
3. **Category C** (stale assertions) — test maintenance, quick fix
4. **Category D** (API timing) — inherent flakiness, lower priority
5. **Category E** (summary) — needs investigation
