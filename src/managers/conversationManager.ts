import type { ChatCompletionRequestMessage } from "openai";
import { get } from "svelte/store";
import { conversations, chosenConversationId, combinedTokens, createNewConversation } from "../stores/stores.js";
import { selectedModel, selectedVoice, base64Images } from '../stores/stores.js';
import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore.js';
import { addRecentModel } from '../stores/recentModelsStore.js';
import { reasoningWindows } from '../stores/reasoningStore.js';

import { sendTTSMessage, sendRegularMessage, sendVisionMessage, sendRequest, sendDalleMessage } from "../services/openaiService.js";
import { streamAnthropicMessage } from "../services/anthropicMessagingService.js";
import { isAnthropicModel } from "../services/anthropicService.js";
import { debugLog } from "../utils/debugLayerLogger.js";
let streamText = "";





export function setHistory(msg: ChatCompletionRequestMessage[], convId: number = get(chosenConversationId)): Promise<void> {
  return new Promise<void>((resolve, reject) => {
      try {
          // Get conversation string ID for debug logging
          const allConversations = get(conversations);
          const conversationUniqueId = allConversations[convId]?.id;

          debugLog.storeUpdates('setHistory_called', {
            convId,
            conversationUniqueId,
            incomingHistoryLength: msg.length,
            incomingMessages: msg.map(m => ({
              role: m.role,
              contentLength: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length,
              hasModel: !!(m as any).model
            })),
            totalConversations: allConversations.length
          }, conversationUniqueId);

          let conv = get(conversations);

          // Log before state
          debugLog.storeUpdates('conversation_state_before', {
            convId,
            conversationExists: !!conv[convId],
            currentHistoryLength: conv[convId]?.history?.length || 0,
            conversationTitle: conv[convId]?.title || '',
            conversationId: conv[convId]?.id || ''
          }, conversationUniqueId);

          conv[convId].history = msg;

          debugLog.storeUpdates('conversation_state_after', {
            convId,
            newHistoryLength: msg.length,
            conversationTitle: conv[convId]?.title || '',
            conversationId: conv[convId]?.id || '',
            lastMessage: msg.length > 0 ? {
              role: msg[msg.length - 1].role,
              contentLength: typeof msg[msg.length - 1].content === 'string'
                ? msg[msg.length - 1].content.length
                : JSON.stringify(msg[msg.length - 1].content || '').length
            } : null
          }, conversationUniqueId);

          debugLog.storeUpdates('conversations_store_set', {
            convId,
            totalConversations: conv.length,
            targetConversationHistoryLength: conv[convId].history.length,
            storeUpdateTimestamp: performance.now()
          }, conversationUniqueId);

          conversations.set(conv);

          debugLog.storeUpdates('setHistory_completed', {
            convId,
            conversationUniqueId,
            finalHistoryLength: msg.length,
            success: true
          }, conversationUniqueId);

          resolve(); // No value is being resolved here
      } catch (error) {
          debugLog.storeUpdates('setHistory_error', {
            convId,
            error: String(error),
            errorMessage: (error as any)?.message || 'Unknown error',
            messageCount: msg?.length || 0
          });

          console.error("Failed to update history", error);
          reject(error); // Propagate the error
      }
  });
}




export function deleteMessageFromConversation(messageIndex: number) {
    const currentConversationId = get(chosenConversationId);
    const currentConversations = get(conversations);
    const updatedHistory = currentConversations[currentConversationId].history.filter((_, index) => index !== messageIndex);

    currentConversations[currentConversationId].history = updatedHistory;
    conversations.set(currentConversations);
}

export function deleteAllMessagesBelow(messageIndex: number) {
  const convId = get(chosenConversationId);
  const convs = get(conversations);
  
  if (convId === null || convId === undefined || !convs[convId]) return;
  
  const currentHistory = convs[convId].history;
  const conversationUniqueId = convs[convId].id;
  
  // Keep messages from 0 to messageIndex (inclusive)
  const updatedHistory = currentHistory.slice(0, messageIndex + 1);
  
  // Update conversation history
  conversations.update(allConvs => {
    const updated = [...allConvs];
    updated[convId] = {
      ...updated[convId],
      history: updatedHistory
    };
    return updated;
  });
  
  // Clean up reasoning windows for deleted messages
  reasoningWindows.update(windows => {
    // Remove windows anchored to messages that were deleted
    return windows.filter(w => {
      // Use strict equality on string IDs; if a window has no convId, keep it
      if (!w.convId || w.convId !== conversationUniqueId) return true;
      // Keep windows anchored at or before messageIndex
      return (w.anchorIndex ?? Number.NEGATIVE_INFINITY) <= messageIndex;
    });
  });
}




export function newChat() {
    // Always create a new empty conversation and select it
    const newConversation = createNewConversation();
    conversations.update(conv => [...conv, newConversation]);
    chosenConversationId.set(get(conversations).length - 1);
}


export function cleanseMessage(msg: ChatCompletionRequestMessage | { role: string; content: any }): ChatCompletionRequestMessage {
    // Only allowing 'role' and 'content' fields, adapt this part as necessary
    const allowedProps = ['role', 'content'];
    let cleansed = Object.keys(msg)
        .filter(key => allowedProps.includes(key))
        .reduce((obj, key) => {
            obj[key] = msg[key];
            return obj;
        }, {} as any);

    // If 'content' is an array (for structured messages like images), keep it as is
    // Otherwise, ensure 'content' is a string
    if (!Array.isArray(cleansed.content)) {
        cleansed.content = cleansed.content.toString();
    }

    return cleansed as ChatCompletionRequestMessage;
}



export async function routeMessage(input: string, convId: string) {

    // Find conversation by string ID instead of using numeric index
    const allConversations = get(conversations);
    const conversationIndex = allConversations.findIndex(c => c.id === convId);
    if (conversationIndex === -1) {
        throw new Error(`Conversation with ID ${convId} not found`);
    }
    const conversation = allConversations[conversationIndex];

    let currentHistory = conversation.history;
    let messageHistory = currentHistory;
    currentHistory = [...currentHistory, { role: "user", content: input }];
    setHistory(currentHistory, conversationIndex);

    const defaultModel = 'gpt-3.5-turbo';
    const defaultVoice = 'alloy';
    // The conversation's unique string ID is now the convId parameter
    const convUniqueId = convId;
    const perConv = conversationQuickSettings.getSettings(convUniqueId);
    const model = perConv.model || get(selectedModel) || defaultModel;
    const voice = get(selectedVoice) || defaultVoice;
    
    // Add the effective model to recent models
    addRecentModel(model);

    let outgoingMessage: ChatCompletionRequestMessage[];
    outgoingMessage = [
        ...messageHistory,
        { role: "user", content: input },
      ];

    if (model.includes('tts')) {
        // The model string contains 'tts', proceed with TTS message handling
        await sendTTSMessage(input, model, voice, conversationIndex);
      } else if (model.includes('vision')) {
        const imagesBase64 = get(base64Images); // Retrieve the current array of base64 encoded images
        const config = { model, reasoningEffort: perConv.reasoningEffort, verbosity: perConv.verbosity, summary: perConv.summary };
        await sendVisionMessage(outgoingMessage, imagesBase64, conversationIndex, config);
      } else if (model.includes('dall-e')) {
        await sendDalleMessage(outgoingMessage, conversationIndex);
      } else if (isAnthropicModel(model)) {
        // Handle Claude/Anthropic models
        const config = { model };
        console.log(`Routing Claude model ${model} to Anthropic service`);
        // For now, use streaming by default for Claude models
        await streamAnthropicMessage(outgoingMessage, conversationIndex, config);
      } else {
        // Default case for regular messages if no specific keywords are found in the model string
        const config = { model, reasoningEffort: perConv.reasoningEffort, verbosity: perConv.verbosity, summary: perConv.summary };
        await sendRegularMessage(outgoingMessage, convId, config);
      }
    // Check if we need to create a title (first message or empty title)
    const updatedConversation = get(conversations)[conversationIndex];
    if (updatedConversation.history.length === 1 || updatedConversation.title === '') {
        await createTitle(input);
    }
}

function setTitle(title: string) {
    let conv = get(conversations);
    conv[get(chosenConversationId)].title = title;
    conversations.set(conv);
  }

async function createTitle(currentInput: string) {
    const titleModel = 'gpt-3.5-turbo';
    try {
        // Use Responses API pathway consistently
        const msgs: any[] = [
            { role: 'system', content: 'You generate a short, clear chat title. Respond with only the title, no quotes, max 8 words, Title Case.' },
            { role: 'user', content: currentInput }
        ];
        // Reuse helpers from openaiService via sendRequest which now posts to /responses
        const response = await sendRequest(msgs as any, titleModel);
        // Extract text using the same utility used by maybeUpdateTitleAfterFirstMessage
        const svc = await import('../services/openaiService.js');
        const raw = svc.extractOutputTextFromResponses(response);
        let title = raw?.trim() || '';
        if (!title) throw new Error('Empty title text');
        const clean = svc.sanitizeTitle(title);
        if (!clean) throw new Error('Sanitized title empty');
        setTitle(clean);
    } catch (error) {
        console.warn("Title generation: Invalid response structure", error);
        setTitle(currentInput.slice(0, 30) + (currentInput.length > 30 ? '...' : ''));
    }
}

export function displayAudioMessage(audioUrl: string) {
    const audioMessage = {
  role: "assistant",
  content: "Audio file generated.",
  audioUrl: audioUrl,
  isAudio: true,
  model: get(selectedModel)
} as ChatCompletionRequestMessage;

setHistory([...get(conversations)[get(chosenConversationId)].history, audioMessage]);
}

export function countTokens(usage: { total_tokens: number }) {
    let conv = get(conversations);
    conv[get(chosenConversationId)].conversationTokens =
      conv[get(chosenConversationId)].conversationTokens + usage.total_tokens;
    conversations.set(conv);
    combinedTokens.set(get(combinedTokens) + usage.total_tokens);
    console.log("Counted tokens: " + usage.total_tokens);
  }

 
  export function estimateTokens(msg: ChatCompletionRequestMessage[], convId: number) {
    let chars = 0;
    msg.map((m) => {
      chars += m.content.length;
    });
    chars += streamText.length;
    let tokens = chars / 4;
    let conv = get(conversations);
    conv[convId].conversationTokens =
      conv[convId].conversationTokens + tokens;
    conversations.set(conv);
    combinedTokens.set(get(combinedTokens) + tokens);
  }
