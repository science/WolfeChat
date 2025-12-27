import { writable, type Writable } from 'svelte/store';

export type Provider = 'OpenAI' | 'Anthropic';

// Provider selection
let storedProvider = localStorage.getItem('selectedProvider') as Provider | null;
export const selectedProvider: Writable<Provider> = writable(storedProvider || 'OpenAI');
selectedProvider.subscribe((value) => {
  localStorage.setItem('selectedProvider', value);
});

// Helper to safely parse JSON from localStorage
function safeJsonParse(value: string | null): string | null {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    // If parsing fails, return null (treat as no stored value)
    return null;
  }
}

// OpenAI API Key
let storedOpenAIKey = localStorage.getItem('openai_api_key');
let parsedOpenAIKey = safeJsonParse(storedOpenAIKey);

// Migrate existing api_key to openai_api_key if needed
if (!parsedOpenAIKey) {
  const legacyKey = localStorage.getItem('api_key');
  if (legacyKey) {
    parsedOpenAIKey = safeJsonParse(legacyKey);
    if (parsedOpenAIKey) {
      localStorage.setItem('openai_api_key', JSON.stringify(parsedOpenAIKey));
    }
  }
}

export const openaiApiKey: Writable<string | null> = writable(parsedOpenAIKey);
openaiApiKey.subscribe((value) => {
  localStorage.setItem('openai_api_key', JSON.stringify(value));
});

// Anthropic API Key
let storedAnthropicKey = localStorage.getItem('anthropic_api_key');
let parsedAnthropicKey = safeJsonParse(storedAnthropicKey);

export const anthropicApiKey: Writable<string | null> = writable(parsedAnthropicKey);
anthropicApiKey.subscribe((value) => {
  localStorage.setItem('anthropic_api_key', JSON.stringify(value));
});

// Derived store for current API key based on selected provider
import { derived } from 'svelte/store';

export const currentApiKey = derived(
  [selectedProvider, openaiApiKey, anthropicApiKey],
  ([$selectedProvider, $openaiApiKey, $anthropicApiKey]) => {
    return $selectedProvider === 'OpenAI' ? $openaiApiKey : $anthropicApiKey;
  }
);