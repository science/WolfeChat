/**
 * Anthropic Client Factory
 *
 * Creates properly configured Anthropic SDK clients for browser environments
 * Encapsulates the browser configuration and provides a clean interface
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Creates an Anthropic SDK client configured for browser use
 *
 * @param apiKey - The Anthropic API key
 * @returns Configured Anthropic client instance
 * @throws Error if configuration fails
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  // Validate API key (basic check)
  if (typeof apiKey !== 'string') {
    throw new Error('API key must be a string');
  }

  try {
    // Create client with browser configuration
    const client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    return client;
  } catch (error) {
    throw new Error(`Failed to create Anthropic client: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates an Anthropic client with additional configuration options
 *
 * @param apiKey - The Anthropic API key
 * @param options - Additional client configuration options
 * @returns Configured Anthropic client instance
 */
export function createAnthropicClientWithOptions(
  apiKey: string,
  options: Partial<ConstructorParameters<typeof Anthropic>[0]> = {}
): Anthropic {
  const config = {
    apiKey,
    dangerouslyAllowBrowser: true,
    ...options,
  };

  try {
    return new Anthropic(config);
  } catch (error) {
    throw new Error(`Failed to create Anthropic client with options: ${error instanceof Error ? error.message : String(error)}`);
  }
}