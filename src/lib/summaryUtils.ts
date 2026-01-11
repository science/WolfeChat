/**
 * Summary utilities for conversation compression
 *
 * Provides functions for:
 * - Identifying summary messages
 * - Filtering messages for API calls (respecting active summaries)
 * - Counting shadowed messages
 * - Formatting summaries for different providers
 */

import type { ChatMessage } from '../stores/stores.js';

/**
 * Check if a message is a summary message
 */
export function isSummaryMessage(msg: ChatMessage): boolean {
  return msg.type === 'summary';
}

/**
 * Check if a summary is active (defaults to true if not specified)
 */
export function isSummaryActive(msg: ChatMessage): boolean {
  if (!isSummaryMessage(msg)) return false;
  // Default to true if summaryActive is not explicitly set to false
  return msg.summaryActive !== false;
}

/**
 * Build the message array to send to the API, respecting active summaries.
 *
 * Algorithm:
 * 1. Find all active summary indices
 * 2. For each message:
 *    - If it's an active summary, include it
 *    - If it's an inactive summary, skip it
 *    - If it's a regular message, check if any active summary comes after it
 *    - If shadowed by an active summary, skip it
 *    - Otherwise, include it
 */
export function buildMessagesForAPI(history: ChatMessage[]): ChatMessage[] {
  if (history.length === 0) return [];

  // Find indices of all active summaries
  const activeSummaryIndices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (isSummaryMessage(history[i]) && isSummaryActive(history[i])) {
      activeSummaryIndices.push(i);
    }
  }

  const result: ChatMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];

    if (isSummaryMessage(msg)) {
      // Include only active summaries
      if (isSummaryActive(msg)) {
        result.push(msg);
      }
      continue;
    }

    // Check if this message is shadowed by any active summary that comes after it
    const isShadowed = activeSummaryIndices.some(summaryIdx => summaryIdx > i);

    if (!isShadowed) {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Count how many messages would be shadowed by a summary at the given index.
 *
 * A message is shadowed if it comes before the summary and after the previous summary.
 * This helps display "Summarizing N messages" in the UI.
 */
export function countShadowedMessages(history: ChatMessage[], summaryIndex: number): number {
  if (summaryIndex < 0 || summaryIndex >= history.length) return 0;

  // Find the previous summary (if any)
  let previousSummaryIndex = -1;
  for (let i = summaryIndex - 1; i >= 0; i--) {
    if (isSummaryMessage(history[i])) {
      previousSummaryIndex = i;
      break;
    }
  }

  // Count non-summary messages between previous summary (or start) and current summary
  let count = 0;
  const startIndex = previousSummaryIndex + 1;
  for (let i = startIndex; i < summaryIndex; i++) {
    if (!isSummaryMessage(history[i])) {
      count++;
    }
  }

  return count;
}

/**
 * Format a summary message for a specific provider.
 *
 * - OpenAI: Format as a user message with clear summary prefix
 * - Anthropic: Format as a system-level message (will be extracted separately)
 */
export function formatSummaryForProvider(
  msg: ChatMessage,
  provider: 'openai' | 'anthropic'
): ChatMessage {
  const summaryPrefix = '[Previous conversation summary]:\n';
  const formattedContent = summaryPrefix + msg.content;

  if (provider === 'anthropic') {
    // Anthropic handles system messages separately
    return {
      ...msg,
      role: 'user', // Will be handled specially by Anthropic converter
      content: formattedContent
    };
  }

  // OpenAI: use as user message with clear context
  return {
    ...msg,
    role: 'user',
    content: formattedContent
  };
}

/**
 * Get messages that would be summarized if a summary was created at the given index.
 *
 * Collects messages from the previous summary (or start) up to and including
 * the message at targetIndex.
 */
export function getMessagesToSummarize(
  history: ChatMessage[],
  targetIndex: number
): ChatMessage[] {
  if (targetIndex < 0 || targetIndex >= history.length) return [];

  // Find the previous summary (if any)
  let previousSummaryIndex = -1;
  for (let i = targetIndex - 1; i >= 0; i--) {
    if (isSummaryMessage(history[i])) {
      previousSummaryIndex = i;
      break;
    }
  }

  // Collect non-summary messages from after previous summary to targetIndex (inclusive)
  const messages: ChatMessage[] = [];
  const startIndex = previousSummaryIndex + 1;

  for (let i = startIndex; i <= targetIndex; i++) {
    if (!isSummaryMessage(history[i])) {
      messages.push(history[i]);
    }
  }

  return messages;
}

/**
 * Create a summary message object
 */
export function createSummaryMessage(
  content: string,
  active: boolean = true
): ChatMessage {
  return {
    role: 'system',
    content,
    type: 'summary',
    summaryActive: active
  };
}

/**
 * Find all summary indices in a history array
 */
export function findSummaryIndices(history: ChatMessage[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (isSummaryMessage(history[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Find the index where a new summary should be inserted after the target message.
 * Returns targetIndex + 1 (summary goes right after the target message).
 */
export function getSummaryInsertionIndex(targetIndex: number): number {
  return targetIndex + 1;
}
