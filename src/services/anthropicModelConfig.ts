/**
 * Anthropic Model Configuration
 *
 * This module provides model-specific configuration for Anthropic models,
 * including max tokens, reasoning support, and thinking budget calculation.
 *
 * The key insight: For reasoning models, max_tokens MUST be greater than
 * thinking.budget_tokens to avoid 400 errors from the API.
 */

// Model configuration interface
interface ModelConfig {
  maxOutputTokens: number;
  supportsReasoning: boolean;
  thinkingBudgetTokens: number; // 25% of max for reasoning models, 0 for others
}

// Model patterns to configuration mapping
// Based on official Anthropic documentation: https://docs.anthropic.com/claude/docs/about-claude/models
const MODEL_CONFIGS: Record<string, ModelConfig> = {
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

  // Find the first matching pattern
  for (const [pattern, config] of Object.entries(MODEL_CONFIGS)) {
    if (modelName.startsWith(pattern)) {
      return config;
    }
  }

  // Default configuration for unknown models
  // Conservative defaults: small token limit, no reasoning
  console.warn(`Unknown model: ${modelName}, using default configuration`);
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