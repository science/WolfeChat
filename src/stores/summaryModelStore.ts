/**
 * Summary Model Store
 *
 * Manages which AI model is used for generating conversation summaries.
 * When set to null, the conversation's model is used (default behavior).
 * When set to a specific model ID, that model is used for all summaries.
 */

import { writable } from 'svelte/store';

// Helper to read from localStorage with JSON parsing
function readLS<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

/**
 * Summary model setting
 * - null = use conversation's model (default behavior)
 * - any model ID string = use that specific model for all summaries
 */
export const summaryModel = writable<string | null>(readLS('summary_model', null));
summaryModel.subscribe(v => localStorage.setItem('summary_model', JSON.stringify(v)));

/**
 * Reasoning effort for summary model (when an OpenAI reasoning model is selected)
 * Options: 'none', 'minimal', 'low', 'medium', 'high'
 */
export const summaryReasoningEffort = writable<string>(readLS('summary_reasoning_effort', 'medium'));
summaryReasoningEffort.subscribe(v => localStorage.setItem('summary_reasoning_effort', JSON.stringify(v)));

/**
 * Verbosity for summary model (when an OpenAI reasoning model is selected)
 * Options: 'low', 'medium', 'high'
 */
export const summaryVerbosity = writable<string>(readLS('summary_verbosity', 'medium'));
summaryVerbosity.subscribe(v => localStorage.setItem('summary_verbosity', JSON.stringify(v)));

/**
 * Summary option for summary model (when an OpenAI reasoning model is selected)
 * Options: 'auto', 'detailed', 'null'
 */
export const summarySummaryOption = writable<string>(readLS('summary_summary_option', 'auto'));
summarySummaryOption.subscribe(v => localStorage.setItem('summary_summary_option', JSON.stringify(v)));

/**
 * Claude Extended Thinking toggle (when a Claude reasoning model is selected)
 */
export const summaryClaudeThinkingEnabled = writable<boolean>(readLS('summary_claude_thinking', false));
summaryClaudeThinkingEnabled.subscribe(v => localStorage.setItem('summary_claude_thinking', JSON.stringify(v)));
