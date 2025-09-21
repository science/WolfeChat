import { writable, type Writable } from 'svelte/store';

export type Provider = 'OpenAI' | 'Anthropic';

// Provider selection
let storedProvider = localStorage.getItem('selectedProvider') as Provider | null;
export const selectedProvider: Writable<Provider> = writable(storedProvider || 'OpenAI');
selectedProvider.subscribe((value) => {
  localStorage.setItem('selectedProvider', value);
});

// OpenAI API Key
let storedOpenAIKey = localStorage.getItem('openai_api_key');
let parsedOpenAIKey = storedOpenAIKey !== null ? JSON.parse(storedOpenAIKey) : null;

// Migrate existing api_key to openai_api_key if needed
if (!parsedOpenAIKey) {
  const legacyKey = localStorage.getItem('api_key');
  if (legacyKey) {
    parsedOpenAIKey = JSON.parse(legacyKey);
    localStorage.setItem('openai_api_key', JSON.stringify(parsedOpenAIKey));
  }
}

export const openaiApiKey: Writable<string | null> = writable(parsedOpenAIKey);
openaiApiKey.subscribe((value) => {
  localStorage.setItem('openai_api_key', JSON.stringify(value));
});

// Anthropic API Key
let storedAnthropicKey = localStorage.getItem('anthropic_api_key');
let parsedAnthropicKey = storedAnthropicKey !== null ? JSON.parse(storedAnthropicKey) : null;

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