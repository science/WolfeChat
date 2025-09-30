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
  console.log('[DEBUG] streamAnthropicMessageSDK CALLED with model:', config.model);

  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    console.error('[DEBUG] API key missing!');
    throw new Error("Anthropic API key is missing.");
  }

  console.log('[DEBUG] API key present, continuing with stream setup');
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
    console.log('[DEBUG] Request params after thinking config:', {
      model: configuredParams.model,
      hasThinking: !!configuredParams.thinking,
      thinkingConfig: configuredParams.thinking
    });

    // Get the actual conversation ID (not the index)
    const actualConvId = get(conversations)[convId]?.id;
    console.log('[DEBUG] Conversation index:', convId, '→ Actual ID:', actualConvId);

    // Calculate anchorIndex: index of the last user message in history
    // ReasoningInline is rendered after each user message with that index
    const userMessageIndex = currentHistory.filter(m => m.role === 'user').length - 1;
    console.log('[DEBUG] Anchor index (last user message):', userMessageIndex);

    // Create reasoning support for this conversation with anchorIndex
    const reasoningSupport = createAnthropicReasoningSupport({
      convId: actualConvId,
      model: config.model,
      anchorIndex: userMessageIndex
    });
    console.log('[DEBUG] Reasoning support created for conversation ID:', actualConvId, 'anchorIndex:', userMessageIndex);

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
    console.log('[DEBUG] Creating Anthropic SDK stream with params:', {
      model: configuredParams.model,
      hasThinking: !!configuredParams.thinking,
      thinkingBudget: configuredParams.thinking?.budget_tokens
    });
    const stream = client.messages.stream(configuredParams);

    console.log('[DEBUG] SDK stream created, registering event handlers');

    // Handle streaming events
    stream.on('text', (text) => {
      console.log('[DEBUG] text event fired, length:', text.length);
      accumulatedText += text;
      updateHistoryBatched();
    });

    // Track if reasoning has started
    let reasoningStarted = false;

    // Listen for thinking event (correct SDK event name)
    stream.on('thinking', (thinkingDelta, thinkingSnapshot) => {
      console.log('[DEBUG] thinking event fired!');
      console.log('Anthropic reasoning delta:', thinkingDelta);

      // Start reasoning on first thinking event
      if (!reasoningStarted) {
        console.log('Starting Anthropic reasoning block');
        reasoningSupport.startReasoning();
        reasoningStarted = true;
      }

      reasoningSupport.updateReasoning(thinkingDelta || '');
    });

    // Also add signature handler for thinking verification
    stream.on('signature', (signature) => {
      console.log('[DEBUG] signature event fired');
      console.log('Anthropic reasoning signature:', signature);
      // Optional: Store signature for verification if needed
    });

    // Listen for contentBlock to detect when thinking completes
    stream.on('contentBlock', (block) => {
      console.log('[DEBUG] contentBlock event fired, type:', block.type);

      // When we get a text content block, thinking must be complete
      if (block.type === 'text' && reasoningStarted) {
        console.log('Anthropic reasoning block completed (text block started)');
        reasoningSupport.completeReasoning();
      }
    });

    stream.on('error', (error) => {
      console.error("Anthropic SDK stream error:", error);
      throw error;
    });

    console.log('[DEBUG] All event handlers registered');

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