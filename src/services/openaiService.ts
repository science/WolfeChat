import { get, writable } from 'svelte/store';
import { Configuration, OpenAIApi } from "openai";
import type { ChatCompletionRequestMessage,  } from "openai";
import type  { ChatCompletionRequestMessageRoleEnum } from "openai";
import { apiKey} from "../stores/stores";
import { selectedModel, selectedVoice, audioUrls, selectedSize, selectedQuality, defaultAssistantRole, isStreaming, streamContext } from '../stores/stores';
import { conversations, chosenConversationId, combinedTokens, userRequestedStreamClosure } from "../stores/stores";
import { setHistory, countTokens, estimateTokens, displayAudioMessage, cleanseMessage } from '../managers/conversationManager';
import { countTicks } from '../utils/generalUtils';
import { saveAudioBlob, getAudioBlob } from '../idb';
import { onSendVisionMessageComplete } from '../managers/imageManager';

let configuration: Configuration | null = null;
let openai: OpenAIApi | null = null;
let globalAbortController: AbortController | null = null;



export const closeStream = async () => {
  if (globalAbortController) {
    try { globalAbortController.abort(); } catch {}
    globalAbortController = null;
  }
  console.log("Stream closed by user.");
  isStreaming.set(false);

  const { streamText, convId } = get(streamContext);
  if (streamText && convId !== null) {
    const cleanText = streamText.replace(/█+$/, '');
    const currentHistory = get(conversations)[convId].history;
    const lastEntry = currentHistory.length ? currentHistory[currentHistory.length - 1] : null;

    if (lastEntry && typeof lastEntry.content === 'string' && lastEntry.content.endsWith("█")) {
      currentHistory[currentHistory.length - 1] = { ...lastEntry, content: cleanText };
    } else {
      currentHistory.push({ role: "assistant", content: cleanText });
    }
    await setHistory(currentHistory, convId);
    streamContext.set({ streamText: '', convId: null });
  }

  userRequestedStreamClosure.set(true);
  onSendVisionMessageComplete();
};
  
const errorMessage: ChatCompletionRequestMessage[] = [
  {
    role: "assistant",
    content:
      "There was an error. Maybe the API key is wrong? Or the servers could be down?",
  },
];

export function initOpenAIApi(): void {
  const key = get(apiKey);
  if (key) {
    configuration = new Configuration({ apiKey: key });
    openai = new OpenAIApi(configuration);
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
    const resolvedModel = model || getDefaultResponsesModel();
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

  const historyMessages = currentHistory.map((historyItem) => ({
    role: historyItem.role,
    content: convertChatContentToResponsesContent(historyItem.content),
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
      get(selectedModel),
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
              { role: "assistant", content: streamText },
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
      finalInput
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
  
  let roleMsg: ChatCompletionRequestMessage = {
    role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
    content: get(conversations)[convId].assistantRole,
  };
  
  msg = [roleMsg, ...msg];
  const cleansedMessages = msg.map(cleanseMessage);
  const input = buildResponsesInputFromMessages(cleansedMessages);

  let streamText = "";
  currentHistory = [...currentHistory];
  isStreaming.set(true);

  try {
    await streamResponseViaResponsesAPI(
      '',
      get(selectedModel),
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
              },
            ],
            convId
          );
          estimateTokens(msg, convId);
          streamText = "";
          isStreaming.set(false);
        },
        onError: (_err) => {
          isStreaming.set(false);
        },
      },
      input
    );
  } finally {
    isStreaming.set(false);
  }
}

  export async function sendPDFMessage(msg: ChatCompletionRequestMessage[], convId, pdfOutput) {
  userRequestedStreamClosure.set(false);

  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get(conversations)[convId].history;
  
  let roleMsg: ChatCompletionRequestMessage = {
    role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
    content: get(conversations)[convId].assistantRole,
  };

  let systemMessage: ChatCompletionRequestMessage = {
    role: 'system',
    content: pdfOutput,
  };

  const chatMessages = [roleMsg, systemMessage, ...msg].map(cleanseMessage);
  const input = buildResponsesInputFromMessages(chatMessages);

  let streamText = "";
  currentHistory = [...currentHistory];
  isStreaming.set(true);

  try {
    await streamResponseViaResponsesAPI(
      '',
      get(selectedModel),
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
              { role: "assistant", content: streamText },
            ],
            convId
          );
          estimateTokens(msg, convId);
          streamText = "";
          isStreaming.set(false);
        },
        onError: (_err) => {
          isStreaming.set(false);
        },
      },
      input
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
        type: "image" // Adding a type property to distinguish image messages
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
  if (!m || /gpt-3\.5|gpt-4-turbo-preview|gpt-4-32k|gpt-4$/.test(m)) {
    return 'gpt-4o-mini';
  }
  return m;
}

// Only certain models (e.g., o3, o4 family or explicit reasoning models) support "reasoning".
function supportsReasoning(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('o3') || m.includes('o4') || m.includes('reason');
}

// Build a consistent Responses payload used by all call sites.
// This ensures identical code paths between live chat and debug tests.
function buildResponsesPayload(model: string, input: any[], stream: boolean) {
  const payload: any = { model, input, store: false, stream };
  if (supportsReasoning(model)) {
    payload.reasoning = { effort: 'medium' };
  }
  // "text" tool is widely supported for text outputs; keep enabled.
  payload.text = { verbosity: 'medium' };
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

function convertChatContentToResponsesContent(content: any): any[] {
  if (typeof content === 'string') {
    return [{ type: 'input_text', text: content }];
  }
  if (Array.isArray(content)) {
    return content.map((part: any) => {
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
  return [{ type: 'input_text', text: String(content) }];
}

function buildResponsesInputFromMessages(messages: ChatCompletionRequestMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: convertChatContentToResponsesContent(m.content)
  }));
}

export async function createResponseViaResponsesAPI(prompt: string, model?: string) {
  const key = get(apiKey);
  if (!key) throw new Error('No API key configured');

  const resolvedModel = model || getDefaultResponsesModel();
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

export interface ResponsesStreamCallbacks {
  onEvent?: (evt: { type: string; data: any }) => void;
  onTextDelta?: (text: string) => void;
  onCompleted?: (finalText: string, raw?: any) => void;
  onError?: (error: any) => void;
}

export async function streamResponseViaResponsesAPI(
  prompt: string,
  model?: string,
  callbacks?: ResponsesStreamCallbacks,
  inputOverride?: any[]
): Promise<string> {
  const key = get(apiKey);
  if (!key) throw new Error('No API key configured');

  const resolvedModel = model || getDefaultResponsesModel();
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
      callbacks?.onCompleted?.(finalText);
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

    if (resolvedType === 'response.output_text.delta') {
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
      callbacks?.onCompleted?.(finalText, obj);
    } else if (resolvedType === 'error') {
      callbacks?.onError?.(obj);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

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
  
  
  
  
