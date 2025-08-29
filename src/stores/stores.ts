import { type Writable, writable } from "svelte/store";
export type ChatMessage = { role: 'system'|'user'|'assistant'; content: any };

export interface Conversation {
  id: string; // Add unique ID
  history: ChatMessage[];
  conversationTokens: number;
  assistantRole: string;
  title: string;
}

export interface DefaultAssistantRole {
  role: string;
  type: string;
}

export const settingsVisible = writable(false)
export const helpVisible = writable(false)
export const debugVisible = writable(false)
export const menuVisible = writable(false)

let storedApiKey = localStorage.getItem("api_key")
let parsedApiKey = storedApiKey !== null ? JSON.parse(storedApiKey) : null;

// Resolve API key from env when localStorage is empty
let envApiKey: string | null = null;
try {
  // Node/test environments
  // @ts-ignore
  if (typeof process !== 'undefined' && process?.env?.OPENAI_API_KEY) {
    // @ts-ignore
    envApiKey = String(process.env.OPENAI_API_KEY);
  }
  // Vite/browser builds
  // @ts-ignore
  if (!envApiKey && typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPENAI_API_KEY) {
    // @ts-ignore
    envApiKey = String((import.meta as any).env.VITE_OPENAI_API_KEY);
  }
} catch {}

const initialApiKey: string | null = parsedApiKey ?? envApiKey ?? null;

export const apiKey:Writable<string|null> = writable(initialApiKey)
// Persist to localStorage so downstream code keeps reading from the same source
apiKey.subscribe((value) => localStorage.setItem("api_key", JSON.stringify(value)));

let storedCombinedTokens = localStorage.getItem('combined_tokens');
let parsedCombinedTokens: number = storedCombinedTokens !== null ? JSON.parse(storedCombinedTokens) : 0;
export const combinedTokens = writable(parsedCombinedTokens);
combinedTokens.subscribe((value) => localStorage.setItem("combined_tokens", JSON.stringify(value)));

let storedDefaultAssistantRole = localStorage.getItem('default_assistant_role');
let parsedDefaultAssistantRole: DefaultAssistantRole = storedDefaultAssistantRole !== null ? JSON.parse(storedDefaultAssistantRole) : 0;
export const defaultAssistantRole = writable(parsedDefaultAssistantRole || {
    role: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
    type: "system",
  });
defaultAssistantRole.subscribe((value) => localStorage.setItem("default_assistant_role", JSON.stringify(value)));

export const chosenConversationId = writable(0);

// Helper to generate unique conversation IDs
function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Migration function to add IDs to existing conversations
function migrateConversations(convs: any[]): Conversation[] {
  return convs.map((conv, index) => {
    if (!conv.id) {
      return {
        ...conv,
        id: generateConversationId()
      };
    }
    return conv;
  });
}

let storedConversations = localStorage.getItem('conversations');
let parsedConversations: Conversation[] = storedConversations !== null ? JSON.parse(storedConversations) : null;

// Migrate existing conversations to have IDs
if (parsedConversations) {
  parsedConversations = migrateConversations(parsedConversations);
}

export const conversations: Writable<Conversation[]> = writable(parsedConversations || [{
    id: generateConversationId(),
    history: [],
    conversationTokens: 0,
    assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
    title: "",
  }]);

conversations.subscribe((value) => {
  localStorage.setItem('conversations', JSON.stringify(value));
});


export const selectedModel = writable(localStorage.getItem('selectedModel') || 'gpt-3.5-turbo');
export const selectedVoice = writable(localStorage.getItem('selectedVoice') || 'alloy');
export const selectedMode = writable(localStorage.getItem('selectedMode') || 'GPT');

export const selectedSize = writable(localStorage.getItem('selectedSize') || '1024x1024');
export const selectedQuality = writable(localStorage.getItem('selectedQuality') || 'standard');


selectedModel.subscribe(value => {
    localStorage.setItem("selectedModel", value);
  });
  selectedVoice.subscribe(value => {
    localStorage.setItem("selectedVoice", value);
  });
  selectedSize.subscribe(value => {
    localStorage.setItem("selectedSize", value);
  });
  selectedQuality.subscribe(value => {
    localStorage.setItem("selectedQuality", value);
  });
  selectedMode.subscribe(value => {
    localStorage.setItem("selectedMode", value);
  });
  export const audioUrls = writable([]);

  export const base64Images = writable([]);
  export const clearFileInputSignal = writable(false);


  export const isStreaming = writable(false);  
  export const userRequestedStreamClosure = writable(false);  

  export const streamContext = writable({ streamText: '', convId: null });  

  let storedShowTokens = localStorage.getItem('show_tokens');
let parsedShowTokens = storedShowTokens !== null ? JSON.parse(storedShowTokens) : false;

// Create the writable store with the initial value, either from localStorage or default
export const showTokens = writable(parsedShowTokens);

// Subscribe to changes and update localStorage
showTokens.subscribe(value => {
    localStorage.setItem('show_tokens', JSON.stringify(value));
});

// Export helper function for creating new conversations
export function createNewConversation(): Conversation {
  return {
    id: generateConversationId(),
    history: [],
    conversationTokens: 0,
    assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
    title: "",
  };
}
