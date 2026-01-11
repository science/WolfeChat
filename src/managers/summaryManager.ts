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
 */
export function formatSummaryPrompt(messages: ChatMessage[]): string {
  const conversationText = messages.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${msg.content}`;
  }).join('\n\n');

  return `Summarize the following conversation concisely. Focus on:
1. Key topics discussed
2. Important decisions or conclusions
3. Any action items or next steps mentioned

Keep the summary under 200 words. Write in third person.

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
 * Stream summary via OpenAI API
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates concise, accurate summaries of conversations.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
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
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulatedText += delta;

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
 * Stream summary via Anthropic API
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [
        { role: 'user', content: prompt }
      ],
      system: 'You are a helpful assistant that creates concise, accurate summaries of conversations.',
      stream: true
    }),
    signal: summaryAbortController.signal
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${text || response.statusText}`);
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
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          // Anthropic uses content_block_delta events
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            accumulatedText += parsed.delta.text;

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
