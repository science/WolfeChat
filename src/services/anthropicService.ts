// Anthropic Claude API service
export async function fetchAnthropicModels(apiKey: string): Promise<any[]> {
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
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

    const data = await response.json();

    // Transform to match OpenAI's format for consistency
    return data.data.map(model => ({
      id: model.id,
      provider: 'anthropic',
      created: new Date(model.created_at).getTime() / 1000, // Convert to Unix timestamp
      display_name: model.display_name
    }));
  } catch (error) {
    console.error("Failed to fetch Anthropic models:", error);
    throw error;
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