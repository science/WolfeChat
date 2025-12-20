import { get, writable } from 'svelte/store';
// ChatCompletions SDK removed; using fetch-based Responses API only
import type { ChatMessage } from "../stores/stores.js";
import {
  conversations,
  chosenConversationId,
  selectedModel,
  selectedSize,
  selectedQuality,
  defaultAssistantRole,
  isStreaming,
  userRequestedStreamClosure
} from "../stores/stores.js";
import { openaiApiKey } from "../stores/providerStore.js";
import { reasoningEffort, verbosity, summary } from "../stores/reasoningSettings.js";
import { reasoningAutoCollapse } from "../stores/reasoningAutoCollapseStore.js";
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
import { debugLog } from "../utils/debugLayerLogger.js";
import { log } from '../lib/logger.js';

// Type definitions for legacy OpenAI SDK compatibility
type ChatCompletionRequestMessage = ChatMessage;
type ChatCompletionRequestMessageRoleEnum = 'system' | 'user' | 'assistant';
type OpenAIApi = any;

// Legacy globals for backward compatibility
let openai: OpenAIApi = null;
let configuration: any = null;

// Global abort controller for streaming
let globalAbortController: AbortController | null = null;

// Helper function to append error messages to conversation history
export function appendErrorToHistory(error: any, currentHistory: ChatCompletionRequestMessage[], convId: number): void {
  const errorMessage = error?.message || 'An error occurred while processing your request.';
  const userFriendlyError = errorMessage.includes('API key')
    ? 'There was an error. Maybe the API key is wrong? Or the servers could be down?'
    : `There was an error: ${errorMessage}`;

  const errorChatMessage: ChatCompletionRequestMessage = {
    role: "assistant",
    content: userFriendlyError,
  };

  setHistory([...currentHistory, errorChatMessage], convId);
}

// Gracefully stop an in-flight streaming response (works for both OpenAI and Anthropic)
export function closeStream() {
  try {
    // Set closure flags for both providers
    userRequestedStreamClosure.set(true);

    // Try to abort OpenAI stream
    const ctrl = globalAbortController;
    if (ctrl) {
      ctrl.abort();
    }

    // Also try to close Anthropic stream
    import('./anthropicMessagingService.js').then(({ closeAnthropicStream }) => {
      closeAnthropicStream();
    }).catch(() => {
      // Ignore if module fails to load (not using Anthropic)
    });
  } catch (e) {
    log.warn('closeStream abort failed:', e);
  } finally {
    globalAbortController = null;
    isStreaming.set(false);
  }
}


// Streaming state management
// NOTE: isStreaming and userRequestedStreamClosure are now imported from stores.ts
export const streamContext = writable<{ streamText: string; convId: number | null }>({ streamText: '', convId: null });

// ChatCompletions SDK removed; using fetch-based Responses API only
const errorMessage: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "There was an error. Maybe the API key is wrong? Or the servers could be down?",
  },
];

// Legacy functions removed - using Responses API only

export function isConfigured(): boolean {
  log.debug("Checking if OpenAI API is configured.");
  return get(openaiApiKey) !== null;
}

export function reloadConfig(): void {
  // No-op: using direct fetch calls now 
  log.debug("Configuration reloaded.");
}

export async function sendRequest(msg: ChatCompletionRequestMessage[], model: string = get(selectedModel), opts?: { reasoningEffort?: string; verbosity?: string; summary?: string }): Promise<any> {
  try {
    msg = [
      {
        role: "system",
        content: get(conversations)[get(chosenConversationId)].assistantRole,
      },
      ...msg,
    ];

    const key = get(openaiApiKey);
  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
    const input = buildResponsesInputFromMessages(msg);
    const payload = buildResponsesPayload(resolvedModel, input, false, opts);

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
    log.error("Error in sendRequest:", error);
    configuration = null;

    // Get the current conversation history and ID to preserve existing messages
    const currentHistory = get(conversations)[get(chosenConversationId)]?.history || [];
    const convId = get(chosenConversationId);

    // Append error to existing history instead of replacing it
    appendErrorToHistory(error, currentHistory, convId);

    throw error;
  }
}

function parseJSONChunks(rawData) {
  try {
    // First, let's log the raw data to see what we're getting
    log.debug('Raw SSE data:', rawData);
    
    // Handle the case where data might be a single JSON object
    if (rawData.trim().startsWith('{') && rawData.trim().endsWith('}')) {
      try {
        return [JSON.parse(rawData)];
      } catch (e) {
        log.error('Failed to parse single JSON object:', e);
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
          log.error('Failed to parse JSON chunk:', chunk, e);
          return null;
        }
      }).filter(Boolean);
    }
    
    // If no matches found, try to parse as a single object
    try {
      const parsed = JSON.parse(rawData);
      return [parsed];
    } catch (e) {
      log.error('Failed to parse raw data as JSON:', e);
      return [];
    }
  } catch (error) {
    log.error("Error parsing JSON chunk:", error);
    log.error("Raw data was:", rawData);
    return [];
  }
}

export async function sendTTSMessage(text: string, model: string, voice: string, conversationId: number) {
  log.debug("Sending TTS message.");

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
log.debug('Audio blob saved to IndexedDB with ID:', uniqueID);
}).catch(log.error);

getAudioBlob(uniqueID).then(blob => {  
log.debug(uniqueID);
log.debug(blob);
if (blob instanceof Blob) {
  if (blob) {
const audioUrl = URL.createObjectURL(blob);
displayAudioMessage(audioUrl);
} else {
log.error('Blob is null or undefined');
}

} else {
  log.error('Retrieved object is not a Blob:', blob);
}
}).catch(error => log.error('Error retrieving audio blob:', error));



  } catch (error) {
    log.error("TTS request error:", error);
  }

}

export async function sendVisionMessage(
  msg: ChatCompletionRequestMessage[],
  imagesBase64: string[],
  convId: number,
  config: { model: string; reasoningEffort?: string; verbosity?: string; summary?: string }
) {
  log.debug("Sending vision message.");
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
    const resolvedModel = (config.model || get(selectedModel));
    await streamResponseViaResponsesAPI(
      '',
      resolvedModel,
      {
        onTextDelta: (text) => {
          debugLog.messageAssembly('vision_text_delta_received', {
            deltaText: text,
            deltaLength: text.length,
            currentStreamLength: streamText.length,
            convId,
            resolvedModel
          }, conversationUniqueId);

          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) { ticks = !ticks; tickCounter = 0; }
          streamText += text;
          streamContext.set({ streamText, convId });

          debugLog.messageAssembly('vision_assistant_message_creating', {
            messageContent: streamText + "█" + (ticks ? "\n```" : ""),
            contentLength: streamText.length,
            convId,
            historyLength: currentHistory.length
          }, conversationUniqueId);

          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText + "█" + (ticks ? "\n```" : ""),
                model: resolvedModel,
              },
            ],
            convId
          );

          debugLog.messageAssembly('vision_setHistory_called_streaming', {
            convId,
            newHistoryLength: currentHistory.length + 1,
            assistantContent: streamText + "█" + (ticks ? "\n```" : ""),
            model: resolvedModel
          }, conversationUniqueId);
        },
        onCompleted: async () => {
          debugLog.messageAssembly('vision_stream_completed', {
            streamText,
            convId,
            userRequestedClosure: get(userRequestedStreamClosure)
          }, conversationUniqueId);

          if (get(userRequestedStreamClosure)) {
            streamText = streamText.replace(/█+$/, '');
            userRequestedStreamClosure.set(false);
          }

          debugLog.messageAssembly('vision_final_assistant_message_creating', {
            finalContent: streamText,
            contentLength: streamText.length,
            convId,
            historyLength: currentHistory.length,
            model: resolvedModel
          }, conversationUniqueId);

          await setHistory(
            [
              ...currentHistory,
              { role: "assistant", content: streamText, model: resolvedModel },
            ],
            convId
          );

          debugLog.messageAssembly('vision_setHistory_called_final', {
            convId,
            newHistoryLength: currentHistory.length + 1,
            finalContent: streamText,
            model: resolvedModel
          }, conversationUniqueId);

          estimateTokens(msg, convId);
          streamText = "";
          isStreaming.set(false);
          onSendVisionMessageComplete();
        },
        onError: (err) => {
          appendErrorToHistory(err, currentHistory, convId);
          isStreaming.set(false);
          onSendVisionMessageComplete();
        },
      },
      finalInput,
      { convId: conversationUniqueId, anchorIndex },
      { reasoningEffort: config.reasoningEffort, verbosity: config.verbosity, summary: config.summary }
    );
  } catch (error) {
    // Handle errors from streamResponseViaResponsesAPI itself
    log.error("Error in sendVisionMessage:", error);
    appendErrorToHistory(error, currentHistory, convId);
    onSendVisionMessageComplete();
  } finally {
    isStreaming.set(false);
  }
}

  export async function sendRegularMessage(
  msg: ChatCompletionRequestMessage[],
  convId: string,
  config: { model: string; reasoningEffort?: string; verbosity?: string; summary?: string }
) {
  userRequestedStreamClosure.set(false);
  let tickCounter = 0;
  let ticks = false;

  // Find conversation by string ID instead of using numeric index
  const allConversations = get(conversations);

  debugLog.messageAssembly('conversation_lookup_start', {
    convId,
    totalConversations: allConversations.length,
    conversationIds: allConversations.map(c => c.id)
  }, convId);

  const conversationIndex = allConversations.findIndex(c => c.id === convId);
  if (conversationIndex === -1) {
    debugLog.messageAssembly('conversation_lookup_failed', {
      convId,
      availableIds: allConversations.map(c => c.id)
    }, convId);
    throw new Error(`Conversation with ID ${convId} not found`);
  }

  debugLog.messageAssembly('conversation_lookup_success', {
    convId,
    conversationIndex,
    conversationTitle: allConversations[conversationIndex].title
  }, convId);

  const conversation = allConversations[conversationIndex];

  let currentHistory = conversation.history;
  const anchorIndex = currentHistory.length - 1;
  // The conversation's unique string ID is now the convId parameter
  const conversationUniqueId = convId;

  let roleMsg: ChatCompletionRequestMessage = {
    role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
    content: conversation.assistantRole,
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
    const resolvedModel = (config.model || get(selectedModel));
    await streamResponseViaResponsesAPI(
      '',
      resolvedModel,
      {
        onTextDelta: (text) => {
          debugLog.messageAssembly('text_delta_received', {
            deltaText: text,
            deltaLength: text.length,
            currentStreamLength: streamText.length,
            conversationIndex,
            resolvedModel
          }, conversationUniqueId);

          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) {
            ticks = !ticks;
            tickCounter = 0;
          }
          streamText += text;
          streamContext.set({ streamText, convId });

          debugLog.messageAssembly('assistant_message_creating', {
            messageContent: streamText + "█" + (ticks ? "\n```" : ""),
            contentLength: streamText.length,
            conversationIndex,
            historyLength: currentHistory.length
          }, conversationUniqueId);

          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText + "█" + (ticks ? "\n```" : ""),
                model: resolvedModel,
              },
            ],
            conversationIndex
          );

          debugLog.messageAssembly('setHistory_called_streaming', {
            conversationIndex,
            newHistoryLength: currentHistory.length + 1,
            assistantContent: streamText + "█" + (ticks ? "\n```" : ""),
            model: resolvedModel
          }, conversationUniqueId);
        },
        onCompleted: async (_finalText) => {
          debugLog.messageAssembly('stream_completed', {
            finalText: _finalText,
            streamText,
            conversationIndex,
            userRequestedClosure: get(userRequestedStreamClosure)
          }, conversationUniqueId);

          if (get(userRequestedStreamClosure)) {
            streamText = streamText.replace(/█+$/, '');
            userRequestedStreamClosure.set(false);
          }

          debugLog.messageAssembly('final_assistant_message_creating', {
            finalContent: streamText,
            contentLength: streamText.length,
            conversationIndex,
            historyLength: currentHistory.length,
            model: resolvedModel
          }, conversationUniqueId);

          await setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText,
                model: resolvedModel,
              },
            ],
            conversationIndex
          );

          debugLog.messageAssembly('setHistory_called_final', {
            conversationIndex,
            newHistoryLength: currentHistory.length + 1,
            finalContent: streamText,
            model: resolvedModel
          }, conversationUniqueId);

          estimateTokens(msg, conversationIndex);

          // Trigger title generation for brand-new conversations
          await maybeUpdateTitleAfterFirstMessage(conversationIndex, lastUserPromptText, streamText);

          streamText = "";
          isStreaming.set(false);
        },
        onError: (err) => {
          appendErrorToHistory(err, currentHistory, conversationIndex);
          isStreaming.set(false);
        },
      },
      input,
      { convId: conversationUniqueId, anchorIndex },
      { reasoningEffort: config.reasoningEffort, verbosity: config.verbosity, summary: config.summary }
    );
  } catch (error) {
    // Handle errors from streamResponseViaResponsesAPI itself
    log.error("Error in sendRegularMessage:", error);
    appendErrorToHistory(error, currentHistory, conversationIndex);
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
          Authorization: `Bearer ${get(openaiApiKey)}`
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
      log.error("Error generating image:", error);
      hasEncounteredError = true;
    } finally {
      isStreaming.set(false);  // Notify that the image generation is complete
    }
  }

// Choose a sensible default Responses-capable model
function getDefaultResponsesModel() {
  const m = get(selectedModel);
  // If no model is set, or it's an old/incompatible model, use gpt-5-nano as default for tests
  // This includes older models which are not compatible with Responses API
  if (!m || /gpt-3\.5|gpt-4(\.|$)/.test(m)) {
    // Use gpt-5-nano as the default for better test compatibility
    return 'gpt-5-nano';
  }
  return m;
}

 // Only certain models (e.g., gpt-5, o1, o3, o4 family or explicit reasoning models) support "reasoning".
export function supportsReasoning(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('gpt-5') || m.includes('o1-') || m.includes('o3') || m.includes('o4') || m.includes('reason');
}

/**
 * Check if a model is gpt-5.1 (which has different reasoning options than other reasoning models)
 */
export function isGpt51(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('gpt-5.1');
}

/**
 * Build a consistent Responses payload used by all call sites.
 * Includes reasoning and verbosity fields only for reasoning-capable models.
 * When reasoningEffort is 'none', the reasoning field is omitted while text.verbosity is still included.
 * GPT-5.1 doesn't support "minimal" reasoning - falls back to "low".
 */
export function buildResponsesPayload(model: string, input: any[], stream: boolean, opts?: { reasoningEffort?: string; verbosity?: string; summary?: string }) {
  const payload: any = { model, input, store: false, stream };

  if (supportsReasoning(model)) {
    let eff = (opts?.reasoningEffort ?? get(reasoningEffort)) || 'medium';
    const verb = (opts?.verbosity ?? get(verbosity)) || 'medium';
    const sum = (opts?.summary ?? get(summary)) || 'auto';

    // GPT-5.1 doesn't support "minimal" reasoning, fall back to "low"
    if (isGpt51(model) && eff === 'minimal') {
      eff = 'low';
    }

    // text.verbosity only for reasoning-capable models per requirements
    payload.text = { verbosity: verb };

    // reasoning settings (summary: allow explicit null)
    // When effort is 'none', don't include the reasoning field at all
    if (eff !== 'none') {
      payload.reasoning = { effort: eff, summary: (sum === 'null' ? null : sum) };
    }
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

export async function createResponseViaResponsesAPI(prompt: string, model?: string, opts?: { reasoningEffort?: string; verbosity?: string; summary?: string }) {
  const key = get(openaiApiKey);
  if (!key) throw new Error('No API key configured');

  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
  const input = buildResponsesInputFromPrompt(prompt);
  const payload = buildResponsesPayload(resolvedModel, input, false, opts);

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
    const model = 'gpt-3.5-turbo';
    const payload = buildResponsesPayload(model, input, false);

    const key = get(openaiApiKey);
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Defensive check: ensure res is a proper Response object
    if (!res || typeof res.json !== 'function') {
      log.warn('Title generation: Invalid response object received from fetch');
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
    }

    const data = await res.json();
    const rawTitle = extractOutputTextFromResponses(data);
    const title = sanitizeTitle(rawTitle);
    if (!title) {
      log.warn('Title generation: Invalid response structure - no title text extracted from:', data);
      return;
    }

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
    log.warn('Title generation failed:', err);
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
  uiContext?: { convId?: string; anchorIndex?: number },
  opts?: { reasoningEffort?: string; verbosity?: string; summary?: string }
): Promise<string> {
  const key = get(openaiApiKey);
  if (!key) throw new Error('No API key configured');

  // Capture auto-collapse setting at start of stream (so it's consistent for entire response)
  const shouldAutoCollapse = get(reasoningAutoCollapse);

  const liveSelected = get(selectedModel);
  const resolvedModel = (model && typeof model === 'string' ? model : (liveSelected || getDefaultResponsesModel()));
  const input = inputOverride || buildResponsesInputFromPrompt(prompt);
  const payload = buildResponsesPayload(resolvedModel, input, true, opts);

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

  // Lazy reasoning window creation - only create when reasoning events arrive
  let responseWindowId: string | null = null;

  // Set up structured SSE logging if debug session is active
  let apiCallLog: any = null;
  try {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const sessionId = win?.__SSE_DEBUG_SESSION;
    log.debug('[SSE-DEBUG-CHECK] Session ID:', sessionId, 'Available:', !!win?.__SSE_LOGS?.[sessionId]);
    if (sessionId && win.__SSE_LOGS?.[sessionId]) {
      apiCallLog = {
        callId: `call-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        request: {
          url: 'https://api.openai.com/v1/responses',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, // Sanitized headers
          body: payload
        },
        response: {
          status: res.status,
          headers: { 'content-type': res.headers.get('content-type') || '' },
          streamEvents: [],
          summary: {
            totalChunks: 0,
            reasoningEvents: 0,
            outputEvents: 0,
            parseErrors: 0
          }
        }
      };
      win.__SSE_LOGS[sessionId].apiCalls.push(apiCallLog);
      log.debug(`[SSE-DEBUG] Started logging API call: ${apiCallLog.callId}`);
    }
  } catch (e) {
    log.warn('[SSE-DEBUG] Failed to set up logging:', e);
  }

  let completedEmitted = false;

  // Helper function to ensure reasoning window is created when first reasoning event arrives
  function ensureReasoningWindow(): string | null {
    if (!responseWindowId && supportsReasoning(resolvedModel)) {
      responseWindowId = createReasoningWindow(convIdCtx, resolvedModel, anchorIndexCtx);
    }
    return responseWindowId;
  }

  function processSSEBlock(block: string) {
    debugLog.sseParser('sse_block_received', {
      blockLength: block.length,
      blockSnippet: block.slice(0, 100)
    }, convIdCtx);

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
    if (dataLines.length === 0) {
      debugLog.sseParser('sse_block_empty_data', { eventType }, convIdCtx);
      return;
    }

    const dataStr = dataLines.join('\n');
    if (dataStr === '[DONE]') {
      debugLog.sseParser('sse_stream_done', {
        finalTextLength: finalText.length,
        activePanels: panelTracker.size
      }, convIdCtx);

      // Finalize any still-open reasoning panels
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText);
      completedEmitted = true;
      if (responseWindowId && shouldAutoCollapse) collapseReasoningWindow(responseWindowId);
      return;
    }

    let obj: any = null;
    try {
      obj = JSON.parse(dataStr);
      debugLog.sseParser('sse_json_parsed', {
        eventType,
        hasId: !!obj?.id,
        hasChoices: !!obj?.choices,
        objType: obj?.type
      }, convIdCtx);
    } catch (e) {
      debugLog.sseParser('sse_json_parse_error', {
        eventType,
        dataSnippet: dataStr.slice(0, 100),
        error: String(e)
      }, convIdCtx);

      log.warn('[SSE] Failed to parse SSE JSON block', { blockSnippet: (dataStr || '').slice(0, 200), error: String(e) });
      callbacks?.onError?.(new Error(`Failed to parse SSE data JSON: ${e}`));
      // Also emit synthetic completion to avoid hangs
      if (!completedEmitted) {
        for (const [kind, panelId] of panelTracker.entries()) {
          completeReasoningPanel(panelId);
          panelTextTracker.delete(panelId);
        }
        panelTracker.clear();
        panelTextTracker.clear();
        callbacks?.onCompleted?.(finalText, { type: 'parse_error', synthetic: true });
        completedEmitted = true;
        if (responseWindowId && shouldAutoCollapse) collapseReasoningWindow(responseWindowId);
      }
      return;
    }

    // Prefer explicit SSE event name; if missing, fall back to payload.type
    const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');

    debugLog.sseParser('sse_event_resolved', {
      rawEventType: eventType,
      resolvedType,
      hasData: !!obj
    }, convIdCtx);

    callbacks?.onEvent?.({ type: resolvedType, data: obj });
    // Log every SSE type compactly for the collapsible UI (not reused as prompt input)
    logSSEEvent(resolvedType, obj, convIdCtx);

    // Log parsed event if SSE debugging is active
    if (apiCallLog && apiCallLog.response.streamEvents.length > 0) {
      // Find the most recent event that doesn't have parsed data yet
      for (let i = apiCallLog.response.streamEvents.length - 1; i >= 0; i--) {
        const eventLog = apiCallLog.response.streamEvents[i];
        if (eventLog.parsed === null && eventLog.rawChunk.includes('data:')) {
          eventLog.parsed = { type: resolvedType, data: obj };

          // Track event types
          if (resolvedType.includes('reasoning')) {
            apiCallLog.response.summary.reasoningEvents++;
          } else if (resolvedType.includes('output_text')) {
            apiCallLog.response.summary.outputEvents++;
          }
          break;
        }
      }
    }

    // Handle reasoning-related events
    if (resolvedType === 'response.reasoning_summary_part.added' ||
        resolvedType === 'response.reasoning_summary_text.delta' ||
        resolvedType === 'response.reasoning_summary.delta') {
      const delta = obj?.delta ?? '';
      if (!panelTracker.has('summary')) {
        // Create reasoning window lazily on first reasoning event
        const windowId = ensureReasoningWindow();
        const panelId = startReasoningPanel('summary', convIdCtx, windowId || undefined);
        panelTracker.set('summary', panelId);
        panelTextTracker.set(panelId, '');
        callbacks?.onReasoningStart?.('summary', obj?.part);

        // Mark that reasoning store received this event
        if (apiCallLog) {
          const recentEvent = apiCallLog.response.streamEvents.find((e: any) =>
            e.parsed?.type === resolvedType && !e.reasoningStoreReceived
          );
          if (recentEvent) {
            recentEvent.reasoningStoreReceived = true;
          }
        }
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
        // Create reasoning window lazily on first reasoning event
        const windowId = ensureReasoningWindow();
        const panelId = startReasoningPanel('text', convIdCtx, windowId || undefined);
        panelTracker.set('text', panelId);
        panelTextTracker.set(panelId, '');
        callbacks?.onReasoningStart?.('text');

        // Mark that reasoning store received this event
        if (apiCallLog) {
          const recentEvent = apiCallLog.response.streamEvents.find((e: any) =>
            e.parsed?.type === resolvedType && !e.reasoningStoreReceived
          );
          if (recentEvent) {
            recentEvent.reasoningStoreReceived = true;
          }
        }
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
        // Create reasoning window lazily on first reasoning event
        const windowId = ensureReasoningWindow();
        panelId = startReasoningPanel('text', convIdCtx, windowId || undefined);
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
      // Count tokens from the completion event
      if (obj?.usage?.total_tokens) {
        countTokens(obj.usage);
      }

      // Finalize any still-open reasoning panels
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText, obj);
      completedEmitted = true;
      if (responseWindowId && shouldAutoCollapse) collapseReasoningWindow(responseWindowId);
    } else if (resolvedType === 'error') {
      log.warn('[SSE] error event received from stream', obj);
      callbacks?.onError?.(obj);
      if (!completedEmitted) {
        // Emit synthetic completion to unblock waits
        log.warn('[SSE] emitting synthetic completion after error');
        // Finalize panels
        for (const [k, panelId] of panelTracker.entries()) {
          completeReasoningPanel(panelId);
          panelTextTracker.delete(panelId);
        }
        panelTracker.clear();
        panelTextTracker.clear();
        callbacks?.onCompleted?.(finalText, { type: 'error', synthetic: true, error: obj });
        completedEmitted = true;
        if (responseWindowId && shouldAutoCollapse) collapseReasoningWindow(responseWindowId);
      }
    }
  }

  try {
    while (true) {
      // Check if user requested stream closure
      if (get(userRequestedStreamClosure)) {
        log.debug('[SSE] User requested stream closure, stopping reader loop');
        debugLog.sseParser('stream_user_aborted', {
          partialTextLength: finalText.length
        }, convIdCtx);
        break;
      }

      const { value, done } = await reader.read();
      if (done) {
        debugLog.sseParser('stream_reader_done', {
          totalChunksProcessed: buffer.length
        }, convIdCtx);
        break;
      }
      const decoded = decoder.decode(value, { stream: true });

      debugLog.sseParser('raw_chunk_received', {
        chunkLength: decoded.length,
        chunkSnippet: decoded.slice(0, 50)
      }, convIdCtx);

      // Log raw chunk if SSE debugging is active
      if (apiCallLog) {
        apiCallLog.response.summary.totalChunks++;
        const eventLog = {
          timestamp: new Date().toISOString(),
          rawChunk: decoded,
          parsed: null,
          reasoningStoreReceived: false
        };
        apiCallLog.response.streamEvents.push(eventLog);
      }

      buffer += decoded;

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const p of parts) {
        if (p.trim()) processSSEBlock(p);
      }
    }
    if (buffer.trim()) processSSEBlock(buffer);
  } catch (err) {
    // Handle abort errors gracefully
    if (err.name === 'AbortError' || get(userRequestedStreamClosure)) {
      log.debug('[SSE] Stream aborted by user or fetch abort');
      debugLog.sseParser('stream_aborted', {
        errorName: err.name,
        partialTextLength: finalText.length
      }, convIdCtx);
    } else {
      // Re-throw unexpected errors
      log.error('[SSE] Unexpected error during stream reading:', err);
      throw err;
    }
  }

  // If the stream ended without explicit completion, emit a synthetic completion
  if (!completedEmitted) {
    const wasAborted = get(userRequestedStreamClosure);
    log.warn('[SSE] Stream ended without response.completed or [DONE]. Emitting synthetic completion.', {
      model: resolvedModel,
      payloadShape: Object.keys(payload || {}),
      partialFinalTextLen: finalText.length,
      userAborted: wasAborted
    });
    // finalize any panels and collapse window
    for (const [kind, panelId] of panelTracker.entries()) {
      completeReasoningPanel(panelId);
      panelTextTracker.delete(panelId);
    }
    panelTracker.clear();
    panelTextTracker.clear();
    callbacks?.onCompleted?.(finalText, {
      type: 'response.completed',
      synthetic: true,
      reason: wasAborted ? 'user_aborted' : 'eof_without_terminal_event'
    });
    completedEmitted = true;
    if (responseWindowId && shouldAutoCollapse) collapseReasoningWindow(responseWindowId);
  }

  globalAbortController = null;
  return finalText;
}
