/**
 * Anthropic SDK Messaging Service
 *
 * SDK-based implementation for sending messages to Anthropic API
 * Replaces the direct fetch approach with proper SDK integration
 */

import { get } from 'svelte/store';
import type { ChatMessage } from '../stores/stores.js';
import { anthropicApiKey } from '../stores/providerStore.js';
import { conversations } from '../stores/stores.js';
import { setHistory } from '../managers/conversationManager.js';
import { createAnthropicClient } from './anthropicClientFactory.js';
import { convertToSDKFormatWithSystem } from './anthropicSDKConverter.js';
import { addThinkingConfigurationWithBudget, createAnthropicReasoningSupport } from './anthropicReasoning.js';
import { getMaxOutputTokens } from './anthropicModelConfig.js';

/**
 * Send non-streaming message to Anthropic API using SDK
 */
export async function sendAnthropicMessageSDK(
  messages: ChatMessage[],
  convId: number,
  config: { model: string }
): Promise<void> {
  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  let currentHistory = get(conversations)[convId].history;

  try {
    // Create SDK client
    const client = createAnthropicClient(apiKey);

    // Convert messages to SDK format
    const { messages: sdkMessages, system } = convertToSDKFormatWithSystem(messages);

    console.log("Sending Anthropic SDK message request:", {
      model: config.model,
      messageCount: sdkMessages.length,
      hasSystem: !!system
    });

    // Build request parameters with model-specific max_tokens
    const requestParams: any = {
      model: config.model,
      max_tokens: getMaxOutputTokens(config.model), // Dynamic max_tokens from model config
      messages: sdkMessages,
      stream: false
    };

    // Add system message if present
    if (system) {
      requestParams.system = system;
    }

    // Add thinking configuration for reasoning models
    const configuredParams = addThinkingConfigurationWithBudget(requestParams);

    // Send message via SDK
    const response = await client.messages.create(configuredParams);

    // Extract text content from response
    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text) // Cast to any since SDK types may vary
      .join('');

    console.log("Anthropic SDK response received:", {
      model: response.model,
      textLength: responseText.length,
      usage: response.usage
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
    console.error("Error in sendAnthropicMessageSDK:", error);

    // Create user-friendly error message
    const errorMessage = error?.message || 'An error occurred while processing your request.';
    const userFriendlyError = errorMessage.includes('API key')
      ? 'There was an error with the Anthropic API. Maybe the API key is wrong? Or the servers could be down?'
      : `There was an error: ${errorMessage}`;

    const errorChatMessage: ChatMessage = {
      role: "assistant",
      content: userFriendlyError,
    };

    setHistory([...currentHistory, errorChatMessage], convId);
    throw error;
  }
}

/**
 * Send streaming message to Anthropic API using SDK
 */
export async function streamAnthropicMessageSDK(
  messages: ChatMessage[],
  convId: number,
  config: { model: string }
): Promise<void> {
  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  let currentHistory = get(conversations)[convId].history;

  // Buffer for batching history updates
  let accumulatedText = '';
  let lastHistoryUpdate = Date.now();
  const historyUpdateInterval = 100; // Update history every 100ms max

  try {
    // Create SDK client
    const client = createAnthropicClient(apiKey);

    // Convert messages to SDK format
    const { messages: sdkMessages, system } = convertToSDKFormatWithSystem(messages);

    console.log("Starting Anthropic SDK stream:", {
      model: config.model,
      messageCount: sdkMessages.length,
      hasSystem: !!system
    });

    // Build request parameters with model-specific max_tokens
    const requestParams: any = {
      model: config.model,
      max_tokens: getMaxOutputTokens(config.model), // Dynamic max_tokens from model config
      messages: sdkMessages,
      stream: true
    };

    // Add system message if present
    if (system) {
      requestParams.system = system;
    }

    // Add thinking configuration for reasoning models
    const configuredParams = addThinkingConfigurationWithBudget(requestParams);

    // Create reasoning support for this conversation
    const reasoningSupport = createAnthropicReasoningSupport({
      convId: String(convId),
      model: config.model
    });

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

    // Create stream using SDK with configured parameters
    const stream = client.messages.stream(configuredParams);

    // Handle streaming events
    stream.on('text', (text) => {
      accumulatedText += text;
      updateHistoryBatched();
    });

    stream.on('content_block_start', (block) => {
      if (block.type === 'thinking') {
        console.log('Starting Anthropic reasoning block');
        reasoningSupport.startReasoning();
      }
    });

    stream.on('content_block_delta', (delta) => {
      if (delta.type === 'text_delta') {
        // Regular text content is handled by 'text' event
      } else if (delta.type === 'thinking_delta') {
        console.log('Anthropic reasoning delta:', delta.text);
        reasoningSupport.updateReasoning(delta.text || '');
      }
    });

    stream.on('content_block_stop', (block) => {
      if (block.type === 'thinking') {
        console.log('Anthropic reasoning block completed');
        reasoningSupport.completeReasoning();
      }
    });

    stream.on('error', (error) => {
      console.error("Anthropic SDK stream error:", error);
      throw error;
    });

    // Wait for stream to complete
    const finalMessage = await stream.finalMessage();

    // Extract final text content
    const responseText = finalMessage.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    console.log("Anthropic SDK stream completed:", {
      model: finalMessage.model,
      textLength: responseText.length,
      usage: finalMessage.usage
    });

    // Final history update with complete message
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: responseText,
      model: config.model
    };

    const updatedHistory = [...currentHistory, assistantMessage];
    setHistory(updatedHistory, convId);

  } catch (error) {
    console.error("Error in streamAnthropicMessageSDK:", error);

    // Create user-friendly error message
    const errorMessage = error?.message || 'An error occurred while processing your request.';
    const userFriendlyError = errorMessage.includes('API key')
      ? 'There was an error with the Anthropic API. Maybe the API key is wrong? Or the servers could be down?'
      : `There was an error: ${errorMessage}`;

    const errorChatMessage: ChatMessage = {
      role: "assistant",
      content: userFriendlyError,
    };

    setHistory([...currentHistory, errorChatMessage], convId);
    throw error;
  }
}