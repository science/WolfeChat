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
import { anthropicStreamContext } from './anthropicMessagingService.js';
import { log } from '../lib/logger.js';

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

  try {
    // Create SDK client
    const client = createAnthropicClient(apiKey);

    // Convert messages to SDK format
    const { messages: sdkMessages, system } = convertToSDKFormatWithSystem(messages);

    log.debug("Sending Anthropic SDK message request:", {
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

    log.debug("Anthropic SDK response received:", {
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

    const freshHistory = get(conversations)[convId].history;
    const updatedHistory = [...freshHistory, assistantMessage];
    setHistory(updatedHistory, convId);

  } catch (error) {
    log.error("Error in sendAnthropicMessageSDK:", error);

    // Create user-friendly error message
    const errorMessage = error?.message || 'An error occurred while processing your request.';
    const userFriendlyError = errorMessage.includes('API key')
      ? 'There was an error with the Anthropic API. Maybe the API key is wrong? Or the servers could be down?'
      : `There was an error: ${errorMessage}`;

    const errorChatMessage: ChatMessage = {
      role: "assistant",
      content: userFriendlyError,
    };

    const freshHistory = get(conversations)[convId].history;
    setHistory([...freshHistory, errorChatMessage], convId);
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
  log.debug('[DEBUG] streamAnthropicMessageSDK CALLED with model:', config.model);

  const apiKey = get(anthropicApiKey);
  if (!apiKey) {
    log.error('[DEBUG] API key missing!');
    throw new Error("Anthropic API key is missing.");
  }

  log.debug('[DEBUG] API key present, continuing with stream setup');
  let currentHistory = get(conversations)[convId].history;

  // DEBUG: Log history state at stream start
  log.debug('[DEBUG] History at stream start:', {
    historyLength: currentHistory.length,
    lastMessage: currentHistory[currentHistory.length - 1],
    userMessageCount: currentHistory.filter(m => m.role === 'user').length,
    historyIndices: currentHistory.map((m, i) => ({ index: i, role: m.role }))
  });

  // Buffer for accumulating reasoning text
  let accumulatedReasoningText = '';
  // Buffer for accumulating response text
  let accumulatedResponseText = '';

  try {
    // Create SDK client
    const client = createAnthropicClient(apiKey);

    // Convert messages to SDK format
    const { messages: sdkMessages, system } = convertToSDKFormatWithSystem(messages);

    log.debug("Starting Anthropic SDK stream:", {
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
    log.debug('[DEBUG] Request params after thinking config:', {
      model: configuredParams.model,
      hasThinking: !!configuredParams.thinking,
      thinkingConfig: configuredParams.thinking
    });

    // Get the actual conversation ID (not the index)
    const actualConvId = get(conversations)[convId]?.id;
    log.debug('[DEBUG] Conversation index:', convId, '→ Actual ID:', actualConvId);

    // Calculate anchorIndex: position in history array where user message was added
    // ReasoningInline is rendered after each user message at that history index
    // This matches how OpenAI does it: currentHistory.length - 1
    const anchorIndex = currentHistory.length - 1;
    log.debug('[DEBUG] Anchor index (last message position):', anchorIndex);

    // Create reasoning support for this conversation with anchorIndex
    const reasoningSupport = createAnthropicReasoningSupport({
      convId: actualConvId,
      model: config.model,
      anchorIndex: anchorIndex
    });
    log.debug('[DEBUG] Reasoning support created for conversation ID:', actualConvId, 'anchorIndex:', anchorIndex);

    // Create stream using SDK with configured parameters
    log.debug('[DEBUG] Creating Anthropic SDK stream with params:', {
      model: configuredParams.model,
      hasThinking: !!configuredParams.thinking,
      thinkingBudget: configuredParams.thinking?.budget_tokens
    });
    const stream = client.messages.stream(configuredParams);

    log.debug('[DEBUG] SDK stream created, registering event handlers');

    // Handle streaming events - progressively update conversation history
    stream.on('text', (text, _snapshot) => {
      log.debug('[DEBUG] text event fired, delta length:', text.length);

      // Accumulate response text
      accumulatedResponseText += text;

      // Update streaming context for tests and monitoring
      anthropicStreamContext.set({
        streamText: accumulatedResponseText,
        convId: convId
      });

      // Progressively update conversation history for real-time UI updates
      // IMPORTANT: Use original currentHistory, not fresh history, to avoid duplicates
      // Each update replaces the assistant message, not appends a new one
      const streamingMessage: ChatMessage = {
        role: "assistant",
        content: accumulatedResponseText,
        model: config.model
      };

      const updatedHistory = [...currentHistory, streamingMessage];
      setHistory(updatedHistory, convId);
    });

    // Track if reasoning has started
    let reasoningStarted = false;

    // Listen for thinking event (correct SDK event name)
    stream.on('thinking', (thinkingDelta, _thinkingSnapshot) => {
      log.debug('[DEBUG] thinking event fired!');
      log.debug('Anthropic reasoning delta:', thinkingDelta);

      // Start reasoning on first thinking event
      if (!reasoningStarted) {
        log.debug('Starting Anthropic reasoning block');
        reasoningSupport.startReasoning();
        reasoningStarted = true;
      }

      // Accumulate reasoning text and pass full accumulated text
      accumulatedReasoningText += (thinkingDelta || '');
      reasoningSupport.updateReasoning(accumulatedReasoningText);
    });

    // Also add signature handler for thinking verification
    stream.on('signature', (signature) => {
      log.debug('[DEBUG] signature event fired');
      log.debug('Anthropic reasoning signature:', signature);
      // Optional: Store signature for verification if needed
    });

    // Listen for contentBlock to detect when thinking completes
    stream.on('contentBlock', (block) => {
      log.debug('[DEBUG] contentBlock event fired, type:', block.type);

      // When we get a text content block, thinking must be complete
      if (block.type === 'text' && reasoningStarted) {
        log.debug('Anthropic reasoning block completed (text block started)');
        reasoningSupport.completeReasoning();
      }
    });

    stream.on('error', (error) => {
      log.error("Anthropic SDK stream error:", error);
      throw error;
    });

    log.debug('[DEBUG] All event handlers registered');

    // Wait for stream to complete
    const finalMessage = await stream.finalMessage();

    // Extract final text content
    const responseText = finalMessage.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    log.debug("Anthropic SDK stream completed:", {
      model: finalMessage.model,
      textLength: responseText.length,
      accumulatedLength: accumulatedResponseText.length,
      usage: finalMessage.usage,
      stopReason: finalMessage.stop_reason,
      contentBlocks: finalMessage.content.length,
      contentBlockTypes: finalMessage.content.map(b => b.type)
    });

    // Log if response seems truncated
    if (finalMessage.stop_reason && finalMessage.stop_reason !== 'end_turn') {
      log.warn(`[DEBUG] Response may be truncated! Stop reason: ${finalMessage.stop_reason}`);
    }

    // ALWAYS do final history update with complete message from API
    // This ensures we have the complete response even if progressive updates missed some chunks
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: responseText,
      model: config.model
    };

    // Use original currentHistory for consistency
    const updatedHistory = [...currentHistory, assistantMessage];

    if (accumulatedResponseText !== responseText) {
      log.warn('[DEBUG] Accumulated text mismatch - final message has different content');
    }

    log.debug('[DEBUG] Final history update:', {
      convId,
      originalSnapshotLength: currentHistory.length,
      updatedHistoryLength: updatedHistory.length,
      responseTextLength: responseText.length,
      textMatches: accumulatedResponseText === responseText
    });

    setHistory(updatedHistory, convId);

  } catch (error) {
    log.error("Error in streamAnthropicMessageSDK:", error);

    // Create user-friendly error message
    const errorMessage = error?.message || 'An error occurred while processing your request.';
    const userFriendlyError = errorMessage.includes('API key')
      ? 'There was an error with the Anthropic API. Maybe the API key is wrong? Or the servers could be down?'
      : `There was an error: ${errorMessage}`;

    const errorChatMessage: ChatMessage = {
      role: "assistant",
      content: userFriendlyError,
    };

    // Use original currentHistory for consistency
    setHistory([...currentHistory, errorChatMessage], convId);
    throw error;
  } finally {
    // Clear streaming context
    anthropicStreamContext.set({ streamText: '', convId: null });
  }
}