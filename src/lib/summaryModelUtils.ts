/**
 * Summary Model Utilities
 *
 * Functions for determining which AI model to use for summary generation.
 */

import { get } from 'svelte/store';
import { summaryModel } from '../stores/summaryModelStore.js';
import { selectedModel } from '../stores/stores.js';
import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore.js';

/**
 * Get the effective model to use for summary generation.
 *
 * If a specific summary model is configured in Settings, use that.
 * Otherwise, use the conversation's model (quick settings override or global default).
 *
 * @param convId - The conversation's unique ID
 * @returns The model ID to use for summary generation
 */
export function getEffectiveSummaryModel(convId: string): string {
  const configuredSummaryModel = get(summaryModel);

  // If a specific summary model is configured, always use that
  if (configuredSummaryModel) {
    return configuredSummaryModel;
  }

  // Otherwise, use the conversation's model (same logic as chat)
  const perConv = conversationQuickSettings.getSettings(convId);
  return perConv.model || get(selectedModel) || 'gpt-3.5-turbo';
}

/**
 * Check if a global summary model override is configured.
 *
 * @returns true if a specific summary model is set in settings, false otherwise
 */
export function isUsingSummaryModelOverride(): boolean {
  const configuredSummaryModel = get(summaryModel);
  return configuredSummaryModel !== null && configuredSummaryModel !== undefined;
}
