// Single source of truth for test model selection.
//
// Every test target in the codebase should use TEST_MODEL + one of the
// reasoning-effort presets below. Do not pick a different model solely to
// avoid reasoning — use TEST_MODEL + REASONING_OFF instead (cheaper than
// gpt-4.1-nano and observationally identical to a non-reasoning model for
// anything the tests assert on).
//
// When the next test model becomes available, change ONE line below and the
// whole suite follows. Probe new models with a throwaway spec first to
// confirm reasoning SSE events emit at the expected effort levels.
export const TEST_MODEL = 'gpt-5.4-nano';

// Effort presets for use with TEST_MODEL. Verified on 2026-04-17:
// - 'none' / 'low': no reasoning-family SSE events, no reasoning panel
// - 'medium' / 'high': response.reasoning_summary_* events + panel appears
export const REASONING_OFF = 'none' as const;    // non-reasoning tests
export const REASONING_LIGHT = 'medium' as const; // reasoning-panel tests
export const REASONING_HEAVY = 'high' as const;   // tests that stress thinking tokens

// Deprecated aliases — point at TEST_MODEL to avoid breaking callers mid-migration.
// Remove after all imports are migrated.
/** @deprecated use TEST_MODEL */
export const REASONING_MODEL = TEST_MODEL;
/** @deprecated use TEST_MODEL + REASONING_OFF */
export const NON_REASONING_MODEL = TEST_MODEL;

/** @deprecated use TEST_MODEL */
export function getReasoningModel(): string {
  return TEST_MODEL;
}

/** @deprecated use TEST_MODEL */
export function getNonReasoningModel(): string {
  return TEST_MODEL;
}

/** @deprecated use TEST_MODEL directly */
export function getTestModel(_opts?: { reasoning?: boolean; forceNonReasoning?: boolean }): string {
  return TEST_MODEL;
}
