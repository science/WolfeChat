// Anthropic Claude API service
export async function fetchAnthropicModels(apiKey: string): Promise<any[]> {
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  try {
    // For now, return a hardcoded list of Claude models since Anthropic doesn't have a public models endpoint
    // In the future, this could be replaced with actual API calls if such an endpoint becomes available
    const claudeModels = [
      // Claude 4 models (2025)
      { id: 'claude-4-sonnet-20250514', provider: 'anthropic', created: 1715644800 },
      { id: 'claude-4-opus-20250514', provider: 'anthropic', created: 1715644800 },
      { id: 'claude-opus-4-1-20250805', provider: 'anthropic', created: 1722816000 },

      // Claude 3.7 models
      { id: 'claude-3-7-sonnet-20250224', provider: 'anthropic', created: 1708732800 },

      // Claude 3.5 models
      { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', created: 1729641600 },
      { id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', created: 1718841600 },
      { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', created: 1729641600 },

      // Claude 3 models
      { id: 'claude-3-opus-20240229', provider: 'anthropic', created: 1709251200 },
      { id: 'claude-3-sonnet-20240229', provider: 'anthropic', created: 1709251200 },
      { id: 'claude-3-haiku-20240307', provider: 'anthropic', created: 1709856000 },
    ];

    // Test API key validity by making a simple request
    await testAnthropicConnection(apiKey);

    return claudeModels;
  } catch (error) {
    console.error("Failed to fetch Anthropic models:", error);
    throw error;
  }
}

// Test Anthropic API connection
async function testAnthropicConnection(apiKey: string): Promise<void> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid Anthropic API key");
      } else if (response.status === 429) {
        throw new Error("Anthropic API rate limit exceeded");
      } else {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to connect to Anthropic API");
  }
}

// Check if a model is a Claude/Anthropic model
export function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith('claude-');
}

// Get the provider for a model based on its ID
export function getModelProvider(modelId: string): 'openai' | 'anthropic' {
  return isAnthropicModel(modelId) ? 'anthropic' : 'openai';
}