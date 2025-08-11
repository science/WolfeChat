// Debug utilities for SmoothGPT chat issues
import { get } from 'svelte/store';
import { apiKey, selectedModel } from '../stores/stores';
import { createResponseViaResponsesAPI, streamResponseViaResponsesAPI, sendRequest, buildResponsesInputFromMessages } from '../services/openaiService';

export interface DebugInfo {
  apiKeyConfigured: boolean;
  selectedModel: string;
  availableModels: any[];
  lastRequestPayload: any;
  lastResponse: any;
  lastError: any;
  timestamp: string;
}

export async function testDirectAPI() {
  const key = get(apiKey);
  const model = get(selectedModel);
  
  console.log('=== Direct API Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', model);
  
  if (!key) {
    console.error('No API key configured');
    return null;
  }
  if (!model) {
    console.error('No model selected; set a model in the UI to replicate live behavior.');
    return null;
  }

  try {
    // Test 1: Fetch available models
    console.log('Testing model availability...');
    const modelsResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!modelsResponse.ok) {
      console.error('Models API failed:', modelsResponse.status, modelsResponse.statusText);
      return null;
    }

    const modelsData = await modelsResponse.json();
    console.log('Available models:', modelsData.data.map((m: any) => m.id));
    
    // Test 2: Test the selected model specifically
    console.log(`Testing selected model: ${model}`);
    const testPayload = {
      model: model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'Hello, this is a test message.'" }
      ],
      max_tokens: 50,
      stream: false // Test without streaming first
    };

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('Chat API failed:', chatResponse.status, chatResponse.statusText);
      console.error('Error details:', errorText);
      return null;
    }

    const chatData = await chatResponse.json();
    console.log('Chat API success:', chatData);
    
    return {
      success: true,
      models: modelsData.data,
      chatTest: chatData,
      selectedModel: model
    };

  } catch (error) {
    console.error('API test failed:', error);
    return null;
  }
}

export async function testStreamingAPI() {
  const key = get(apiKey);
  const model = get(selectedModel);
  
  console.log('=== Streaming API Test ===');
  
  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    const testPayload = {
      model: model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'Hello, this is a streaming test.'" }
      ],
      max_tokens: 50,
      stream: true
    };

    console.log('Testing streaming with payload:', testPayload);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Streaming API failed:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return null;
    }

    console.log('Streaming response headers:', Object.fromEntries(response.headers.entries()));
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No response body reader available');
      return null;
    }

    let streamData = '';
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete');
        break;
      }
      
      chunkCount++;
      const chunk = new TextDecoder().decode(value);
      streamData += chunk;
      console.log(`Chunk ${chunkCount}:`, chunk);
    }

    console.log('Total stream data:', streamData);
    return { 
      success: true,
      chunkCount, 
      streamData 
    };

  } catch (error) {
    console.error('Streaming test failed:', error);
    return null;
  }
}

// New test functions for the enhanced test harness
export async function testSmoothGPTChatFlow() {
  const key = get(apiKey);
  const model = get(selectedModel);
  
  console.log('=== SmoothGPT Chat Flow Test ===');
  console.log('Testing the actual chat interface flow...');
  
  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    // Simulate the exact payload that SmoothGPT would send
    const chatPayload = {
      model: model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'Hello, this is a SmoothGPT chat test.'" }
      ],
      max_tokens: 1000,
      stream: true,
      temperature: 0.7
    };

    console.log('Sending chat payload:', JSON.stringify(chatPayload, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chat flow test failed:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return null;
    }

    console.log('✅ Chat flow response received');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Test the SSE parsing that SmoothGPT uses
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No response body reader available');
      return null;
    }

    let rawData = '';
    let parsedChunks = [];
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete');
        break;
      }
      
      chunkCount++;
      const chunk = new TextDecoder().decode(value);
      rawData += chunk;
      
      // Test the parseJSONChunks function logic
      const parsed = parseJSONChunks(chunk);
      if (parsed.length > 0) {
        parsedChunks.push(...parsed);
      }
      
      console.log(`Chunk ${chunkCount}:`, chunk);
      console.log(`Parsed from chunk ${chunkCount}:`, parsed);
    }

    console.log('Total raw data:', rawData);
    console.log('Total parsed chunks:', parsedChunks);
    
    return {
      success: true,
      chunkCount,
      rawData,
      parsedChunks,
      finalMessage: extractFinalMessage(parsedChunks)
    };

  } catch (error) {
    console.error('Chat flow test failed:', error);
    return null;
  }
}

export async function testModelSpecificBehavior() {
  const key = get(apiKey);
  const model = get(selectedModel);
  
  console.log('=== Model-Specific Behavior Test ===');
  console.log(`Testing model: ${model}`);
  
  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    // Test with the exact model that's failing in the UI
    const testPayload = {
      model: model,
      messages: [
        { role: "user", content: "Say exactly 'Model test successful' and nothing else." }
      ],
      max_tokens: 20,
      stream: true
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Model test failed:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return null;
    }

    console.log('✅ Model test response received');
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No response body reader available');
      return null;
    }

    let streamData = '';
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete');
        break;
      }
      
      chunkCount++;
      const chunk = new TextDecoder().decode(value);
      streamData += chunk;
    }

    console.log('Model test stream data:', streamData);
    
    // Test parsing with the actual parseJSONChunks function
    const parsedChunks = parseJSONChunks(streamData);
    console.log('Parsed chunks from model test:', parsedChunks);
    
    return {
      success: true,
      model,
      chunkCount,
      streamData,
      parsedChunks,
      parseSuccess: parsedChunks.length > 0
    };

  } catch (error) {
    console.error('Model test failed:', error);
    return null;
  }
}

export async function testSSEParsing() {
  console.log('=== SSE Parsing Test ===');
  
  // Test with sample SSE data similar to what we're getting
  const sampleSSEData = `data: {"id":"test","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"test","choices":[{"delta":{"content":" world"}}]}
data: [DONE]`;

  console.log('Testing with sample SSE data:', sampleSSEData);
  
  try {
    const parsed = parseJSONChunks(sampleSSEData);
    console.log('Parsed result:', parsed);
    
    return {
      success: true,
      sampleData: sampleSSEData,
      parsed,
      parseCount: parsed.length
    };
  } catch (error) {
    console.error('SSE parsing test failed:', error);
    return null;
  }
}

// Test the actual SSE.js implementation that SmoothGPT uses
export async function testSSEJSImplementation() {
  const key = get(apiKey);
  const model = get(selectedModel);
  
  console.log('=== SSE.js Implementation Test ===');
  console.log('Testing the actual SSE.js library that SmoothGPT uses...');
  
  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    // Dynamically import SSE.js to avoid build issues
    const { SSE } = await import('sse.js');
    
    const testPayload = {
      model: model,
      messages: [
        { role: "user", content: "Say 'SSE.js test successful' and nothing else." }
      ],
      max_tokens: 20,
      stream: true
    };

    console.log('Testing SSE.js with payload:', JSON.stringify(testPayload, null, 2));

    return new Promise((resolve) => {
      let streamData = '';
      let chunkCount = 0;
      let hasError = false;
      
      const source = new SSE("https://api.openai.com/v1/chat/completions", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        method: "POST",
        payload: JSON.stringify(testPayload),
      });

      source.addEventListener("message", (e) => {
        console.log('SSE.js message event:', e);
        
        if (e.data !== "[DONE]") {
          try {
            chunkCount++;
            streamData += e.data + '\n';
            console.log(`SSE.js chunk ${chunkCount}:`, e.data);
            
            // Test the parseJSONChunks function with SSE.js data
            const parsed = parseJSONChunks(e.data);
            console.log(`Parsed from SSE.js chunk ${chunkCount}:`, parsed);
            
          } catch (error) {
            console.error('Error processing SSE.js chunk:', error);
            hasError = true;
          }
        } else {
          console.log('SSE.js stream complete');
          source.close();
          
          resolve({
            success: !hasError,
            chunkCount,
            streamData,
            parseSuccess: true
          });
        }
      });

      source.addEventListener("error", (e) => {
        console.error('SSE.js error event:', e);
        hasError = true;
        source.close();
        
        resolve({
          success: false,
          error: 'SSE.js error event',
          chunkCount,
          streamData
        });
      });

      source.stream();
    });

  } catch (error) {
    console.error('SSE.js test failed:', error);
    return {
      success: false,
      error: error.message,
      chunkCount: 0,
      streamData: ''
    };
  }
}

export async function testResponsesAPI(prompt: string = "Say 'double bubble bath' five times fast.") {
  const key = get(apiKey);
  const model = get(selectedModel);

  console.log('=== Responses API (non-streaming) Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    const data = await createResponseViaResponsesAPI(prompt, model);
    const outputText =
      data?.output_text ??
      data?.output?.[0]?.content?.map((c: any) => c?.text).join('') ??
      data?.response?.output_text ??
      JSON.stringify(data);
    console.log('Responses API result:', data);
    console.log('Responses API output_text:', outputText);
    return { success: true, raw: data, outputText, model };
  } catch (e) {
    console.error('Responses API error:', e);
    return { success: false, error: e };
  }
}

export async function testResponsesStreamingAPI(prompt: string = "Stream this: 'double bubble bath' five times fast.") {
  const key = get(apiKey);
  const model = get(selectedModel);

  console.log('=== Responses API (streaming) Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  const events: any[] = [];
  let finalText = '';

  try {
    finalText = await streamResponseViaResponsesAPI(prompt, model, {
      onEvent: (evt) => {
        if (evt.type === 'response.created' || evt.type === 'response.completed' || evt.type === 'error') {
          console.log('SSE event:', evt.type, evt.data?.id || '');
        }
        events.push(evt);
      },
      onTextDelta: (_text) => {},
      onCompleted: (text) => {
        console.log('Streaming completed. Final text length:', text.length);
      },
      onError: (err) => {
        console.error('Streaming error:', err);
      }
    });

    return { success: true, finalText, eventsCount: events.length, events, model };
  } catch (e) {
    console.error('Responses Streaming error:', e);
    return { success: false, error: e, eventsCount: events.length, events, model };
  }
}

export async function testResponsesStreamingWithHistory() {
  const key = get(apiKey);
  const model = get(selectedModel);

  console.log('=== Responses API Streaming With History Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say "Hello."' },
    { role: 'assistant', content: 'Hello.' },
    { role: 'user', content: 'Now say "world".' }
  ];

  const input = buildResponsesInputFromMessages(messages);

  const events: any[] = [];
  let finalText = '';

  try {
    finalText = await streamResponseViaResponsesAPI('', model, {
      onEvent: (evt) => {
        if (evt.type === 'response.created' || evt.type === 'response.completed' || evt.type === 'error') {
          console.log('SSE event:', evt.type, evt.data?.id || '');
        }
        events.push(evt);
      },
      onTextDelta: (_text) => {},
      onCompleted: (text) => {
        console.log('Streaming completed. Final text length:', text.length);
      },
      onError: (err) => {
        console.error('Streaming error:', err);
      }
    }, input);

    return { success: true, finalText, eventsCount: events.length, events, model };
  } catch (e) {
    console.error('Responses Streaming With History error:', e);
    return { success: false, error: e, eventsCount: events.length, events, model };
  }
}

/**
 * Mirrors the title-generation path in the live app, which calls sendRequest(...)
 * with a model like 'gpt-4-turbo-preview' that may not support reasoning.effort.
 * This should reproduce the 400 unsupported_parameter error when applicable.
 */
export async function testCreateTitleFlow(currentInput: string = "This is a sample conversation about testing.") {
  const key = get(apiKey);
  const model = 'gpt-4-turbo-preview';

  console.log('=== Title Flow Responses API Test ===');
  console.log('API Key configured:', !!key);
  console.log('Title model:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  try {
    const data = await sendRequest([
      { role: "user", content: currentInput },
      { role: "user", content: "Generate a title for this conversation, so I can easily reference it later. Maximum 6 words. Return only the title text." }
    ], model);
    console.log('Title flow result:', data);
    return { success: true, raw: data, model };
  } catch (e) {
    console.error('Title flow error:', e);
    return { success: false, error: e, model };
  }
}

// Helper functions
function parseJSONChunks(rawData: string) {
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

function extractFinalMessage(chunks: any[]) {
  let finalMessage = '';
  
  for (const chunk of chunks) {
    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
      const content = chunk.choices[0].delta.content;
      if (content) {
        finalMessage += content;
      }
    }
  }
  
  return finalMessage;
}

export function getCurrentDebugInfo(): DebugInfo {
  return {
    apiKeyConfigured: !!get(apiKey),
    selectedModel: get(selectedModel),
    availableModels: [], // Would need to be populated from Settings
    lastRequestPayload: null, // Would need to be captured during requests
    lastResponse: null, // Would need to be captured during requests
    lastError: null, // Would need to be captured during requests
    timestamp: new Date().toISOString()
  };
}

export function logDebugInfo() {
  const debugInfo = getCurrentDebugInfo();
  console.log('=== Debug Info ===');
  console.log(JSON.stringify(debugInfo, null, 2));
}

// Reasoning streaming debug test
const EXPECTED_REASONING_EVENT_TYPES = [
  'response.reasoning_summary_part.added',
  'response.reasoning_summary_part.done',
  'response.reasoning_summary_text.delta',
  'response.reasoning_summary_text.done',
  'response.reasoning_text.delta',
  'response.reasoning_text.done',
];

// Mirror services' supportsReasoning check locally for the test harness
function supportsReasoningLocal(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('gpt-5') || m.includes('o3') || m.includes('o4') || m.includes('reason');
}

/**
 * Streams a message using the Responses API and captures reasoning events.
 * Returns:
 * - events: compact payloads for each event
 * - seenTypes: which event types were observed
 * - missingTypes: which expected types were not observed
 * - order: the order of event types as they were received
 * - reasoningSummaryText, reasoningText: concatenated reasoning content (if any)
 * - outputText: concatenated final output text
 */
export async function testReasoningStreamingAPI(prompt?: string) {
  const key = get(apiKey);
  const selected = get(selectedModel);

  console.log('=== Reasoning Streaming Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', selected);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  // Force reasoning test to use o3-mini to ensure reasoning events are emitted consistently
  const model = 'o3-mini';
  if ((selected || '').toLowerCase() !== model) {
    console.warn(`Reasoning test will use "${model}" regardless of selected model ("${selected}").`);
  }

  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Think step by step internally and provide a concise final answer.' },
    { role: 'user', content: prompt || 'Please explain your reasoning while answering: What is 24 * 17? Give the final numeric answer at the end.' }
  ];

  const input = buildResponsesInputFromMessages(messages);

  const events: any[] = [];
  const order: string[] = [];
  const seen = new Set<string>();

  let reasoningSummaryText = '';
  let reasoningText = '';
  let outputText = '';
  let completed = false;

  try {
    await streamResponseViaResponsesAPI(
      '',
      model,
      {
        onEvent: ({ type, data }) => {
          const resolvedType = type || data?.type || 'message';
          order.push(resolvedType);
          seen.add(resolvedType);

          let payloadSummary: any;

          switch (resolvedType) {
            case 'response.reasoning_summary_part.added':
              payloadSummary = { partType: data?.part?.type ?? '' };
              break;
            case 'response.reasoning_summary_part.done':
              payloadSummary = { partType: data?.part?.type ?? '', text: data?.part?.text ?? '' };
              if (typeof data?.part?.text === 'string') reasoningSummaryText += data.part.text;
              break;
            case 'response.reasoning_summary_text.delta':
              payloadSummary = { delta: data?.delta ?? '' };
              if (typeof data?.delta === 'string') reasoningSummaryText += data.delta;
              break;
            case 'response.reasoning_summary_text.done':
              payloadSummary = { text: data?.text ?? '' };
              if (typeof data?.text === 'string') reasoningSummaryText += data.text;
              break;
            case 'response.reasoning_text.delta':
              payloadSummary = { delta: data?.delta ?? '' };
              if (typeof data?.delta === 'string') reasoningText += data.delta;
              break;
            case 'response.reasoning_text.done':
              payloadSummary = { text: data?.text ?? '' };
              if (typeof data?.text === 'string') reasoningText += data.text;
              break;
            case 'response.output_text.delta':
              payloadSummary = { delta: data?.delta?.text ?? data?.delta ?? data?.text ?? '' };
              break;
            default:
              // Keep the whole payload for unknown/other event types to aid discovery
              payloadSummary = data;
              break;
          }

          events.push({ type: resolvedType, data: payloadSummary });
        },
        onTextDelta: (text) => {
          outputText += text;
        },
        onCompleted: () => {
          completed = true;
        },
        onError: (err) => {
          console.error('Reasoning streaming onError:', err);
          events.push({ type: 'error', data: err });
        }
      },
      input
    );

    const missingTypes = EXPECTED_REASONING_EVENT_TYPES.filter((t) => !seen.has(t));
    return {
      success: completed,
      model,
      events,
      order,
      seenTypes: Array.from(seen),
      missingTypes,
      outputText,
      reasoningSummaryText,
      reasoningText
    };
  } catch (error) {
    console.error('Reasoning streaming test failed:', error);
    const missingTypes = EXPECTED_REASONING_EVENT_TYPES.filter((t) => !seen.has(t));
    return {
      success: false,
      error,
      model,
      events,
      order,
      seenTypes: Array.from(seen),
      missingTypes,
      outputText,
      reasoningSummaryText,
      reasoningText
    };
  }
}
