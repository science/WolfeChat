/**
 * Anthropic Model Configuration
 *
 * This module provides model-specific configuration for Anthropic models,
 * including max tokens, reasoning support, and thinking budget calculation.
 *
 * The key insight: For reasoning models, max_tokens MUST be greater than
 * thinking.budget_tokens to avoid 400 errors from the API.
 */

import { log } from '../lib/logger.js';

// Model configuration interface
interface ModelConfig {
  maxOutputTokens: number;
  supportsReasoning: boolean;
  thinkingBudgetTokens: number; // 25% of max for reasoning models, 0 for others
}

// Model patterns to configuration mapping
// Based on official Anthropic documentation: https://docs.anthropic.com/claude/docs/about-claude/models
// NOTE: Patterns are matched via startsWith in insertion order. More specific patterns
// (e.g. 'claude-opus-4-7') must appear before less specific ones (e.g. 'claude-opus-4').
const MODEL_CONFIGS: Record<string, ModelConfig> = {
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
  family: 'opus' | 'sonnet' | 'haiku';
  major: number;
  minor: number;
}
function parseClaudeVersion(modelName: string): ClaudeVersion | null {
  const m = (modelName || '').toLowerCase();
  // Flipped 3.x: claude-3-7-sonnet[-date]
  let mt = /^claude-(\d+)-(\d+)-(opus|sonnet|haiku)\b/.exec(m);
  if (mt) return { family: mt[3] as ClaudeVersion['family'], major: parseInt(mt[1], 10), minor: parseInt(mt[2], 10) };
  // Dotted: claude-sonnet-3.7 / claude-opus-4.5
  mt = /^claude-(opus|sonnet|haiku)-(\d+)\.(\d+)/.exec(m);
  if (mt) return { family: mt[1] as ClaudeVersion['family'], major: parseInt(mt[2], 10), minor: parseInt(mt[3], 10) };
  // Standard: claude-<family>-<major>[-<minor>][-<date>]
  mt = /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d+))?/.exec(m);
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

  // Find the first matching pattern
  for (const [pattern, config] of Object.entries(MODEL_CONFIGS)) {
    if (!modelName.startsWith(pattern)) continue;
    // The bare 'claude-opus-4' / 'claude-sonnet-4' entries describe ONLY the 4.0 release.
    // Don't let them greedily shadow a higher 4.x minor (e.g. claude-opus-4-5/4-6) — those
    // should fall through to the version-aware forward-default below, not inherit 4.0's
    // 32k/manual config.
    if (pattern === 'claude-opus-4' || pattern === 'claude-sonnet-4') {
      if (!(version && version.major === 4 && version.minor === 0)) continue;
    }
    return config;
  }

  // Unknown but recognizable Claude opus/sonnet (major >= 4): derive config from the version.
  // Adaptive (>= 4.6) ⇒ no manual budget; manual (4.0–4.5) ⇒ a positive budget so extended
  // thinking still works. Either way a new release needs no table entry to behave correctly.
  if (version && (version.family === 'opus' || version.family === 'sonnet') && version.major >= 4) {
    const adaptive = versionSupportsAdaptiveThinking(modelName);
    log.info(`Unknown Claude reasoning model: ${modelName}, using version-derived ${adaptive ? 'adaptive' : 'manual'} config`);
    return {
      maxOutputTokens: 64000,
      supportsReasoning: true,
      thinkingBudgetTokens: adaptive ? 0 : 16000 // manual (<4.6) needs a positive budget
    };
  }

  // Default configuration for genuinely unknown / non-Claude models
  // Conservative defaults: small token limit, no reasoning
  log.warn(`Unknown model: ${modelName}, using default configuration`);
  return {
    maxOutputTokens: 4096,
    supportsReasoning: false,
    thinkingBudgetTokens: 0
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
 * Decided by a VERSION THRESHOLD, not a model list: a reasoning-capable model uses adaptive iff
 * its version is >= 4.6 (the release where adaptive thinking landed) or it is a future major
 * version. Models 4.0–4.5 and 3.x are manual-only and 400 on adaptive. This routes new releases
 * correctly with zero code changes. See versionSupportsAdaptiveThinking for the cutover detail.
 */
export function usesAdaptiveThinking(modelName: string): boolean {
  if (!supportsReasoning(modelName)) return false;     // non-reasoning → no thinking at all
  return versionSupportsAdaptiveThinking(modelName);    // reasoning & >= 4.6 → adaptive
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