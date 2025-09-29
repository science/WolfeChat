/**
 * Anthropic SDK Message Converter
 *
 * Converts ChatMessage format to Anthropic SDK format
 * Handles system messages, complex content, and edge cases
 */

import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { ChatMessage } from '../stores/stores.js';

/**
 * Converts ChatMessage array to Anthropic SDK MessageParam format
 * Filters out system messages as they are handled separately
 *
 * @param messages - Array of ChatMessage objects
 * @returns Array of MessageParam objects for SDK
 */
export function convertToSDKFormat(messages: ChatMessage[]): MessageParam[] {
  return messages
    .filter(msg => msg.role !== 'system') // System messages handled separately in SDK
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: normalizeContent(msg.content)
    }));
}

/**
 * Converts ChatMessage array to SDK format and extracts system message
 * Returns both the converted messages and the system message separately
 *
 * @param messages - Array of ChatMessage objects
 * @returns Object with messages array and system message string
 */
export function convertToSDKFormatWithSystem(messages: ChatMessage[]): {
  messages: MessageParam[];
  system?: string;
} {
  const systemMessage = extractSystemMessage(messages);
  const convertedMessages = convertToSDKFormat(messages);

  return {
    messages: convertedMessages,
    ...(systemMessage && { system: systemMessage })
  };
}

/**
 * Extracts system message content from ChatMessage array
 *
 * @param messages - Array of ChatMessage objects
 * @returns System message content or undefined if no system message
 */
export function extractSystemMessage(messages: ChatMessage[]): string | undefined {
  const systemMsg = messages.find(msg => msg.role === 'system');
  return systemMsg ? normalizeContent(systemMsg.content) : undefined;
}

/**
 * Normalizes message content to string format
 * Handles various content types and edge cases
 *
 * @param content - Message content (string, object, or other)
 * @returns Normalized string content
 */
function normalizeContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (content === null || content === undefined) {
    return '';
  }

  // For complex objects, stringify them
  try {
    return JSON.stringify(content);
  } catch (error) {
    // Fallback for non-serializable objects
    return String(content);
  }
}

/**
 * Validates that messages are in correct format for SDK
 *
 * @param messages - Array of MessageParam objects
 * @throws Error if messages are invalid
 */
export function validateSDKMessages(messages: MessageParam[]): void {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== 'object') {
      throw new Error(`Message at index ${i} is not an object`);
    }

    if (!['user', 'assistant'].includes(msg.role)) {
      throw new Error(`Message at index ${i} has invalid role: ${msg.role}`);
    }

    if (typeof msg.content !== 'string') {
      throw new Error(`Message at index ${i} has non-string content`);
    }

    // Warn about empty content as it can cause API errors
    if (msg.content.trim() === '') {
      console.warn(`Message at index ${i} has empty content - this may cause API errors`);
    }
  }
}