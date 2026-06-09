/**
 * Anthropic Model Configuration
 *
 * This module provides model-specific configuration for Anthropic models,
 * including max tokens, reasoning support, and thinking budget calculation.
 *
 * The key insight: For reasoning models, max_tokens MUST be greater than
 * thinking.budget_tokens to avoid 400 errors from the API.
 */

import { get } from 'svelte/store';
import { log } from '../lib/logger.js';
import { modelsStore } from '../stores/modelStore.js';

// Frontier safety floor — used only when the model store is empty/stale and we cannot
// compute a real frontier from fetched /v1/models metadata. These mirror the current
// frontier Anthropic models (opus 4.8 / fable / mythos: 128k output, 1M input).
const FRONTIER_MAX_OUTPUT_TOKENS = 128000;
const FRONTIER_MAX_INPUT_TOKENS = 1000000;

// Model configuration interface
interface ModelConfig {
  maxOutputTokens: number;
  supportsReasoning: boolean;
  thinkingBudgetTokens: number; // 25% of max for reasoning models, 0 for others
  adaptive: boolean;            // true ⇒ thinking.type='adaptive'; false ⇒ manual budget_tokens
  maxInputTokens?: number;      // captured for future context management; no consumer yet
}

// Table entries omit `adaptive` — it's derived from the version at the return path so the
// table stays a plain limits/reasoning map and adaptive routing has a single source of truth.
type ModelTableEntry = Pick<ModelConfig, 'maxOutputTokens' | 'supportsReasoning' | 'thinkingBudgetTokens'>;

// Model patterns to configuration mapping
// Based on official Anthropic documentation: https://docs.anthropic.com/claude/docs/about-claude/models
// NOTE: Patterns are matched via startsWith in insertion order. More specific patterns
// (e.g. 'claude-opus-4-7') must appear before less specific ones (e.g. 'claude-opus-4').
const MODEL_CONFIGS: Record<string, ModelTableEntry> = {
  // Fable / Mythos class - Mythos-class premium models (claude-fable-5, claude-mythos-5, and
  // future versions in the class). 128000 max tokens, adaptive-only thinking (the API rejects
  // manual budget_tokens for these). Keyed by FAMILY PREFIX (not a pinned version) so the whole
  // class - including future fable-6 / mythos-6 - inherits this with zero table edits, exactly
  // like opus 4.6+ derives its config from the version. Adaptive vs manual is still decided by
  // parseClaudeVersion (major >= 5 here, so always adaptive).
  'claude-fable': {
    maxOutputTokens: 128000,
    supportsReasoning: true,
    thinkingBudgetTokens: 0 // unused under adaptive thinking
  },
  'claude-mythos': {
    maxOutputTokens: 128000,
    supportsReasoning: true,
    thinkingBudgetTokens: 0 // unused under adaptive thinking
  },

  // Opus 4.8 family - 128000 max tokens. Adaptive thinking is derived (default for modern
  // models); these entries exist only to pin the 128k output ceiling.
  'claude-opus-4-8': {
    maxOutputTokens: 128000,
    supportsReasoning: true,
    thinkingBudgetTokens: 0 // unused under adaptive thinking
  },

  // Opus 4.7 family - 128000 max tokens (adaptive thinking derived; see note above)
  'claude-opus-4-7': {
    maxOutputTokens: 128000,
    supportsReasoning: true,
    thinkingBudgetTokens: 0 // unused under adaptive thinking
  },

  // Opus 4.1 family - 32000 max tokens, supports reasoning
  'claude-opus-4-1': {
    maxOutputTokens: 32000,
    supportsReasoning: true,
    thinkingBudgetTokens: 8000  // 25% of 32000
  },

  // Opus 4 family - 32000 max tokens, supports reasoning
  'claude-opus-4': {
    maxOutputTokens: 32000,
    supportsReasoning: true,
    thinkingBudgetTokens: 8000  // 25% of 32000
  },

  // Sonnet 4.5 family - 64000 max tokens, supports reasoning
  'claude-sonnet-4-5': {
    maxOutputTokens: 64000,
    supportsReasoning: true,
    thinkingBudgetTokens: 16000  // 25% of 64000
  },

  // Sonnet 4 family - 64000 max tokens, supports reasoning
  'claude-sonnet-4': {
    maxOutputTokens: 64000,
    supportsReasoning: true,
    thinkingBudgetTokens: 16000  // 25% of 64000
  },

  // Sonnet 3.7 family - 64000 max tokens, supports reasoning
  'claude-3-7-sonnet': {
    maxOutputTokens: 64000,
    supportsReasoning: true,
    thinkingBudgetTokens: 16000  // 25% of 64000
  },

  // Alternative Sonnet 3.7 naming pattern
  'claude-sonnet-3.7': {
    maxOutputTokens: 64000,
    supportsReasoning: true,
    thinkingBudgetTokens: 16000  // 25% of 64000
  },

  // Haiku 3.5 family - 8192 max tokens, NO reasoning
  'claude-3-5-haiku': {
    maxOutputTokens: 8192,
    supportsReasoning: false,
    thinkingBudgetTokens: 0
  },

  // Haiku 3 family - 4096 max tokens, NO reasoning
  'claude-3-haiku': {
    maxOutputTokens: 4096,
    supportsReasoning: false,
    thinkingBudgetTokens: 0
  }
};

/**
 * Parse a Claude model id into its {family, major, minor} version.
 *
 * Handles the several id shapes Anthropic uses:
 *   - claude-opus-4-8            → opus 4.8
 *   - claude-opus-4-5-20251101   → opus 4.5  (release date trails the minor)
 *   - claude-opus-4-20250514     → opus 4.0  (date sits in the minor slot ⇒ minor 0)
 *   - claude-3-7-sonnet-20250219 → sonnet 3.7 (flipped 3.x ordering)
 *   - claude-sonnet-3.7          → sonnet 3.7 (dotted)
 * Returns null for non-Claude / unrecognizable ids.
 */
interface ClaudeVersion {
  family: 'opus' | 'sonnet' | 'haiku' | 'fable' | 'mythos';
  major: number;
  minor: number;
}
function parseClaudeVersion(modelName: string): ClaudeVersion | null {
  const m = (modelName || '').toLowerCase();
  // Flipped 3.x: claude-3-7-sonnet[-date]
  let mt = /^claude-(\d+)-(\d+)-(opus|sonnet|haiku|fable|mythos)\b/.exec(m);
  if (mt) return { family: mt[3] as ClaudeVersion['family'], major: parseInt(mt[1], 10), minor: parseInt(mt[2], 10) };
  // Dotted: claude-sonnet-3.7 / claude-opus-4.5
  mt = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)\.(\d+)/.exec(m);
  if (mt) return { family: mt[1] as ClaudeVersion['family'], major: parseInt(mt[2], 10), minor: parseInt(mt[3], 10) };
  // Standard: claude-<family>-<major>[-<minor>][-<date>]
  mt = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/.exec(m);
  if (mt) {
    const next = mt[3];
    // A 6+ digit group right after the major is a release date, not a minor version.
    const minor = next && next.length < 6 ? parseInt(next, 10) : 0;
    return { family: mt[1] as ClaudeVersion['family'], major: parseInt(mt[2], 10), minor };
  }
  return null;
}

/**
 * Whether a model's VERSION is new enough to use adaptive thinking.
 *
 * Adaptive thinking (thinking.type='adaptive') was introduced in Claude 4.6 and is forward-
 * compatible: 4.6+ — and every future major version — accept it, while 4.0–4.5 and 3.x are
 * manual-only ({type:'enabled', budget_tokens}) and REJECT adaptive with HTTP 400
 * ("adaptive thinking is not supported on this model"). The cutover is identical for opus and
 * sonnet. Verified live across the model spectrum in
 * tests-e2e/live-regression/anthropic-thinking-payload-contract.spec.ts.
 *
 * This version threshold — NOT a per-model denylist — is the entire adaptive-vs-manual decision,
 * so a new model release routes correctly with zero code changes (opus/sonnet >= 4.6 or any
 * future major version → adaptive; anything older → manual). A denylist could not do this: it
 * mis-routed the pre-adaptive Opus 4.5, which is exactly the regression that motivated this.
 */
const ADAPTIVE_THINKING_MIN_MAJOR = 4;
const ADAPTIVE_THINKING_MIN_MINOR = 6;
function versionSupportsAdaptiveThinking(modelName: string): boolean {
  const v = parseClaudeVersion(modelName);
  if (!v) return false;
  if (v.major > ADAPTIVE_THINKING_MIN_MAJOR) return true;
  return v.major === ADAPTIVE_THINKING_MIN_MAJOR && v.minor >= ADAPTIVE_THINKING_MIN_MINOR;
}

/**
 * Get model configuration based on model name
 *
 * @param modelName - Full model name (e.g., 'claude-opus-4-1-20250805')
 * @returns Model configuration or default if not found
 */
export function getModelConfig(modelName: string): ModelConfig {
  // Extract base model name by removing date suffix
  // Examples:
  // 'claude-opus-4-1-20250805' -> 'claude-opus-4-1'
  // 'claude-3-haiku-20240307' -> 'claude-3-haiku'

  const version = parseClaudeVersion(modelName);

  // 1. Explicit table match (most specific, deliberately pinned behavior). Wins over store
  //    metadata so the table can encode decisions the API can't convey (e.g. opus 4.0–4.5 manual).
  for (const [pattern, config] of Object.entries(MODEL_CONFIGS)) {
    if (!modelName.startsWith(pattern)) continue;
    // The bare 'claude-opus-4' / 'claude-sonnet-4' entries describe ONLY the 4.0 release.
    // Don't let them greedily shadow a higher 4.x minor (e.g. claude-opus-4-5/4-6) — those
    // should fall through to the version-aware forward-default below, not inherit 4.0's
    // 32k/manual config.
    if (pattern === 'claude-opus-4' || pattern === 'claude-sonnet-4') {
      if (!(version && version.major === 4 && version.minor === 0)) continue;
    }
    return { ...config, adaptive: versionSupportsAdaptiveThinking(modelName) };
  }

  // 2. Real metadata from the fetched /v1/models list (accurate for anything the API returned).
  //    Beats the version guess below for newly-released models the user just refreshed.
  const meta = lookupStoredAnthropicModel(modelName);
  if (meta && typeof meta.maxOutputTokens === 'number' && meta.reasoningSupported !== undefined) {
    const reasoning = !!meta.reasoningSupported;
    const adaptive = reasoning && !!meta.adaptiveSupported;
    return {
      maxOutputTokens: meta.maxOutputTokens,
      supportsReasoning: reasoning,
      // Manual-mode reasoning models need a positive budget; adaptive/non-reasoning use 0.
      thinkingBudgetTokens: reasoning && !adaptive ? Math.floor(meta.maxOutputTokens * 0.25) : 0,
      adaptive,
      maxInputTokens: typeof meta.maxInputTokens === 'number' ? meta.maxInputTokens : undefined
    };
  }

  // 3. Unknown but recognizable Claude opus/sonnet (major >= 4): derive config from the version.
  // Adaptive (>= 4.6) ⇒ no manual budget; manual (4.0–4.5) ⇒ a positive budget so extended
  // thinking still works. Either way a new release needs no table entry to behave correctly.
  if (version && (version.family === 'opus' || version.family === 'sonnet') && version.major >= 4) {
    const adaptive = versionSupportsAdaptiveThinking(modelName);
    log.info(`Unknown Claude reasoning model: ${modelName}, using version-derived ${adaptive ? 'adaptive' : 'manual'} config`);
    return {
      maxOutputTokens: 64000,
      supportsReasoning: true,
      thinkingBudgetTokens: adaptive ? 0 : 16000, // manual (<4.6) needs a positive budget
      adaptive
    };
  }

  // 4. Any other MODERN Claude id we don't recognize: assume it's a frontier model rather than
  //    crippling it. Use the provider's frontier limits with reasoning + adaptive thinking ON, so a
  //    brand-new model works well until it's explicitly added. (This is the former "Unknown
  //    model … 4096" floor that made new models look broken.)
  //    EXCLUDE legacy generations (Claude 1/2/3, e.g. claude-3-sonnet, claude-3.5-sonnet,
  //    claude-instant): they are old and mostly non-reasoning; if not pinned in the table above,
  //    they fall through to the conservative default — never frontier-optimism.
  const isLegacyGeneration = /^claude-[0-3]([-.]|$)/.test(modelName) || modelName.startsWith('claude-instant');
  if (modelName.startsWith('claude-') && !isLegacyGeneration) {
    const frontier = getAnthropicFrontierConfig();
    log.info(`Model ${modelName} not in fetched list; using Anthropic frontier defaults (maxOutputTokens=${frontier.maxOutputTokens}, adaptive thinking on)`);
    return frontier;
  }

  // 5. Genuinely unknown / non-Claude / legacy model: conservative defaults (small limit, no reasoning).
  log.info(`Unknown or legacy model: ${modelName}, using conservative defaults`);
  return {
    maxOutputTokens: 4096,
    supportsReasoning: false,
    thinkingBudgetTokens: 0,
    adaptive: false
  };
}

/**
 * Look up a model's captured /v1/models metadata in the model store.
 *
 * Matches by exact id first, then the longest prefix in either direction so a date-suffixed id
 * (`claude-fable-5-20260101`) resolves against a stored base id (`claude-fable-5`) and vice-versa.
 * Returns undefined when the store is unavailable or has no Anthropic entry for this model.
 */
function lookupStoredAnthropicModel(modelName: string): any | undefined {
  try {
    const anthro = (get(modelsStore) || []).filter((m: any) => m && m.provider === 'anthropic' && typeof m.id === 'string');
    let best: any | undefined;
    for (const m of anthro) {
      const id: string = m.id;
      const matches = id === modelName || modelName.startsWith(id) || id.startsWith(modelName);
      if (matches && (!best || id.length > best.id.length)) best = m;
    }
    return best;
  } catch {
    return undefined;
  }
}

/**
 * The provider's frontier config — the max limits across the Anthropic models currently in the
 * store ("the frontier model from that provider"), falling back to the FRONTIER_* safety constants
 * when the store is empty or pre-dates metadata capture. Reasoning + adaptive thinking ON.
 */
function getAnthropicFrontierConfig(): ModelConfig {
  let maxOutputTokens = FRONTIER_MAX_OUTPUT_TOKENS;
  let maxInputTokens = FRONTIER_MAX_INPUT_TOKENS;
  try {
    const anthro = (get(modelsStore) || []).filter((m: any) => m && m.provider === 'anthropic');
    const outs = anthro.map((m: any) => m.maxOutputTokens).filter((n: any) => typeof n === 'number');
    const ins = anthro.map((m: any) => m.maxInputTokens).filter((n: any) => typeof n === 'number');
    if (outs.length) maxOutputTokens = Math.max(maxOutputTokens, ...outs);
    if (ins.length) maxInputTokens = Math.max(maxInputTokens, ...ins);
  } catch {
    // fall back to constants
  }
  return {
    maxOutputTokens,
    supportsReasoning: true,
    thinkingBudgetTokens: 0, // adaptive ignores budget
    adaptive: true,
    maxInputTokens
  };
}

/**
 * Check if a model supports reasoning/thinking
 *
 * @param modelName - Full model name
 * @returns true if model supports reasoning
 */
export function supportsReasoning(modelName: string): boolean {
  const config = getModelConfig(modelName);
  return config.supportsReasoning;
}

/**
 * Get thinking budget for a model
 *
 * @param modelName - Full model name
 * @returns Thinking budget in tokens (0 for non-reasoning models)
 */
export function getThinkingBudget(modelName: string): number {
  const config = getModelConfig(modelName);
  return config.thinkingBudgetTokens;
}

/**
 * Get max output tokens for a model
 *
 * @param modelName - Full model name
 * @returns Maximum output tokens
 */
export function getMaxOutputTokens(modelName: string): number {
  const config = getModelConfig(modelName);
  return config.maxOutputTokens;
}

/**
 * Whether a model uses adaptive thinking (thinking.type='adaptive') instead of the legacy
 * manual mode (thinking.type='enabled' + budget_tokens).
 *
 * Reads the threaded `adaptive` decision from getModelConfig rather than re-parsing the version,
 * so EVERY resolution path agrees: table/version entries derive adaptive from the version
 * threshold (>= 4.6 or any future major), store entries use the API's reported capability, and
 * frontier/unknown Claude models default to adaptive. This is what lets a novel family (whose id
 * can't be version-parsed) still emit thinking.type='adaptive' instead of a manual budget the API
 * would reject with a 400.
 */
export function usesAdaptiveThinking(modelName: string): boolean {
  const config = getModelConfig(modelName);
  return config.supportsReasoning && config.adaptive;
}

/**
 * Validate that a model's configuration satisfies the API constraint
 * This is the key check that prevents 400 errors
 *
 * @param modelName - Full model name
 * @returns true if max_tokens > thinking_budget (or thinking_budget is 0)
 */
export function validateTokenConstraint(modelName: string): boolean {
  const maxTokens = getMaxOutputTokens(modelName);
  const thinkingBudget = getThinkingBudget(modelName);

  // For non-reasoning models, constraint is automatically satisfied
  if (thinkingBudget === 0) {
    return true;
  }

  // For reasoning models, max_tokens MUST be greater than thinking_budget
  return maxTokens > thinkingBudget;
}

/**
 * Get all reasoning model patterns for validation
 * Useful for testing and debugging
 */
export function getReasoningModelPatterns(): string[] {
  return Object.entries(MODEL_CONFIGS)
    .filter(([_, config]) => config.supportsReasoning)
    .map(([pattern, _]) => pattern);
}