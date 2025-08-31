import { get, writable } from 'svelte/store';
// ChatCompletions SDK removed; using fetch-based Responses API only
import type { ChatMessage } from "../stores/stores.js";
import { 
  apiKey, 
  conversations, 
  chosenConversationId, 
  selectedModel, 
  selectedSize,
  selectedQuality,
  defaultAssistantRole
} from "../stores/stores.js";
import { reasoningEffort, verbosity, summary } from "../stores/reasoningSettings.js";
import {
  createReasoningWindow,
  collapseReasoningWindow,
  startReasoningPanel,
  setReasoningText,
  completeReasoningPanel,
  logSSEEvent
} from "../stores/reasoningStore.js";
import {
  setHistory,
  cleanseMessage,
  displayAudioMessage,
  countTokens,
  estimateTokens
} from "../managers/conversationManager.js";
import { onSendVisionMessageComplete } from "../managers/imageManager.js";
import { countTicks } from "../utils/generalUtils.js";
import { saveAudioBlob, getAudioBlob } from "../idb.js";

// Type definitions for legacy OpenAI SDK compatibility
type ChatCompletionRequestMessage = ChatMessage;
type ChatCompletionRequestMessageRoleEnum = 'system' | 'user' | 'assistant';
type OpenAIApi = any;

// Legacy globals for backward compatibility
let openai: OpenAIApi = null;
let configuration: any = null;

// Global abort controller for streaming
let globalAbortController: AbortController | null = null;

// Gracefully stop an in-flight streaming response
export function closeStream() {
  try {
    userRequestedStreamClosure.set(true);
    const ctrl = globalAbortController;
    if (ctrl) {
      ctrl.abort();
    }
  } catch (e) {
    console.warn('closeStream abort failed:', e);
  } finally {
    globalAbortController = null;
    isStreaming.set(false);
  }
}


// Streaming state management
export const isStreaming = writable(false);
export const userRequestedStreamClosure = writable(false);
export const streamContext = writable<{ streamText: string; convId: any }>({ streamText: '', convId: null });

// ChatCompletions SDK removed; using fetch-based Responses API only
const errorMessage: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "There was an error. Maybe the API key is wrong? Or the servers could be down?",
  },
];

// Deprecated: ChatCompletions SDK initialization removed
export function initOpenAIApi(): void {
  const key = get(apiKey);
  if (key) {
    configuration = { apiKey: key };
    openai = { configured: true };
    console.log("OpenAI API initialized.");
  } else {
    console.warn("API key is not set. Please set the API key before initializing.");
  }
}

export function getOpenAIApi(): OpenAIApi {
  if (!openai) {
    throw new Error("OpenAI API is not initialized. Please call initOpenAIApi with your API key first.");
  }
  console.log("OpenAI API retrieved.");
  return openai;
}

export async function createChatCompletion(model: string, messages: ChatCompletionRequestMessage[]): Promise<any> {
  const openaiClient = getOpenAIApi();
  console.log("Sending chat completion request...");
  try {
    const response = await openaiClient.createChatCompletion({
      model: model,
      messages: messages,
    });
    console.log("Chat completion response received.");
    return response;
  } catch (error) {
    console.error("Error in createChatCompletion:", error);
    throw error; // Rethrow to handle it in the caller function
  }
}

export function isConfigured(): boolean {
  console.log("Checking if OpenAI API is configured.");
  return configuration !== null && get(apiKey) !== null;
}

export function reloadConfig(): void {
  initOpenAIApi(); 
  console.log("Configuration reloaded.");
}

export async function sendRequest(msg: ChatCompletionRequestMessage[], model: string = get(selectedModel)): Promise<any> {
  try {
    msg = [
      {
        role: "system",
        content: get(conversations)[get(chosenConversationId)].assistantRole,
      },
      ...msg,
    ];

    const key = get(apiKey);
  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
    const input = buildResponsesInputFromMessages(msg);
    const payload = buildResponsesPayload(resolvedModel, input, false);

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
    }

    const data = await res.json();

    if (data?.usage) {
      countTokens(data.usage);
    }

    return data;
  } catch (error) {
    console.error("Error in sendRequest:", error);
    configuration = null;
    await setHistory(errorMessage);
    throw error;
  }
}

function parseJSONChunks(rawData) {
  try {
    // First, let's log the raw data to see what we're getting
    console.log('Raw SSE data:', rawData);
    
    // Handle the case where data might be a single JSON object
    if (rawData.trim().startsWith('{') && rawData.trim().endsWith('}')) {
      try {
        return [JSON.parse(rawData)];
      } catch (e) {
        console.error('Failed to parse single JSON object:', e);
      }
    }
    
    // Handle the case where data might be multiple JSON objects concatenated
    const jsonRegex = /\{"id".*?\]\}/g;
    const matches = rawData.match(jsonRegex);
    
    if (matches) {
      return matches.map(chunk => {
        try {
          return JSON.parse(chunk);
        } catch (e) {
          console.error('Failed to parse JSON chunk:', chunk, e);
          return null;
        }
      }).filter(Boolean);
    }
    
    // If no matches found, try to parse as a single object
    try {
      const parsed = JSON.parse(rawData);
      return [parsed];
    } catch (e) {
      console.error('Failed to parse raw data as JSON:', e);
      return [];
    }
  } catch (error) {
    console.error("Error parsing JSON chunk:", error);
    console.error("Raw data was:", rawData);
    return [];
  }
}

export async function sendTTSMessage(text: string, model: string, voice: string, conversationId: number) {
  console.log("Sending TTS message.");

  const payload = {
    model: model,
    voice: voice,
    input: text,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${get(apiKey)}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Failed to generate audio, response status: ${response.status}`);
    
    const blob = await response.blob();
    const uniqueID = `audio-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

saveAudioBlob(uniqueID, blob).then(() => {
console.log('Audio blob saved to IndexedDB with ID:', uniqueID);
}).catch(console.error);

getAudioBlob(uniqueID).then(blob => {  
console.log(uniqueID); // Check the object
console.log(blob); // Check the object
if (blob instanceof Blob) {
  if (blob) {
const audioUrl = URL.createObjectURL(blob);
displayAudioMessage(audioUrl);
} else {
console.error('Blob is null or undefined');
}

} else {
  console.error('Retrieved object is not a Blob:', blob);
}
}).catch(error => console.error('Error retrieving audio blob:', error));



  } catch (error) {
    console.error("TTS request error:", error);
  }

}

export async function sendVisionMessage(msg: ChatCompletionRequestMessage[], imagesBase64, convId) {
  console.log("Sending vision message.");
  userRequestedStreamClosure.set(false);

  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get(conversations)[convId].history;
  const anchorIndex = currentHistory.length - 1;
  // Get the conversation's unique string ID for reasoning window tracking
  const conversationUniqueId = get(conversations)[convId]?.id;

  const historyMessages = currentHistory.map((historyItem) => ({
    role: historyItem.role,
    content: convertChatContentToResponsesContent(historyItem.content, historyItem.role),
  }));

  const userTextMessage = [...msg].reverse().find((m) => m.role === "user")?.content || "";
  const contentParts: any[] = [];
  if (userTextMessage) contentParts.push({ type: "input_text", text: userTextMessage });
  for (const imageBase64 of imagesBase64) {
    contentParts.push({ type: "input_image", image_url: imageBase64 });
  }

  const currentMessage = { role: "user", content: contentParts };
  const finalInput = [...historyMessages, currentMessage];

  let streamText = "";
  currentHistory = [...currentHistory];
  isStreaming.set(true);

  try {
    await streamResponseViaResponsesAPI(
      '',
      undefined,
      {
        onTextDelta: (text) => {
          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) { ticks = !ticks; tickCounter = 0; }
          streamText += text;
          streamContext.set({ streamText, convId });
          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText + "█" + (ticks ? "\n```" : ""),
                model: get(selectedModel),
              },
            ],
            convId
          );
        },
        onCompleted: async () => {
          if (get(userRequestedStreamClosure)) {
            streamText = streamText.replace(/█+$/, '');
            userRequestedStreamClosure.set(false);
          }
          await setHistory(
            [
              ...currentHistory,
              { role: "assistant", content: streamText, model: get(selectedModel) },
            ],
            convId
          );
          estimateTokens(msg, convId);
          streamText = "";
          isStreaming.set(false);
          onSendVisionMessageComplete();
        },
        onError: (_err) => {
          isStreaming.set(false);
          onSendVisionMessageComplete();
        },
      },
      finalInput,
      { convId: conversationUniqueId, anchorIndex }
    );
  } finally {
    isStreaming.set(false);
  }
}

  export async function sendRegularMessage(msg: ChatCompletionRequestMessage[], convId) {
  userRequestedStreamClosure.set(false);
  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get(conversations)[convId].history;
  const anchorIndex = currentHistory.length - 1;
  // Get the conversation's unique string ID for reasoning window tracking
  const conversationUniqueId = get(conversations)[convId]?.id;
  
  let roleMsg: ChatCompletionRequestMessage = {
    role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
    content: get(conversations)[convId].assistantRole,
  };
  
  msg = [roleMsg, ...msg];
  const cleansedMessages = msg.map(cleanseMessage);
  const input = buildResponsesInputFromMessages(cleansedMessages);

  // Extract the last user prompt text for potential title generation
  let lastUserPromptText = '';
  const lastUserMessage = [...cleansedMessages].reverse().find((m) => m.role === 'user');
  if (lastUserMessage) {
    const c: any = (lastUserMessage as any).content;
    if (typeof c === 'string') {
      lastUserPromptText = c;
    } else if (Array.isArray(c)) {
      lastUserPromptText = c.map((p: any) => (typeof p === 'string' ? p : (p?.text ?? ''))).join(' ').trim();
    } else if (c != null) {
      lastUserPromptText = String(c);
    }
  }

  let streamText = "";
  currentHistory = [...currentHistory];
  isStreaming.set(true);

  try {
    await streamResponseViaResponsesAPI(
      '',
      undefined,
      {
        onTextDelta: (text) => {
          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) {
            ticks = !ticks;
            tickCounter = 0;
          }
          streamText += text;
          streamContext.set({ streamText, convId });
          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText + "█" + (ticks ? "\n```" : ""),
                model: get(selectedModel),
              },
            ],
            convId
          );
        },
        onCompleted: async (_finalText) => {
          if (get(userRequestedStreamClosure)) {
            streamText = streamText.replace(/█+$/, '');
            userRequestedStreamClosure.set(false);
          }
          await setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText,
                model: get(selectedModel),
              },
            ],
            convId
          );
          estimateTokens(msg, convId);

          // Trigger title generation for brand-new conversations
          await maybeUpdateTitleAfterFirstMessage(convId, lastUserPromptText, streamText);

          streamText = "";
          isStreaming.set(false);
        },
        onError: (_err) => {
          isStreaming.set(false);
        },
      },
      input,
      { convId: conversationUniqueId, anchorIndex }
    );
  } finally {
    isStreaming.set(false);
  }
}




  export async function sendDalleMessage(msg: ChatCompletionRequestMessage[], convId) {
    isStreaming.set(true);
    let hasEncounteredError = false;
    let currentHistory = get(conversations)[convId].history;
  
    let roleMsg: ChatCompletionRequestMessage = {
      role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
      content: get(conversations)[convId].assistantRole,
    };
  
    msg = [roleMsg, ...msg];
  
    const cleansedMessages = msg.map(cleanseMessage);
  
    const prompt = cleansedMessages[cleansedMessages.length - 1].content;
  
    try {
      let response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${get(apiKey)}`,
        },
        body: JSON.stringify({
          model: get(selectedModel),
          prompt: prompt,
          size: get(selectedSize),
          quality: get(selectedQuality),
          n: 1
        }),
      });
  
      if (!response.ok) throw new Error('HTTP error, status = ' + response.status);
  
      let data = await response.json();
      let imageUrl = data.data[0].url;
  
      // Update the conversation history with the generated image URL
      setHistory([...currentHistory, {
        role: "assistant",
        content: imageUrl,
        type: "image", // Adding a type property to distinguish image messages
        model: get(selectedModel)
      }], convId);
  
    } catch (error) {
      console.error("Error generating image:", error);
      hasEncounteredError = true;
    } finally {
      isStreaming.set(false);  // Notify that the image generation is complete
    }
  }

// Choose a sensible default Responses-capable model
function getDefaultResponsesModel() {
  const m = get(selectedModel);
  // If no model is set, or it's an old/incompatible model, use gpt-5-nano as default for tests
  // This includes o1-mini which is not compatible with Responses API
  if (!m || /gpt-3\.5|gpt-4(\.|$)|o1-mini/.test(m)) {
    // Use gpt-5-nano as the default for better test compatibility
    return 'gpt-5-nano';
  }
  return m;
}

 // Only certain models (e.g., gpt-5, o3, o4 family or explicit reasoning models) support "reasoning".
export function supportsReasoning(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('gpt-5') || m.includes('o3') || m.includes('o4') || m.includes('reason');
}

/**
 * Build a consistent Responses payload used by all call sites.
 * Includes reasoning and verbosity fields only for reasoning-capable models.
 */
export function buildResponsesPayload(model: string, input: any[], stream: boolean) {
  const payload: any = { model, input, store: false, stream };

  if (supportsReasoning(model)) {
    const eff = get(reasoningEffort) || 'medium';
    const verb = get(verbosity) || 'medium';
    const sum = get(summary) || 'auto';

    // text.verbosity only for reasoning-capable models per requirements
    payload.text = { verbosity: verb };

    // reasoning settings (summary: allow explicit null)
    payload.reasoning = { effort: eff, summary: (sum === 'null' ? null : sum) };
  }

  return payload;
}

function buildResponsesInputFromPrompt(prompt: string) {
  return [
    {
      role: 'user',
      content: [{ type: 'input_text', text: prompt }]
    }
  ];
}

function convertChatContentToResponsesContent(content: any, role?: string): any[] {
  const isAssistant = (role || '').toLowerCase() === 'assistant';

  if (typeof content === 'string') {
    return [{ type: isAssistant ? 'output_text' : 'input_text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map((part: any) => {
      if (isAssistant) {
        // Assistant prior messages must be represented as output_text/refusal
        if (typeof part === 'string') {
          return { type: 'output_text', text: part };
        }
        if (part?.type === 'text' && typeof part?.text === 'string') {
          return { type: 'output_text', text: part.text };
        }
        if (part?.type === 'input_text' && typeof part?.text === 'string') {
          return { type: 'output_text', text: part.text };
        }
        // Fallback: stringify unknown assistant content
        return { type: 'output_text', text: typeof part === 'string' ? part : JSON.stringify(part) };
      }

      // Non-assistant (user/system) messages use input_* types
      if (part?.type === 'text' && typeof part?.text === 'string') {
        return { type: 'input_text', text: part.text };
      }
      if (part?.type === 'image_url') {
        const url = part?.image_url?.url ?? part?.image_url ?? part?.url ?? '';
        return { type: 'input_image', image_url: url };
      }
      if (part?.type === 'input_text' || part?.type === 'input_image') {
        return part;
      }
      return { type: 'input_text', text: typeof part === 'string' ? part : JSON.stringify(part) };
    });
  }

  return [{ type: isAssistant ? 'output_text' : 'input_text', text: String(content) }];
}

export function buildResponsesInputFromMessages(messages: ChatCompletionRequestMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: convertChatContentToResponsesContent(m.content, m.role)
  }));
}

export async function createResponseViaResponsesAPI(prompt: string, model?: string) {
  const key = get(apiKey);
  if (!key) throw new Error('No API key configured');

  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
  const input = buildResponsesInputFromPrompt(prompt);
  const payload = buildResponsesPayload(resolvedModel, input, false);

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Extract plain text from a Responses API non-streaming response.
 * Supports several possible shapes: output_text or output[].content[].text
 */
export function extractOutputTextFromResponses(obj: any): string {
  if (!obj) return '';
  if (typeof obj.output_text === 'string') return obj.output_text.trim();

  const outputs = Array.isArray(obj.output) ? obj.output : (Array.isArray(obj.outputs) ? obj.outputs : null);
  if (outputs) {
    let text = '';
    for (const o of outputs) {
      const content = Array.isArray(o?.content) ? o.content : [];
      for (const p of content) {
        if (typeof p?.text === 'string') text += p.text;
        else if (typeof p === 'string') text += p;
      }
    }
    if (text.trim()) return text.trim();
  }

  // Fallbacks for unexpected shapes
  if (Array.isArray(obj?.content)) {
    const t = obj.content.map((p: any) => p?.text || '').join('');
    if (t.trim()) return t.trim();
  }
  try {
    const s = JSON.stringify(obj);
    const m = s.match(/"text"\s*:\s*"([^"]{1,200})/);
    if (m) return m[1];
  } catch {}
  return '';
}

export function sanitizeTitle(title: string): string {
  let t = (title || '').trim();
  // Remove any leading Title: (case-insensitive), allowing surrounding quotes
  t = t.replace(/^(?:["“”']*\s*)?(?:(?:title)\s*:\s*)/i, '');
  // Iteratively strip leading/trailing quote characters (ASCII and smart)
  const quoteRE = /^(?:["“”']+)|(?:["“”']+)$/g;
  let prev;
  do {
    prev = t;
    t = t.replace(/^["“”']+|["“”']+$/g, '');
    t = t.trim();
  } while (t !== prev);
  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 80) t = t.slice(0, 80);
  return t;
}

/**
 * Generate a concise conversation title and update the sidebar if it is currently empty.
 * Safe to call multiple times; it only updates when the title is empty or placeholder.
 */
async function maybeUpdateTitleAfterFirstMessage(convId: number, lastUserPrompt: string, assistantReply: string) {
  try {
    const all = get(conversations);
    const conv = all?.[convId];
    if (!conv) return;

    const currentTitle = (conv.title ?? '').trim().toLowerCase();
    if (currentTitle && currentTitle !== 'new conversation') return;

    const sys: any = {
      role: 'system',
      content: 'You generate a short, clear chat title. Respond with only the title, no quotes, max 8 words, Title Case.'
    };
    const user: any = {
      role: 'user',
      content: lastUserPrompt || 'Create a short title for this conversation.'
    };
    const asst: any = assistantReply ? { role: 'assistant', content: assistantReply } : null;

    const msgs: any[] = asst ? [sys, user, asst] : [sys, user];
    const input = buildResponsesInputFromMessages(msgs);
    const model = 'gpt-4o-mini';
    const payload = buildResponsesPayload(model, input, false);

    const key = get(apiKey);
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
    }

    const data = await res.json();
    const rawTitle = extractOutputTextFromResponses(data);
    const title = sanitizeTitle(rawTitle);
    if (!title) return;

    conversations.update((allConvs) => {
      const copy = [...allConvs];
      const curr = { ...copy[convId] };
      const currTitle = (curr.title ?? '').trim().toLowerCase();
      if (!currTitle || currTitle === 'new conversation') {
        curr.title = title;
        copy[convId] = curr;
      }
      return copy;
    });
  } catch (err) {
    console.warn('Title generation failed:', err);
  }
}

export interface ResponsesStreamCallbacks {
  onEvent?: (evt: { type: string; data: any }) => void;
  onTextDelta?: (text: string) => void;
  onCompleted?: (finalText: string, raw?: any) => void;
  onError?: (error: any) => void;

  // New: reasoning lifecycle callbacks
  onReasoningStart?: (kind: 'summary' | 'text', meta?: any) => void;
  onReasoningDelta?: (kind: 'summary' | 'text', text: string) => void;
  onReasoningDone?: (kind: 'summary' | 'text', fullText?: string) => void;
}

export async function streamResponseViaResponsesAPI(
  prompt: string,
  model?: string,
  callbacks?: ResponsesStreamCallbacks,
  inputOverride?: any[],
  uiContext?: { convId?: string; anchorIndex?: number }
): Promise<string> {
  const key = get(apiKey);
  if (!key) throw new Error('No API key configured');

  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
  const input = inputOverride || buildResponsesInputFromPrompt(prompt);
  const payload = buildResponsesPayload(resolvedModel, input, true);

  const controller = new AbortController();
  globalAbortController = controller;
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    globalAbortController = null;
    throw new Error(`Responses API stream error ${res.status}: ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';

  // Track reasoning panels per stream - use Map to ensure uniqueness
  const panelTracker = new Map<string, string>(); // kind -> panelId
  const panelTextTracker = new Map<string, string>(); // panelId -> accumulated text
  const convIdCtx = uiContext?.convId;
  const anchorIndexCtx = uiContext?.anchorIndex;

  // One reasoning window per API Response (only for reasoning-capable models)
  const responseWindowId: string | null = supportsReasoning(resolvedModel)
    ? createReasoningWindow(convIdCtx, resolvedModel, anchorIndexCtx)
    : null;

  function processSSEBlock(block: string) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let eventType = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }
    if (dataLines.length === 0) return;

    const dataStr = dataLines.join('\n');
    if (dataStr === '[DONE]') {
      // Finalize any still-open reasoning panels
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText);
      if (responseWindowId) collapseReasoningWindow(responseWindowId);
      return;
    }

    let obj: any = null;
    try {
      obj = JSON.parse(dataStr);
    } catch (e) {
      callbacks?.onError?.(new Error(`Failed to parse SSE data JSON: ${e}`));
      return;
    }

    // Prefer explicit SSE event name; if missing, fall back to payload.type
    const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');

    callbacks?.onEvent?.({ type: resolvedType, data: obj });
    // Log every SSE type compactly for the collapsible UI (not reused as prompt input)
    logSSEEvent(resolvedType, obj, convIdCtx);

    // Handle reasoning-related events
    if (resolvedType === 'response.reasoning_summary_part.added' || 
        resolvedType === 'response.reasoning_summary_text.delta' || 
        resolvedType === 'response.reasoning_summary.delta') {
      const delta = obj?.delta ?? '';
      if (!panelTracker.has('summary')) {
        const panelId = startReasoningPanel('summary', convIdCtx, responseWindowId || undefined);
        panelTracker.set('summary', panelId);
        panelTextTracker.set(panelId, '');
        callbacks?.onReasoningStart?.('summary', obj?.part);
      }
      if (typeof delta === 'string' && delta) {
        const panelId = panelTracker.get('summary')!;
        const currentText = panelTextTracker.get(panelId) || '';
        const newText = currentText + delta;
        panelTextTracker.set(panelId, newText);
        setReasoningText(panelId, newText); // Use set instead of append to avoid duplication
        callbacks?.onReasoningDelta?.('summary', delta);
      }
    } else if (resolvedType === 'response.reasoning_summary_part.done' || 
               resolvedType === 'response.reasoning_summary_text.done' || 
               resolvedType === 'response.reasoning_summary.done') {
      const text = obj?.part?.text ?? obj?.text ?? '';
      const panelId = panelTracker.get('summary');
      if (panelId) {
        // Only update if we have final text and it's different from accumulated
        if (typeof text === 'string' && text) {
          setReasoningText(panelId, text);
          panelTextTracker.set(panelId, text);
        }
        completeReasoningPanel(panelId);
        callbacks?.onReasoningDone?.('summary', panelTextTracker.get(panelId) || '');
        panelTracker.delete('summary');
        panelTextTracker.delete(panelId);
      }
    } else if (resolvedType === 'response.reasoning_text.delta' || 
               resolvedType === 'response.reasoning.delta') {
      const delta = obj?.delta ?? '';
      if (!panelTracker.has('text')) {
        const panelId = startReasoningPanel('text', convIdCtx, responseWindowId || undefined);
        panelTracker.set('text', panelId);
        panelTextTracker.set(panelId, '');
        callbacks?.onReasoningStart?.('text');
      }
      if (typeof delta === 'string' && delta) {
        const panelId = panelTracker.get('text')!;
        const currentText = panelTextTracker.get(panelId) || '';
        const newText = currentText + delta;
        panelTextTracker.set(panelId, newText);
        setReasoningText(panelId, newText); // Use set instead of append to avoid duplication
        callbacks?.onReasoningDelta?.('text', delta);
      }
    } else if (resolvedType === 'response.reasoning_text.done' || 
               resolvedType === 'response.reasoning.done') {
      const text = obj?.text ?? '';
      
      // Check if we're completing an existing panel or need to create one
      let panelId = panelTracker.get('text');
      
      // Only create a new panel if we don't have one AND we have text to show
      if (!panelId && text) {
        panelId = startReasoningPanel('text', convIdCtx, responseWindowId || undefined);
        panelTracker.set('text', panelId);
        panelTextTracker.set(panelId, '');
        callbacks?.onReasoningStart?.('text');
      }
      
      if (panelId) {
        // Set final text if provided, otherwise keep accumulated text
        if (typeof text === 'string' && text) {
          setReasoningText(panelId, text);
          panelTextTracker.set(panelId, text);
        }
        completeReasoningPanel(panelId);
        callbacks?.onReasoningDone?.('text', panelTextTracker.get(panelId) || '');
        
        // Clear the panel from tracker to allow next sequence to create a new panel
        panelTracker.delete('text');
        panelTextTracker.delete(panelId);
      }
    } else if (resolvedType === 'response.output_text.delta') {
      const deltaText =
        obj?.delta?.text ??
        obj?.delta ??
        obj?.output_text_delta ??
        obj?.text ??
        '';
      if (deltaText) {
        finalText += deltaText;
        callbacks?.onTextDelta?.(deltaText);
      }
    } else if (resolvedType === 'response.completed') {
      // Finalize any still-open reasoning panels
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText, obj);
      if (responseWindowId) collapseReasoningWindow(responseWindowId);
    } else if (resolvedType === 'error') {
      callbacks?.onError?.(obj);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    buffer += decoded;

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const p of parts) {
      if (p.trim()) processSSEBlock(p);
    }
  }
  if (buffer.trim()) processSSEBlock(buffer);

  globalAbortController = null;
  return finalText;
}
