/**
 * Summary Display Utilities
 *
 * Functions for formatting and displaying summary information in the UI.
 */

import type { ChatMessage } from '../stores/stores.js';

/**
 * Get the model display string for a summary message.
 * Returns the model name or empty string if no model is set.
 */
export function getSummaryModelDisplay(message: ChatMessage): string {
  return message.model || '';
}

/**
 * Format the summary header text, including model if present.
 * Returns "Summary" or "Summary (model-name)" pattern.
 */
export function formatSummaryHeader(message: ChatMessage): string {
  const model = getSummaryModelDisplay(message);
  if (model) {
    return `Summary (${model})`;
  }
  return 'Summary';
}
