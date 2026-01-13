/**
 * Summary Manager
 *
 * Handles creation, insertion, and management of conversation summaries.
 */

import { get } from 'svelte/store';
import { conversations, chosenConversationId, type ChatMessage, isStreaming, userRequestedStreamClosure } from '../stores/stores.js';
import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore.js';
import { selectedModel } from '../stores/stores.js';
import { openaiApiKey, anthropicApiKey } from '../stores/providerStore.js';
import { sendRequest } from '../services/openaiService.js';
import { createAnthropicClient } from '../services/anthropicClientFactory.js';
import { isAnthropicModel } from '../services/anthropicService.js';
import { createSummaryMessage, getMessagesToSummarize, isSummaryMessage } from '../lib/summaryUtils.js';
import { getEffectiveSummaryModel } from '../lib/summaryModelUtils.js';
import { log } from '../lib/logger.js';
import {
  buildSummaryPayload,
  convertToSummaryMessages,
  buildAnthropicSummaryParams,
  convertToAnthropicSummaryMessages
} from '../lib/summaryStreamingUtils.js';
import {
  summaryReasoningEffort,
  summaryVerbosity,
  summarySummaryOption,
  summaryClaudeThinkingEnabled
} from '../stores/summaryModelStore.js';

// ============================================================================
// Streaming Summary Helpers
// ============================================================================

/**
 * Create a placeholder summary message with loading state
 */
export function createPlaceholderSummary(): ChatMessage {
  return {
    role: 'system',
    content: '',
    type: 'summary',
    summaryActive: true,
    summaryLoading: true
  };
}

/**
 * Create a placeholder summary message with loading state and model info
 */
export function createPlaceholderSummaryWithModel(model: string): ChatMessage {
  return {
    role: 'system',
    content: '',
    type: 'summary',
    summaryActive: true,
    summaryLoading: true,
    model
  };
}

/**
 * Insert a placeholder summary into history at the correct position
 */
export function insertPlaceholderSummary(
  history: ChatMessage[],
  afterMessageIndex: number
): ChatMessage[] {
  const insertIndex = afterMessageIndex + 1;
  const placeholder = createPlaceholderSummary();

  return [
    ...history.slice(0, insertIndex),
    placeholder,
    ...history.slice(insertIndex)
  ];
}

/**
 * Insert a placeholder summary with model info into history at the correct position
 */
export function insertPlaceholderSummaryWithModel(
  history: ChatMessage[],
  afterMessageIndex: number,
  model: string
): ChatMessage[] {
  const insertIndex = afterMessageIndex + 1;
  const placeholder = createPlaceholderSummaryWithModel(model);

  return [
    ...history.slice(0, insertIndex),
    placeholder,
    ...history.slice(insertIndex)
  ];
}

/**
 * Update the content of a streaming summary while maintaining loading state
 */
export function updateStreamingSummaryContent(
  history: ChatMessage[],
  summaryIndex: number,
  newContent: string
): ChatMessage[] {
  return history.map((msg, idx) =>
    idx === summaryIndex
      ? { ...msg, content: newContent }
      : msg
  );
}

/**
 * Mark a summary as no longer loading (complete or aborted)
 */
export function completeSummaryLoading(
  history: ChatMessage[],
  summaryIndex: number
): ChatMessage[] {
  return history.map((msg, idx) =>
    idx === summaryIndex
      ? { ...msg, summaryLoading: false }
      : msg
  );
}

/**
 * Check if a message is a summary currently in loading state
 */
export function isSummaryLoading(msg: ChatMessage): boolean {
  return isSummaryMessage(msg) && msg.summaryLoading === true;
}

/**
 * Find the index of a loading summary in history (-1 if none)
 */
export function findLoadingSummaryIndex(history: ChatMessage[]): number {
  return history.findIndex(msg => isSummaryLoading(msg));
}

// ============================================================================
// Summary Prompt and Generation
// ============================================================================

/**
 * Format a summarization prompt from messages
 *
 * Uses dynamic word target based on conversation length:
 * - Calculates 10% of estimated word count (chars / 5)
 * - Clamps between 50 (min) and 2000 (max) words
 */
export function formatSummaryPrompt(messages: ChatMessage[]): string {
  const conversationText = messages.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${msg.content}`;
  }).join('\n\n');

  // Calculate dynamic word target based on conversation length
  const wordTarget = calculateSummaryWordTarget(messages);

  return `Summarize the following conversation concisely. Focus on:
1. Key topics discussed
2. Important decisions or conclusions
3. Any action items or next steps mentioned

Keep the summary under ${wordTarget} words. Write in third person.

Conversation:
${conversationText}`;
}

/**
 * Insert a summary message into the history at the correct position
 */
export function insertSummaryIntoHistory(
  history: ChatMessage[],
  afterMessageIndex: number,
  summaryContent: string
): ChatMessage[] {
  const insertIndex = afterMessageIndex + 1;
  const summaryMessage = createSummaryMessage(summaryContent, true);

  const newHistory = [
    ...history.slice(0, insertIndex),
    summaryMessage,
    ...history.slice(insertIndex)
  ];

  return newHistory;
}

/**
 * Generate a summary using the AI
 */
export async function generateSummary(
  messages: ChatMessage[],
  model?: string
): Promise<string> {
  const openaiKey = get(openaiApiKey);
  const anthropicKey = get(anthropicApiKey);

  const summaryPrompt = formatSummaryPrompt(messages);

  try {
    if (isAnthropicModel(model || '') && anthropicKey) {
      // Use Anthropic for summary generation
      const client = createAnthropicClient(anthropicKey);
      const response = await client.messages.create({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          { role: 'user', content: summaryPrompt }
        ],
        system: 'You are a helpful assistant that creates concise, accurate summaries of conversations.'
      });

      const summaryText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('')
        .trim();

      if (!summaryText) throw new Error('Empty summary from Anthropic');
      return summaryText;

    } else if (openaiKey) {
      // Use OpenAI for summary generation (default)
      const summaryModel = model || 'gpt-3.5-turbo';
      const msgs: any[] = [
        { role: 'system', content: 'You are a helpful assistant that creates concise, accurate summaries of conversations.' },
        { role: 'user', content: summaryPrompt }
      ];

      const response = await sendRequest(msgs as any, summaryModel);
      const svc = await import('../services/openaiService.js');
      const summaryText = svc.extractOutputTextFromResponses(response);

      if (!summaryText?.trim()) throw new Error('Empty summary from OpenAI');
      return summaryText.trim();

    } else if (anthropicKey) {
      // Fall back to Anthropic if OpenAI not available
      const client = createAnthropicClient(anthropicKey);
      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          { role: 'user', content: summaryPrompt }
        ],
        system: 'You are a helpful assistant that creates concise, accurate summaries of conversations.'
      });

      const summaryText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('')
        .trim();

      if (!summaryText) throw new Error('Empty summary from Anthropic');
      return summaryText;

    } else {
      throw new Error('No API keys available for summary generation');
    }
  } catch (error) {
    log.error('Summary generation failed:', error);
    throw error;
  }
}

/**
 * Create a summary at the specified message index in a conversation.
 *
 * @param convId - The conversation's unique string ID
 * @param atMessageIndex - The message index to summarize up to (inclusive)
 * @returns The generated summary text
 */
export async function createSummary(
  convId: string,
  atMessageIndex: number
): Promise<string> {
  const allConversations = get(conversations);
  const conversationIndex = allConversations.findIndex(c => c.id === convId);

  if (conversationIndex === -1) {
    throw new Error(`Conversation with ID ${convId} not found`);
  }

  const conversation = allConversations[conversationIndex];
  const history = conversation.history;

  if (atMessageIndex < 0 || atMessageIndex >= history.length) {
    throw new Error(`Invalid message index: ${atMessageIndex}`);
  }

  // Get the messages to summarize
  const messagesToSummarize = getMessagesToSummarize(history, atMessageIndex);

  if (messagesToSummarize.length === 0) {
    throw new Error('No messages to summarize');
  }

  // Get the model for this conversation
  const perConv = conversationQuickSettings.getSettings(convId);
  const model = perConv.model || get(selectedModel) || 'gpt-3.5-turbo';

  // Generate the summary
  const summaryText = await generateSummary(messagesToSummarize, model);

  // Insert the summary into the conversation history
  const newHistory = insertSummaryIntoHistory(history, atMessageIndex, summaryText);

  // Update the conversation store
  conversations.update(convs => {
    const updated = [...convs];
    updated[conversationIndex] = {
      ...updated[conversationIndex],
      history: newHistory
    };
    return updated;
  });

  log.debug(`Summary created at index ${atMessageIndex} for conversation ${convId}`);
  return summaryText;
}

/**
 * Toggle the active state of a summary
 */
export function toggleSummaryActive(convId: string, messageIndex: number): boolean {
  const allConversations = get(conversations);
  const conversationIndex = allConversations.findIndex(c => c.id === convId);

  if (conversationIndex === -1) {
    throw new Error(`Conversation with ID ${convId} not found`);
  }

  const conversation = allConversations[conversationIndex];
  const message = conversation.history[messageIndex];

  if (!isSummaryMessage(message)) {
    throw new Error('Message at index is not a summary');
  }

  // Toggle the active state
  const newActiveState = message.summaryActive === false ? true : false;

  conversations.update(convs => {
    const updated = [...convs];
    updated[conversationIndex] = {
      ...updated[conversationIndex],
      history: updated[conversationIndex].history.map((msg, idx) =>
        idx === messageIndex ? { ...msg, summaryActive: newActiveState } : msg
      )
    };
    return updated;
  });

  return newActiveState;
}

/**
 * Update the content of a summary
 */
export function updateSummaryContent(
  convId: string,
  messageIndex: number,
  newContent: string
): void {
  const allConversations = get(conversations);
  const conversationIndex = allConversations.findIndex(c => c.id === convId);

  if (conversationIndex === -1) {
    throw new Error(`Conversation with ID ${convId} not found`);
  }

  const conversation = allConversations[conversationIndex];
  const message = conversation.history[messageIndex];

  if (!isSummaryMessage(message)) {
    throw new Error('Message at index is not a summary');
  }

  conversations.update(convs => {
    const updated = [...convs];
    updated[conversationIndex] = {
      ...updated[conversationIndex],
      history: updated[conversationIndex].history.map((msg, idx) =>
        idx === messageIndex ? { ...msg, content: newContent } : msg
      )
    };
    return updated;
  });
}

// ============================================================================
// Streaming Summary Generation
// ============================================================================

// Global abort controller for summary streaming
let summaryAbortController: AbortController | null = null;

/**
 * Abort an in-progress summary stream
 */
export function abortSummaryStream(): void {
  if (summaryAbortController) {
    summaryAbortController.abort();
    summaryAbortController = null;
  }
}

/**
 * Create a summary with streaming - shows placeholder immediately and streams content
 *
 * @param convId - The conversation's unique string ID
 * @param atMessageIndex - The message index to summarize up to (inclusive)
 * @returns Promise that resolves when streaming is complete
 */
export async function createStreamingSummary(
  convId: string,
  atMessageIndex: number
): Promise<string> {
  const allConversations = get(conversations);
  const conversationIndex = allConversations.findIndex(c => c.id === convId);

  if (conversationIndex === -1) {
    throw new Error(`Conversation with ID ${convId} not found`);
  }

  const conversation = allConversations[conversationIndex];
  const history = conversation.history;

  if (atMessageIndex < 0 || atMessageIndex >= history.length) {
    throw new Error(`Invalid message index: ${atMessageIndex}`);
  }

  // Get the messages to summarize
  const messagesToSummarize = getMessagesToSummarize(history, atMessageIndex);

  if (messagesToSummarize.length === 0) {
    throw new Error('No messages to summarize');
  }

  // Get the model to use for summary generation
  const model = getEffectiveSummaryModel(convId);

  // Step 1: Insert placeholder summary immediately (with model info)
  const newHistory = insertPlaceholderSummaryWithModel(history, atMessageIndex, model);
  const summaryIndex = atMessageIndex + 1;

  // Update the conversation store with placeholder
  conversations.update(convs => {
    const updated = [...convs];
    updated[conversationIndex] = {
      ...updated[conversationIndex],
      history: newHistory
    };
    return updated;
  });

  // Step 2: Set streaming state
  isStreaming.set(true);
  userRequestedStreamClosure.set(false);

  const summaryPrompt = formatSummaryPrompt(messagesToSummarize);
  let accumulatedText = '';

  try {
    if (isAnthropicModel(model)) {
      accumulatedText = await streamAnthropicSummary(convId, conversationIndex, summaryIndex, summaryPrompt, model);
    } else {
      accumulatedText = await streamOpenAISummary(convId, conversationIndex, summaryIndex, summaryPrompt, model);
    }

    // Step 3: Complete loading state
    conversations.update(convs => {
      const updated = [...convs];
      const currentHistory = updated[conversationIndex].history;
      updated[conversationIndex] = {
        ...updated[conversationIndex],
        history: completeSummaryLoading(currentHistory, summaryIndex)
      };
      return updated;
    });

    log.debug(`Streaming summary created at index ${atMessageIndex} for conversation ${convId}`);
    return accumulatedText;

  } catch (error) {
    // On error, still complete loading state but preserve partial content
    conversations.update(convs => {
      const updated = [...convs];
      const currentHistory = updated[conversationIndex].history;
      updated[conversationIndex] = {
        ...updated[conversationIndex],
        history: completeSummaryLoading(currentHistory, summaryIndex)
      };
      return updated;
    });

    // Only rethrow if not an abort
    if (error instanceof Error && error.name === 'AbortError') {
      log.debug('Summary stream aborted by user');
      return accumulatedText;
    }

    log.error('Streaming summary generation failed:', error);
    throw error;
  } finally {
    isStreaming.set(false);
    summaryAbortController = null;
  }
}

/**
 * Stream summary via OpenAI Responses API
 *
 * Uses the same Responses API infrastructure as main chat streaming,
 * ensuring consistent handling of reasoning models.
 */
async function streamOpenAISummary(
  convId: string,
  conversationIndex: number,
  summaryIndex: number,
  prompt: string,
  model: string
): Promise<string> {
  const openaiKey = get(openaiApiKey);
  if (!openaiKey) throw new Error('No OpenAI API key configured');

  summaryAbortController = new AbortController();

  // Build messages for summary request
  const messages = convertToSummaryMessages(prompt);

  // Get reasoning options from stores
  const reasoningEffort = get(summaryReasoningEffort);
  const verbosity = get(summaryVerbosity);
  const summaryOption = get(summarySummaryOption);

  // Build payload using the same infrastructure as main chat
  // This handles reasoning models correctly (max_completion_tokens, etc.)
  const payload = buildSummaryPayload(model, messages, {
    reasoningEffort,
    verbosity,
    summaryOption
  });

  // Use Responses API endpoint (same as main chat)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...payload,
      stream: true
    }),
    signal: summaryAbortController.signal
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${text || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

  try {
    while (true) {
      // Check for user-requested closure
      if (get(userRequestedStreamClosure)) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE blocks (separated by double newlines)
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        // Parse SSE format: event: ... and data: ...
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        let eventType = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trim());
          }
        }

        if (dataLines.length === 0) continue;

        const dataStr = dataLines.join('');
        if (dataStr === '[DONE]') continue;

        try {
          const obj = JSON.parse(dataStr);
          // Resolve event type: prefer explicit SSE event, fall back to payload.type
          const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');

          // Handle text deltas (Responses API format)
          if (resolvedType === 'response.output_text.delta') {
            const deltaText = obj?.delta?.text ?? obj?.delta ?? '';
            if (deltaText) {
              accumulatedText += deltaText;

              // Update summary content progressively
              conversations.update(convs => {
                const updated = [...convs];
                const currentHistory = updated[conversationIndex].history;
                updated[conversationIndex] = {
                  ...updated[conversationIndex],
                  history: updateStreamingSummaryContent(currentHistory, summaryIndex, accumulatedText)
                };
                return updated;
              });
            }
          }
          // Note: We don't need to handle response.completed for summaries
          // as we just accumulate text and return it when stream ends
        } catch {
          // Ignore parse errors for individual chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulatedText;
}

/**
 * Stream summary via Anthropic SDK
 *
 * Uses the same SDK infrastructure as main chat streaming,
 * ensuring consistent handling of thinking-capable models.
 */
async function streamAnthropicSummary(
  convId: string,
  conversationIndex: number,
  summaryIndex: number,
  prompt: string,
  model: string
): Promise<string> {
  const anthropicKey = get(anthropicApiKey);
  if (!anthropicKey) throw new Error('No Anthropic API key configured');

  summaryAbortController = new AbortController();

  // Create Anthropic client (same as main chat)
  const client = createAnthropicClient(anthropicKey);

  // Build messages for summary request
  const messages = convertToAnthropicSummaryMessages(prompt);

  // Get thinking option from stores
  const thinkingEnabled = get(summaryClaudeThinkingEnabled);

  // Build params using the same infrastructure as main chat
  // This handles thinking-capable models correctly
  const params = buildAnthropicSummaryParams(model, messages, {
    thinkingEnabled
  });

  let accumulatedText = '';

  try {
    // Use SDK streaming (same as main chat)
    const stream = client.messages.stream(params, {
      signal: summaryAbortController.signal
    });

    // Handle text deltas
    stream.on('text', (text: string) => {
      // Check if stream was aborted
      if (get(userRequestedStreamClosure) || summaryAbortController?.signal.aborted) {
        return;
      }

      accumulatedText += text;

      // Update summary content progressively
      conversations.update(convs => {
        const updated = [...convs];
        const currentHistory = updated[conversationIndex].history;
        updated[conversationIndex] = {
          ...updated[conversationIndex],
          history: updateStreamingSummaryContent(currentHistory, summaryIndex, accumulatedText)
        };
        return updated;
      });
    });

    // Note: For summaries, we don't need to handle thinking events separately
    // The summary content is all we need

    stream.on('error', (error: Error) => {
      // Ignore abort errors
      if (error?.name === 'AbortError' || get(userRequestedStreamClosure)) {
        return;
      }
      log.error('Anthropic summary stream error:', error);
    });

    // Wait for stream to complete
    await stream.finalMessage();
  } catch (error) {
    // Handle abort gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      log.debug('Anthropic summary stream aborted by user');
      return accumulatedText;
    }
    throw error;
  }

  return accumulatedText;
}

// ============================================================================
// Dynamic Summary Word Target
// ============================================================================

/**
 * Constants for summary word target bounds
 */
export const SUMMARY_WORD_TARGET_MIN = 50;
export const SUMMARY_WORD_TARGET_MAX = 2000;

/**
 * Calculate the target word count for a summary based on conversation length.
 *
 * Algorithm:
 * 1. Count total characters in all message content
 * 2. Divide by 5 to estimate word count
 * 3. Take 10% of that as the target
 * 4. Clamp between min (50) and max (2000) bounds
 *
 * @param messages - The messages to be summarized
 * @returns Target word count for the summary
 */
export function calculateSummaryWordTarget(messages: ChatMessage[]): number {
  // Count total characters in all message content
  const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);

  // Estimate word count (chars / 5) and take 10%
  const estimatedWords = totalChars / 5;
  const targetWords = Math.round(estimatedWords * 0.10);

  // Clamp between min and max bounds
  return Math.max(SUMMARY_WORD_TARGET_MIN, Math.min(SUMMARY_WORD_TARGET_MAX, targetWords));
}
