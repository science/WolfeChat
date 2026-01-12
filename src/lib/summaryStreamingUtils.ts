/**
 * Summary Streaming Utilities
 *
 * Provides payload building functions that REUSE the existing streaming
 * infrastructure from openaiService and anthropicService.
 *
 * This ensures summary streaming uses the same API formats and parameters
 * as main chat streaming, avoiding issues like max_tokens vs max_completion_tokens
 * with reasoning models.
 */

import {
  buildResponsesPayload,
  buildResponsesInputFromMessages
} from '../services/openaiService.js';
import { getMaxOutputTokens } from '../services/anthropicModelConfig.js';
import { addThinkingConfigurationWithBudget } from '../services/anthropicReasoning.js';
import type { ChatMessage } from '../stores/stores.js';

/**
 * Options for building summary payloads
 */
export interface SummaryPayloadOptions {
  reasoningEffort?: string;
  verbosity?: string;
  summaryOption?: string;
  thinkingEnabled?: boolean;
}

/**
 * Build OpenAI summary payload using the existing Responses API infrastructure.
 *
 * This function delegates to buildResponsesPayload() which correctly handles:
 * - Reasoning models (max_completion_tokens, reasoning effort, etc.)
 * - Non-reasoning models
 * - Proper API format for both
 *
 * @param model - Model to use
 * @param messages - Messages to include (will be converted to Responses API format)
 * @param options - Optional reasoning settings
 * @returns Payload ready for the Responses API
 */
export function buildSummaryPayload(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: SummaryPayloadOptions
): any {
  // Convert messages to Responses API input format
  const input = buildResponsesInputFromMessages(messages as any);

  // Use the existing payload builder which handles reasoning models correctly
  return buildResponsesPayload(model, input, true, {
    reasoningEffort: options.reasoningEffort,
    verbosity: options.verbosity,
    summary: options.summaryOption
  });
}

/**
 * Build Anthropic summary parameters using the existing SDK infrastructure.
 *
 * This function uses:
 * - getMaxOutputTokens() for dynamic, model-specific token limits
 * - addThinkingConfigurationWithBudget() for thinking-capable models
 *
 * @param model - Model to use
 * @param messages - Messages to include
 * @param options - Optional thinking settings
 * @returns Parameters ready for the Anthropic SDK
 */
export function buildAnthropicSummaryParams(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: SummaryPayloadOptions
): any {
  // Get model-specific max tokens (not hardcoded 500!)
  const maxTokens = getMaxOutputTokens(model);

  // Build base parameters
  const baseParams: any = {
    model,
    max_tokens: maxTokens,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })),
    system: 'You are a helpful assistant that creates concise, accurate summaries of conversations.'
  };

  // Add thinking configuration if enabled and model supports it
  if (options.thinkingEnabled) {
    return addThinkingConfigurationWithBudget(baseParams, {
      thinkingEnabled: true
    });
  }

  return baseParams;
}

/**
 * Convert ChatMessage array to simple message format for summary prompts
 */
export function convertToSummaryMessages(
  summaryPrompt: string
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: 'You are a helpful assistant that creates concise, accurate summaries of conversations.'
    },
    {
      role: 'user',
      content: summaryPrompt
    }
  ];
}

/**
 * Convert ChatMessage array to Anthropic message format (no system role in messages)
 */
export function convertToAnthropicSummaryMessages(
  summaryPrompt: string
): Array<{ role: string; content: string }> {
  // Anthropic doesn't allow system role in messages array
  return [
    {
      role: 'user',
      content: summaryPrompt
    }
  ];
}
