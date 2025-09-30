import { get, writable } from 'svelte/store';
import type { ChatMessage } from "../stores/stores.js";
import { anthropicApiKey } from "../stores/providerStore.js";
import {
  conversations
} from "../stores/stores.js";
import {
  setHistory
} from "../managers/conversationManager.js";
import { sendAnthropicMessageSDK, streamAnthropicMessageSDK } from "./anthropicSDKMessaging.js";

// Feature flag to control SDK vs fetch implementation
const USE_ANTHROPIC_SDK = true;

// Type definitions for Anthropic API
type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AnthropicRequest = {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  stream?: boolean;
};

type AnthropicResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

// Global abort controller for streaming
let globalAnthropicAbortController: AbortController | null = null;

// Streaming state management
export const isAnthropicStreaming = writable(false);
export const userRequestedAnthropicStreamClosure = writable(false);
export const anthropicStreamContext = writable<{ streamText: string; convId: number | null }>({ streamText: '', convId: null });

// Helper function to append error messages to conversation history
export function appendAnthropicErrorToHistory(error: any, currentHistory: ChatMessage[], convId: number): void {
  const errorMessage = error?.message || 'An error occurred while processing your request.';
  const userFriendlyError = errorMessage.includes('API key')
    ? 'There was an error with the Anthropic API. Maybe the API key is wrong? Or the servers could be down?'
    : `There was an error: ${errorMessage}`;

  const errorChatMessage: ChatMessage = {
    role: "assistant",
    content: userFriendlyError,
  };

  setHistory([...currentHistory, errorChatMessage], convId);
}

// Convert OpenAI message format to Anthropic format
export function convertMessagesToAnthropicFormat(messages: ChatMessage[]): AnthropicMessage[] {
  return messages
    .filter(msg => msg.role !== 'system') // Anthropic handles system messages differently
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    }));
}

// Extract system message from OpenAI messages (for future use)
export function extractSystemMessage(messages: ChatMessage[]): string | undefined {
  const systemMsg = messages.find(msg => msg.role === 'system');
  return systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content)) : undefined;
}

// Gracefully stop an in-flight streaming response
export function closeAnthropicStream() {
  try {
    userRequestedAnthropicStreamClosure.set(true);
    const ctrl = globalAnthropicAbortController;
    if (ctrl) {
      ctrl.abort();
    }
  } catch (e) {
    console.warn('closeAnthropicStream abort failed:', e);
  } finally {
    globalAnthropicAbortController = null;
    isAnthropicStreaming.set(false);
  }
}

// Send non-streaming message to Anthropic API
export async function sendAnthropicMessage(
  messages: ChatMessage[],
  convId: number,
  config: { model: string }
): Promise<void> {
  // Use SDK implementation if feature flag is enabled
  if (USE_ANTHROPIC_SDK) {
    console.log("Using Anthropic SDK for non-streaming message");
    return sendAnthropicMessageSDK(messages, convId, config);
  }

  // Legacy fetch implementation (kept for rollback capability)
  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  let currentHistory = get(conversations)[convId].history;

  try {
    const anthropicMessages = convertMessagesToAnthropicFormat(messages);
    const systemMessage = extractSystemMessage(messages);

    const requestBody: AnthropicRequest = {
      model: config.model,
      max_tokens: 4096, // Claude's default max
      messages: anthropicMessages,
      stream: false
    };

    // Add system message if present (for Claude 3+ models)
    if (systemMessage && config.model.includes('claude-3')) {
      (requestBody as any).system = systemMessage;
    }

    console.log("Sending Anthropic message request (fetch):", { model: config.model, messageCount: anthropicMessages.length });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);

      if (response.status === 401) {
        throw new Error("Invalid Anthropic API key");
      } else if (response.status === 429) {
        throw new Error("Anthropic API rate limit exceeded");
      } else {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }
    }

    const data: AnthropicResponse = await response.json();

    // Extract text content from response
    const responseText = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    console.log("Anthropic response received (fetch):", {
      model: data.model,
      textLength: responseText.length,
      usage: data.usage
    });

    // Add response to conversation history
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: responseText,
      model: config.model
    };

    const updatedHistory = [...currentHistory, assistantMessage];
    setHistory(updatedHistory, convId);

  } catch (error) {
    console.error("Error in sendAnthropicMessage (fetch):", error);
    appendAnthropicErrorToHistory(error, currentHistory, convId);
    throw error;
  }
}

// Send streaming message to Anthropic API
export async function streamAnthropicMessage(
  messages: ChatMessage[],
  convId: number,
  config: { model: string }
): Promise<void> {
  // Use SDK implementation if feature flag is enabled
  if (USE_ANTHROPIC_SDK) {
    console.log("Using Anthropic SDK for streaming message");
    isAnthropicStreaming.set(true);
    userRequestedAnthropicStreamClosure.set(false);

    try {
      await streamAnthropicMessageSDK(messages, convId, config);
    } finally {
      isAnthropicStreaming.set(false);
      userRequestedAnthropicStreamClosure.set(false);
    }
    return;
  }

  // Legacy fetch implementation (kept for rollback capability)
  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  let currentHistory = get(conversations)[convId].history;
  isAnthropicStreaming.set(true);
  userRequestedAnthropicStreamClosure.set(false);

  // Buffer for batching history updates
  let accumulatedText = '';
  let lastHistoryUpdate = Date.now();
  const historyUpdateInterval = 100; // Update history every 100ms max

  // Recovery state
  let streamInterrupted = false;
  let finalMessage: ChatMessage | null = null;

  try {
    const anthropicMessages = convertMessagesToAnthropicFormat(messages);
    const systemMessage = extractSystemMessage(messages);

    const requestBody: AnthropicRequest = {
      model: config.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      stream: true
    };

    // Add system message if present (for Claude 3+ models)
    if (systemMessage && config.model.includes('claude-3')) {
      (requestBody as any).system = systemMessage;
    }

    console.log("Starting Anthropic stream:", { model: config.model, messageCount: anthropicMessages.length });

    const controller = new AbortController();
    globalAnthropicAbortController = controller;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      globalAnthropicAbortController = null;

      if (response.status === 401) {
        throw new Error("Invalid Anthropic API key");
      } else if (response.status === 429) {
        throw new Error("Anthropic API rate limit exceeded");
      } else {
        throw new Error(`Anthropic API stream error ${response.status}: ${errorText || response.statusText}`);
      }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Helper function to update history with batching
    const updateHistoryBatched = (force: boolean = false) => {
      const now = Date.now();
      if (force || (now - lastHistoryUpdate) >= historyUpdateInterval) {
        if (accumulatedText.trim()) {
          const streamingMessage: ChatMessage = {
            role: "assistant",
            content: accumulatedText,
            model: config.model
          };

          setHistory([...currentHistory, streamingMessage], convId);
          lastHistoryUpdate = now;
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Check if user requested stream closure
        if (get(userRequestedAnthropicStreamClosure)) {
          console.log('User requested stream closure');
          streamInterrupted = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              console.log('Anthropic stream completed');
              break;
            }

            try {
              const event = JSON.parse(data);

              if (event.type === 'content_block_delta' && event.delta?.text) {
                const deltaText = event.delta.text;
                accumulatedText += deltaText;

                // Update the streaming context immediately for UI responsiveness
                anthropicStreamContext.set({
                  streamText: accumulatedText,
                  convId: convId
                });

                // Update conversation history with batching
                updateHistoryBatched(false);
              }

            } catch (parseError) {
              console.warn('Failed to parse Anthropic SSE event:', parseError, data);
              // Continue processing other events
            }
          }
        }
      }

      // Final history update
      updateHistoryBatched(true);

    } catch (streamError) {
      console.warn('Streaming interrupted:', streamError);
      streamInterrupted = true;

      // If we have accumulated text, save it as a partial response
      if (accumulatedText.trim()) {
        finalMessage = {
          role: "assistant",
          content: accumulatedText + (streamError.name === 'AbortError' ? '' : '\n\n[Stream interrupted - partial response]'),
          model: config.model
        };
      }
    } finally {
      reader.releaseLock();
      isAnthropicStreaming.set(false);
      globalAnthropicAbortController = null;

      // Clear streaming context
      anthropicStreamContext.set({ streamText: '', convId: null });

      // Save final message if we have content and stream was interrupted
      if (streamInterrupted && finalMessage && finalMessage.content.trim()) {
        setHistory([...currentHistory, finalMessage], convId);
        console.log("Saved partial response due to stream interruption:", finalMessage.content.length, "characters");
      }

      console.log("Anthropic stream finished, final text length:", accumulatedText.length);
    }

  } catch (error) {
    console.error("Error in streamAnthropicMessage:", error);
    isAnthropicStreaming.set(false);
    globalAnthropicAbortController = null;
    anthropicStreamContext.set({ streamText: '', convId: null });

    // Don't append error if we already have a partial response
    if (!finalMessage || !finalMessage.content.trim()) {
      appendAnthropicErrorToHistory(error, currentHistory, convId);
    }
    throw error;
  }
}