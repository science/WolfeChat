/**
 * Title Generation Utilities
 *
 * Resolves the effective model and reasoning options for automatic
 * conversation-title generation, driven by the titleGenerationStore.
 *
 * Mirrors the shape of summaryModelUtils.ts so both features feel consistent.
 */

import { get } from 'svelte/store';
import { titleGenerationEnabled, titleGenerationModel } from '../stores/titleGenerationStore.js';
import { selectedModel, conversations } from '../stores/stores.js';
import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore.js';
import { isAnthropicModel } from '../services/anthropicService.js';
import { supportsReasoning, usesMinimalReasoning } from '../services/openaiService.js';

/**
 * Resolve which model the next title-generation call should use.
 *
 * @returns The model ID, or null if title generation is disabled or
 *          cannot be resolved (caller must skip the call).
 */
export function getEffectiveTitleModel(convId: string | number): string | null {
  if (!get(titleGenerationEnabled)) return null;

  const picked = get(titleGenerationModel);
  if (picked) return picked;

  // Fall back to the conversation's model. Matches the per-conversation
  // quick-settings selection the user actually chatted with.
  const perConv = conversationQuickSettings.getSettings(convId as any);
  if (perConv.model) return perConv.model;

  // If no per-conversation model (e.g. title path fires before sendRegularMessage
  // has a chance to read quick settings), fall back to the conversation object's
  // last-known model, then the global selectedModel, then a sane default.
  const convArr = get(conversations);
  const numericIdx = typeof convId === 'number'
    ? convId
    : convArr.findIndex(c => c.id === convId);
  const convModel = numericIdx >= 0 ? (convArr[numericIdx] as any)?.model : undefined;
  return convModel || get(selectedModel) || 'gpt-5.4-nano';
}

export interface TitleReasoningOptions {
  reasoningEffort?: string;
  verbosity?: string;
}

/**
 * Reasoning-off policy for title generation, per model family:
 *   - Anthropic: return empty options; the caller must omit `thinking`.
 *   - OpenAI non-reasoning model: empty options.
 *   - OpenAI modern reasoning model (gpt-5.x, gpt-6+, etc.): effort='none'.
 *   - OpenAI legacy reasoning model (gpt-5-nano, o3, etc.): effort='minimal'.
 *
 * Verbosity is always 'low' for OpenAI reasoning models so titles stay short.
 */
export function getTitleReasoningOptions(model: string): TitleReasoningOptions {
  if (isAnthropicModel(model)) return {};
  if (!supportsReasoning(model)) return {};
  const effort = usesMinimalReasoning(model) ? 'minimal' : 'none';
  return { reasoningEffort: effort, verbosity: 'low' };
}
