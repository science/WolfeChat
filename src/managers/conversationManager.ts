import type { ChatCompletionRequestMessage } from "openai";
import { get, writable } from "svelte/store";
import { conversations, chosenConversationId, combinedTokens } from "../stores/stores";
import { type Conversation, defaultAssistantRole } from "../stores/stores";
import { selectedModel, selectedVoice, audioUrls, base64Images } from '../stores/stores';
import { reasoningWindows } from '../stores/reasoningStore';

import { sendTTSMessage, sendRegularMessage, sendVisionMessage, sendRequest, sendDalleMessage } from "../services/openaiService";
let streamText = "";





export function setHistory(msg, convId = get(chosenConversationId)): Promise<void> {
  return new Promise<void>((resolve, reject) => {
      try {
          let conv = get(conversations);
          conv[convId].history = msg;
          conversations.set(conv);
          resolve(); // No value is being resolved here
      } catch (error) {
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
      if (w.convId !== convId) return true;
      // Keep windows anchored at or before messageIndex
      return w.anchorIndex <= messageIndex;
    });
  });
}




export function newChat() {
    const currentConversations = get(conversations);
    // Check if conversations is not empty before accessing its last element
    if (currentConversations.length > 0 && currentConversations[currentConversations.length - 1].history.length === 0) {
      console.log("Jumping to recent conversation.");
        chosenConversationId.set(currentConversations.length - 1);
        return;
    }
    const newConversation: Conversation = {
        history: [],
        conversationTokens: 0,
        assistantRole: get(defaultAssistantRole).role, // Assuming defaultAssistantRole is a svelte store
        title: "",
    };
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



export async function routeMessage(input: string, convId) {

    let currentHistory = get(conversations)[convId].history;
    let messageHistory = currentHistory;
    currentHistory = [...currentHistory, { role: "user", content: input }];
    setHistory(currentHistory);

    const defaultModel = 'gpt-3.5-turbo'; 
    const defaultVoice = 'alloy'; 
    const model = get(selectedModel) || defaultModel;
    const voice = get(selectedVoice) || defaultVoice;

    let outgoingMessage: ChatCompletionRequestMessage[];
    outgoingMessage = [
        ...messageHistory,
        { role: "user", content: input },
      ];

    if (model.includes('tts')) {
        // The model string contains 'tts', proceed with TTS message handling
        await sendTTSMessage(input, model, voice, convId);
      } else if (model.includes('vision')) {
        const imagesBase64 = get(base64Images); // Retrieve the current array of base64 encoded images
        await sendVisionMessage(outgoingMessage, imagesBase64, convId);
      } else if (model.includes('dall-e')) {
        await sendDalleMessage(outgoingMessage, convId);
      } else {
        // Default case for regular messages if no specific keywords are found in the model string
        await sendRegularMessage(outgoingMessage, convId);
      }
    if (get(conversations)[convId].history.length === 1 || get(conversations)[convId].title === '') {
        await createTitle(input);
    }
}

function setTitle(title: string) {
    let conv = get(conversations);
    conv[get(chosenConversationId)].title = title;
    conversations.set(conv);
  }

async function createTitle(currentInput: string) {
    const titleModel = 'gpt-4-turbo-preview';

    let response = await sendRequest([
    { role: "user", content: currentInput },
    {
      role: "user",
      content: "Generate a title for this conversation, so I can easily reference it later. Maximum 6 words. Don't provide anything other than the title. Don't use quotes.",
    },
  ], titleModel); // Pass the titleModel as an argument

  if (response) {
    let message = response.data.choices[0].message.content;
    setTitle(message.toString());
  }
}

export function displayAudioMessage(audioUrl) {
    const audioMessage = {
  role: "assistant",
  content: "Audio file generated.",
  audioUrl: audioUrl,
  isAudio: true 
} as ChatCompletionRequestMessage;

setHistory([...get(conversations)[get(chosenConversationId)].history, audioMessage]);
}

export function countTokens(usage) {
    let conv = get(conversations);
    conv[get(chosenConversationId)].conversationTokens =
      conv[get(chosenConversationId)].conversationTokens + usage.total_tokens;
    conversations.set(conv);
    combinedTokens.set(get(combinedTokens) + usage.total_tokens);
    console.log("Counted tokens: " + usage.total_tokens);
  }

 
  export function estimateTokens(msg: ChatCompletionRequestMessage[], convId) {
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
