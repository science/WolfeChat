import { get, writable } from 'svelte/store';
import { Configuration, OpenAIApi } from "openai";
import type { ChatCompletionRequestMessage,  } from "openai";
import type  { ChatCompletionRequestMessageRoleEnum } from "openai";
import { apiKey} from "../stores/stores";
import { selectedModel, selectedVoice, audioUrls, selectedSize, selectedQuality, defaultAssistantRole, isStreaming, streamContext } from '../stores/stores';
import { conversations, chosenConversationId, combinedTokens, userRequestedStreamClosure } from "../stores/stores";
import { setHistory, countTokens, estimateTokens, displayAudioMessage, cleanseMessage } from '../managers/conversationManager';
import { SSE } from 'sse.js'; // Assuming SSE library is used
import { countTicks } from '../utils/generalUtils';
import { saveAudioBlob, getAudioBlob } from '../idb';
import { onSendVisionMessageComplete } from '../managers/imageManager';

let configuration: Configuration | null = null;
let openai: OpenAIApi | null = null;

  // A global variable to hold the stream source  
  let globalSource: EventSource | null = null;  


export const closeStream = async () => {  
  if (globalSource) {  
      globalSource.close();  
      console.log("Stream closed by user.");  
      isStreaming.set(false);  

      const { streamText, convId } = get(streamContext); // Get the current stream context  
      if (streamText && convId !== null) {  
          const cleanText = streamText.replace(/█+$/, ''); // Always clean, but only update if needed  
          const currentHistory = get(conversations)[convId].history;  

          let lastEntry = currentHistory.length ? currentHistory[currentHistory.length - 1] : null;  

          // Determine if the last entry in history is the one we're streaming  
          if (lastEntry && lastEntry.content.endsWith("█")) {  
              // If so, update the last entry with the cleaned text  
              currentHistory[currentHistory.length - 1] = {  
                  ...lastEntry,  
                  content: cleanText  
              };  
          } else {  
              // Otherwise, add a new history entry  
              currentHistory.push({  
                  role: "assistant",  
                  content: cleanText  
              });  
          }  

          // Now update the entire history in the store  
          await setHistory(currentHistory, convId);  

          // Clear stream context  
          streamContext.set({ streamText: '', convId: null });  
      }  

      userRequestedStreamClosure.set(true);  
      onSendVisionMessageComplete();

  }  
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
    // Prepend the system message to msg
    msg = [
      {
        role: "system",
        content: get(conversations)[get(chosenConversationId)].assistantRole,
      },
      ...msg,
    ];

    // Attempt to send the request
    const response = await openai.createChatCompletion({
      model: model,
      messages: msg,
    });

    // If the response is successful, count tokens and return the response
    if (response) {
      countTokens(response.data.usage);
      return response;
    }
  } catch (error) {
    console.error("Error in sendRequest:", error);

    // Reset configuration and await setHistory in case of error
    configuration = null;

    // Await setHistory here. Ensure setHistory is properly adapted to return a Promise.
    await setHistory(errorMessage);

    // Re-throw the error or handle it as needed
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
  let hasEncounteredError = false;  

  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get(conversations)[convId].history;

    // Convert history messages into the expected format
    let historyMessages = currentHistory.map(historyItem => ({
      role: historyItem.role,
      content: typeof historyItem.content === 'string' ? [{type: "text", text: historyItem.content}] : historyItem.content,
  }));

  let userTextMessage = [...msg].reverse().find(m => m.role === "user")?.content || "";

  let imageMessages = imagesBase64.map(imageBase64 => ({
    type: "image_url",
    image_url: {
        url: imageBase64, // Ensure your base64 string includes the proper data URI scheme
    }
}));

// Construct the combined message content array for the current message
let combinedMessageContent = userTextMessage ? [
    {
        type: "text",
        text: userTextMessage,
    },
    ...imageMessages // Spread operator to include all image messages
] : [...imageMessages]; // Only include image messages if there's no text message

// Create a single 'user' message object that contains both the text and image contents for the current message
let currentMessage = {
    role: "user",
    content: combinedMessageContent,
};

// Combine the history and the current message into the final payload
const cleansedMessages = historyMessages.map(cleanseMessage);

let finalMessages = [...cleansedMessages, currentMessage];

  let done = false;
  let streamText = "";

  currentHistory = [...currentHistory];
  isStreaming.set(true);  

  let source = new SSE("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${get(apiKey)}`,
    },
    method: "POST",
    payload: JSON.stringify({
      model: get(selectedModel),
      messages: finalMessages, // Updated to include full conversation history
      stream: true,
    }),
  });

  console.log("payload", JSON.stringify({
    model: get(selectedModel),
    messages: finalMessages, // Updated to include full conversation history
    stream: true,
  })
);

  source.addEventListener("message", async (e) => {
    let payload;
    if (e.data !== "[DONE]") {
      try {  
        if (!hasEncounteredError) {  
          let parsedChunks = parseJSONChunks(e.data);
          // Process each parsed JSON object
          parsedChunks.forEach((payload) => {
            // Your logic to handle each JSON object goes here
            // Example: Extracting text and updating history or stream context
            let text = payload.choices[0]?.delta?.content;
            if (text) {
              let msgTicks = countTicks(text);
              tickCounter += msgTicks;
              if (msgTicks === 0) tickCounter = 0;
              if (tickCounter === 3) {
                ticks = !ticks;
                tickCounter = 0;
              }
              streamText += text;
              streamContext.set({ streamText, convId }); // Update the store  
    
              // Here, we await setHistory within the async IIFE
              setHistory([...currentHistory, {
                role: "assistant",
                content: streamText + "█" + (ticks ? "\n```" : ""),
              }], convId);
            }
          });
        }
      } catch (error) {
          console.error("Error parsing JSON:", error);  
          hasEncounteredError = true; 
          source.close();  
          onSendVisionMessageComplete();

          console.log("Stream closed due to parsing error.");  
          isStreaming.set(false);  

          return;
        }  
      
      } else {
        done = true;  
        if (get(userRequestedStreamClosure)) {  
          streamText = streamText.replace(/█+$/, ''); // Removes the block character(s) if present at the end  
          userRequestedStreamClosure.set(false); // Reset the flag after handling  
        }  
      
        await setHistory([...currentHistory, {  
          role: "assistant",  
          content: streamText,  
        }], convId);  
        



        estimateTokens(msg, convId);
        streamText = "";
        done = true;
        console.log("Stream closed");
        source.close();
        onSendVisionMessageComplete();

          // Stream is complete, so set isStreaming back to false.  
  isStreaming.set(false);  
      }
    });
  
    source.addEventListener("error", (e) => {  
      try {  
        if (done) return; // If the stream is already marked as done, no further action required.  
        console.error("Stream error:", e);  
      } finally {  
        source.close(); 
        onSendVisionMessageComplete();
 
        // Regardless of the cause of the error, the stream is closing, so set isStreaming back to false.  
        isStreaming.set(false);  
      }  
    });  
    
    source.stream();  
    globalSource = source;  
  }  

  export async function sendRegularMessage(msg: ChatCompletionRequestMessage[], convId) {
    userRequestedStreamClosure.set(false);  
    let hasEncounteredError = false;  

    let tickCounter = 0;
    let ticks = false;
    let currentHistory = get(conversations)[convId].history;
    
    let roleMsg: ChatCompletionRequestMessage = {
      role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
      content: get(conversations)[convId].assistantRole,
    };
    
    msg = [roleMsg, ...msg];

    const cleansedMessages = msg.map(cleanseMessage);

    let done = false;
    let streamText = "";
  
    currentHistory = [...currentHistory];
    isStreaming.set(true);

    let source = new SSE("https://api.openai.com/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${get(apiKey)}`,
      },
      method: "POST",
      payload: JSON.stringify({
        model: get(selectedModel),
        messages: cleansedMessages,
        stream: true,
      }),
    });

    console.log("payload", JSON.stringify({
      model: get(selectedModel),
      messages: cleansedMessages,
      stream: true,
    })
  );
  
    source.addEventListener("message", async (e) => { // Note: Adding async here makes the callback function async
      let payload;
      if (e.data !== "[DONE]") {
        try {  
          if (!hasEncounteredError) {  
            let parsedChunks = parseJSONChunks(e.data);
            // Process each parsed JSON object
            parsedChunks.forEach((payload) => {
              // Your logic to handle each JSON object goes here
              // Example: Extracting text and updating history or stream context
              let text = payload.choices[0]?.delta?.content;
              if (text) {
                let msgTicks = countTicks(text);
                tickCounter += msgTicks;
                if (msgTicks === 0) tickCounter = 0;
                if (tickCounter === 3) {
                  ticks = !ticks;
                  tickCounter = 0;
                }
                streamText += text;
                streamContext.set({ streamText, convId }); // Update the store  
      
                // Here, we await setHistory within the async IIFE
                setHistory([...currentHistory, {
                  role: "assistant",
                  content: streamText + "█" + (ticks ? "\n```" : ""),
                }], convId);
              }
            });
          }
        } catch (error) {
            console.error("Error parsing JSON:", error);  
            hasEncounteredError = true; 
            source.close();  
            console.log("Stream closed due to parsing error.");  
            isStreaming.set(false);  

            return;
          }  
  
      } else {
        done = true;  
        if (get(userRequestedStreamClosure)) {  
          streamText = streamText.replace(/█+$/, ''); // Removes the block character(s) if present at the end  
          userRequestedStreamClosure.set(false); // Reset the flag after handling  
        }  
      
        await setHistory([...currentHistory, {  
          role: "assistant",  
          content: streamText,  
        }], convId);  
        



        estimateTokens(msg, convId);
        streamText = "";
        done = true;
        console.log("Stream closed");
        source.close();
          // Stream is complete, so set isStreaming back to false.  
  isStreaming.set(false);  
      }
    });
  
    source.addEventListener("error", (e) => {  
      try {  
        if (done) return; // If the stream is already marked as done, no further action required.  
        console.error("Stream error:", e);  
      } finally {  
        source.close();  
        // Regardless of the cause of the error, the stream is closing, so set isStreaming back to false.  
        isStreaming.set(false);  
      }  
    });  
    
    source.stream();  
    globalSource = source;  
  }  

  export async function sendPDFMessage(msg: ChatCompletionRequestMessage[], convId, pdfOutput) {
    userRequestedStreamClosure.set(false);  
    let hasEncounteredError = false;  

    let tickCounter = 0;
    let ticks = false;
    let currentHistory = get(conversations)[convId].history;
    
    let roleMsg: ChatCompletionRequestMessage = {
      role: get(defaultAssistantRole).type as ChatCompletionRequestMessageRoleEnum,
      content: get(conversations)[convId].assistantRole,
    };
    
    let systemMessage: ChatCompletionRequestMessage = {  
      role: 'system', // Assuming 'system' is an acceptable value for your backend/API  
      content: pdfOutput,  
    };  

    currentHistory.push(systemMessage);  


    msg = [roleMsg, systemMessage, ...msg];  
console.log(msg);
    const cleansedMessages = msg.map(cleanseMessage);

    let done = false;
    let streamText = "";
  
    currentHistory = [...currentHistory];
    isStreaming.set(true);

    let source = new SSE("https://api.openai.com/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${get(apiKey)}`,
      },
      method: "POST",
      payload: JSON.stringify({
        model: get(selectedModel),
        messages: cleansedMessages,
        stream: true,
      }),
    });

    console.log("payload", JSON.stringify({
      model: get(selectedModel),
      messages: cleansedMessages,
      stream: true,
    })
  );
  
    source.addEventListener("message", async (e) => { // Note: Adding async here makes the callback function async
      let payload;
      if (e.data !== "[DONE]") {
        try {  
          if (!hasEncounteredError) {  
            let parsedChunks = parseJSONChunks(e.data);
            // Process each parsed JSON object
            parsedChunks.forEach((payload) => {
              // Your logic to handle each JSON object goes here
              // Example: Extracting text and updating history or stream context
              let text = payload.choices[0]?.delta?.content;
              if (text) {
                let msgTicks = countTicks(text);
                tickCounter += msgTicks;
                if (msgTicks === 0) tickCounter = 0;
                if (tickCounter === 3) {
                  ticks = !ticks;
                  tickCounter = 0;
                }
                streamText += text;
                streamContext.set({ streamText, convId }); // Update the store  
      
                // Here, we await setHistory within the async IIFE
                setHistory([...currentHistory, {
                  role: "assistant",
                  content: streamText + "█" + (ticks ? "\n```" : ""),
                }], convId);
              }
            });
          }
        } catch (error) {
            console.error("Error parsing JSON:", error);  
            hasEncounteredError = true; 
            source.close();  
            console.log("Stream closed due to parsing error.");  
            isStreaming.set(false);  

            return;
          }  
  
      } else {
        done = true;  
        if (get(userRequestedStreamClosure)) {  
          streamText = streamText.replace(/█+$/, ''); // Removes the block character(s) if present at the end  
          userRequestedStreamClosure.set(false); // Reset the flag after handling  
        }  
      
        await setHistory([...currentHistory, {  
          role: "assistant",  
          content: streamText,  
        }], convId);  
        



        estimateTokens(msg, convId);
        streamText = "";
        done = true;
        console.log("Stream closed");
        source.close();
          // Stream is complete, so set isStreaming back to false.  
  isStreaming.set(false);  
      }
    });
  
    source.addEventListener("error", (e) => {  
      try {  
        if (done) return; // If the stream is already marked as done, no further action required.  
        console.error("Stream error:", e);  
      } finally {  
        source.close();  
        // Regardless of the cause of the error, the stream is closing, so set isStreaming back to false.  
        isStreaming.set(false);  
      }  
    });  
    
    source.stream();  
    globalSource = source;  
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
  
  
  
  