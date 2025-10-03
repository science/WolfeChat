import type { ChatCompletionRequestMessage } from "openai";
import { get } from "svelte/store";
import { conversations, chosenConversationId, combinedTokens, createNewConversation } from "../stores/stores.js";
import { selectedModel, selectedVoice, base64Images } from '../stores/stores.js';
import { conversationQuickSettings } from '../stores/conversationQuickSettingsStore.js';
import { addRecentModel } from '../stores/recentModelsStore.js';
import { reasoningWindows, reasoningPanels } from '../stores/reasoningStore.js';

import { sendTTSMessage, sendRegularMessage, sendVisionMessage, sendRequest, sendDalleMessage } from "../services/openaiService.js";
import { streamAnthropicMessage } from "../services/anthropicMessagingService.js";
import { isAnthropicModel } from "../services/anthropicService.js";
import { openaiApiKey, anthropicApiKey } from "../stores/providerStore.js";
import { createAnthropicClient } from "../services/anthropicClientFactory.js";
import { debugLog } from "../utils/debugLayerLogger.js";
import { log } from '../lib/logger.js';
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

          log.error("Failed to update history", error);
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
  
  // Clean up reasoning windows and panels for deleted messages
  // First, collect the IDs of windows that will be deleted
  const deletedWindowIds = new Set<string>();
  reasoningWindows.update(windows => {
    // Identify windows that will be deleted
    const remainingWindows = windows.filter(w => {
      // Use strict equality on string IDs; if a window has no convId, keep it
      if (!w.convId || w.convId !== conversationUniqueId) return true;

      // Reasoning windows are anchored to the USER message that triggered the assistant response
      // If anchorIndex > messageIndex: window is for a message we're deleting
      // If anchorIndex < messageIndex: window is for a message we're keeping
      // If anchorIndex == messageIndex: window is for the assistant response AFTER messageIndex
      //   Since we're deleting all messages after messageIndex, the assistant response doesn't exist
      const shouldKeep = (w.anchorIndex ?? Number.NEGATIVE_INFINITY) < messageIndex;
      if (!shouldKeep) {
        deletedWindowIds.add(w.id);
      }
      return shouldKeep;
    });
    return remainingWindows;
  });

  // Remove panels whose responseId matches deleted windows
  reasoningPanels.update(panels => {
    return panels.filter(p => {
      // Keep panels from other conversations
      if (!p.convId || p.convId !== conversationUniqueId) return true;
      // Remove panels linked to deleted windows
      return !p.responseId || !deletedWindowIds.has(p.responseId);
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

    // Check if we need to create a title BEFORE sending message (when history is still original length)
    const needsTitle = currentHistory.length === 0 || conversation.title === '';

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

    // Fire title generation async BEFORE main message if needed
    let titlePromise: Promise<void> | null = null;
    if (needsTitle) {
        titlePromise = createTitle(input, conversationIndex);
        // Small delay to ensure title request is initiated before main message
        await new Promise(resolve => setTimeout(resolve, 0));
    }

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
        // Add system message for Anthropic (SDK will extract it separately)
        const systemMessage: ChatCompletionRequestMessage = {
          role: "system",
          content: conversation.assistantRole
        };
        const anthropicMessages = [systemMessage, ...outgoingMessage];
        const config = { model };
        log.debug(`Routing Claude model ${model} to Anthropic service`);
        // For now, use streaming by default for Claude models
        await streamAnthropicMessage(anthropicMessages, conversationIndex, config);
      } else {
        // Default case for regular messages if no specific keywords are found in the model string
        const config = { model, reasoningEffort: perConv.reasoningEffort, verbosity: perConv.verbosity, summary: perConv.summary };
        await sendRegularMessage(outgoingMessage, convId, config);
      }
}

function setTitle(title: string, convId: number) {
    let conv = get(conversations);
    conv[convId].title = title;
    conversations.set(conv);
  }

async function createTitle(currentInput: string, convId: number) {
    const openaiKey = get(openaiApiKey);
    const anthropicKey = get(anthropicApiKey);

    try {
        // Prefer OpenAI for title generation, fall back to Anthropic if OpenAI key missing
        if (openaiKey) {
            // Use OpenAI for title generation (preferred)
            const titleModel = 'gpt-5-nano';
            const msgs: any[] = [
                { role: 'system', content: 'You generate a short, clear chat title. Respond with only the title, no quotes, max 8 words, Title Case.' },
                { role: 'user', content: currentInput }
            ];
            const response = await sendRequest(msgs as any, titleModel, { reasoningEffort: 'minimal', verbosity: 'low' });
            const svc = await import('../services/openaiService.js');
            const raw = svc.extractOutputTextFromResponses(response);
            let title = raw?.trim() || '';
            if (!title) {
                log.warn('Title generation: Invalid response structure - no title text extracted from:', response);
                throw new Error('Empty title text');
            }
            const clean = svc.sanitizeTitle(title);
            if (!clean) throw new Error('Sanitized title empty');
            setTitle(clean, convId);
        } else if (anthropicKey) {
            // Fall back to Anthropic Haiku for title generation
            const titleModel = 'claude-3-haiku-20240307';
            const client = createAnthropicClient(anthropicKey);
            const response = await client.messages.create({
                model: titleModel,
                max_tokens: 50,
                messages: [
                    { role: 'user', content: currentInput }
                ],
                system: 'You generate a short, clear chat title. Respond with only the title, no quotes, max 8 words, Title Case.'
            });

            const titleText = response.content
                .filter(block => block.type === 'text')
                .map(block => (block as any).text)
                .join('')
                .trim();

            if (!titleText) throw new Error('Empty title text from Anthropic');

            // Sanitize title (remove quotes, limit length)
            let clean = titleText.replace(/^["']|["']$/g, '').trim();
            if (clean.length > 50) clean = clean.substring(0, 50).trim();
            if (!clean) throw new Error('Sanitized title empty');

            setTitle(clean, convId);
        } else {
            // No API keys available - use fallback
            throw new Error('No API keys available for title generation');
        }
    } catch (error) {
        log.warn("Title generation failed, using fallback:", error);
        setTitle(currentInput.slice(0, 30) + (currentInput.length > 30 ? '...' : ''), convId);
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
    log.debug("Counted tokens: " + usage.total_tokens);
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
