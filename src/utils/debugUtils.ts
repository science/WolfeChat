// Debug utilities for SmoothGPT chat issues
import { get } from 'svelte/store';
import { apiKey, selectedModel } from '../stores/stores.js';
import type { ChatMessage } from '../stores/stores.js';
import { createResponseViaResponsesAPI, streamResponseViaResponsesAPI, sendRequest, buildResponsesInputFromMessages } from '../services/openaiService.js';
import { getReasoningModel } from '../tests/testModel.js';

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

    const EXPECTED_REASONING_TYPES = [
      'response.reasoning_summary_part.added',
      'response.reasoning_summary_text.delta',
      'response.reasoning_summary_part.done',
      'response.reasoning_summary_text.done',
      'response.reasoning_text.delta',
      'response.reasoning_text.done',
    ];

    let rawData = '';
    let parsedChunks: any[] = [];
    let chunkCount = 0;

    const seenReasoning = new Set<string>();
    const reasoningEvents: { type: string; data: any }[] = [];

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('Stream complete');
        break;
      }

      chunkCount++;
      const text = decoder.decode(value, { stream: true });
      rawData += text;
      buffer += text;

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
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

        if (dataLines.length === 0) continue;

        const dataStr = dataLines.join('\n');
        if (dataStr === '[DONE]') {
          continue;
        }

        let obj: any = null;
        try {
          obj = JSON.parse(dataStr);
        } catch (e) {
          console.warn('Failed to parse SSE data JSON in chat flow test:', e, dataStr);
          continue;
        }

        // Collect regular chat-completions chunks for final message extraction
        if (obj?.choices) {
          parsedChunks.push(obj);
        }

        const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');
        if (EXPECTED_REASONING_TYPES.includes(resolvedType)) {
          if (!seenReasoning.has(resolvedType)) {
            console.log('Reasoning event detected:', resolvedType);
          }
          seenReasoning.add(resolvedType);
          reasoningEvents.push({ type: resolvedType, data: obj });
        }
      }

      console.log(`Chunk ${chunkCount}:`, text);
    }

    if (buffer.trim()) {
      // Process any trailing block left in buffer
      const trailingBlocks = buffer.split('\n\n').filter(b => b.trim());
      for (const block of trailingBlocks) {
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
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join('\n');
        if (dataStr === '[DONE]') continue;
        try {
          const obj = JSON.parse(dataStr);
          if (obj?.choices) parsedChunks.push(obj);
          const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');
          if (EXPECTED_REASONING_TYPES.includes(resolvedType)) {
            if (!seenReasoning.has(resolvedType)) {
              console.log('Reasoning event detected:', resolvedType);
            }
            seenReasoning.add(resolvedType);
            reasoningEvents.push({ type: resolvedType, data: obj });
          }
        } catch {}
      }
    }

    console.log('Total raw data:', rawData);
    console.log('Total parsed chunks:', parsedChunks);
    console.log('Seen reasoning event types:', Array.from(seenReasoning));
    
    return {
      success: true,
      chunkCount,
      rawData,
      parsedChunks,
      finalMessage: extractFinalMessage(parsedChunks),
      seenReasoningTypes: Array.from(seenReasoning),
      reasoningEvents
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

export async function testResponsesAPI(prompt: string = "Say 'double bubble bath' five times fast.", modelOverride?: string) {
  const key = get(apiKey);
  const model = modelOverride || get(selectedModel);

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

export async function testResponsesStreamingAPI(prompt: string = "Stream this: 'double bubble bath' five times fast.", modelOverride?: string) {
  const key = get(apiKey);
  const model = modelOverride || get(selectedModel);

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

export async function testResponsesStreamingWithHistory(modelOverride?: string) {
  const key = get(apiKey);
  const model = modelOverride || get(selectedModel);

  console.log('=== Responses API Streaming With History Test ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  const messages: ChatMessage[] = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Say "Hello."' },
    { role: 'assistant' as const, content: 'Hello.' },
    { role: 'user' as const, content: 'Now say "world".' }
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
 * with a model that may not support reasoning.effort.
 * This should reproduce the 400 unsupported_parameter error when applicable.
 */
export async function testCreateTitleFlow(currentInput: string = "This is a sample conversation about testing.", modelOverride?: string) {
  const key = get(apiKey);
  const model = modelOverride || 'gpt-4o-mini';  // Use a modern model that works with Responses API

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
  'response.reasoning_summary.delta',
  'response.reasoning_summary.done',
  'response.reasoning.delta',
  'response.reasoning.done',
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
export async function testReasoningStreamingAPI(prompt?: string, modelOverride?: string) {
  const key = get(apiKey);
  const selected = get(selectedModel);
  const model = modelOverride || getReasoningModel();

  console.log('=== Reasoning Streaming Test (multi-variant) ===');
  console.log('API Key configured:', !!key);
  console.log('Selected model:', selected);
  console.log('Using model for test:', model);

  if (!key) {
    console.error('No API key configured');
    return null;
  }

  const messages: ChatMessage[] = [
    { role: 'system' as const, content: 'You are a helpful assistant. Think step by step internally and provide a concise final answer.' },
    { role: 'user' as const, content: prompt || 'Please solve: 24 * 17. Provide the final numeric answer; you may think step-by-step internally.' }
  ];
  const input = buildResponsesInputFromMessages(messages);

  // Variants to try, inspired by Playgrounds/docs behavior
  const variants: { name: string; extras: any }[] = [
    { name: 'effort_high_summary_detailed', extras: { reasoning: { effort: 'high', summary: 'detailed' }, text: { verbosity: 'medium' } } },
    { name: 'effort_medium_summary_detailed', extras: { reasoning: { effort: 'medium', summary: 'detailed' }, text: { verbosity: 'medium' } } },
    { name: 'effort_high_summary_detailed_text_high', extras: { reasoning: { effort: 'high', summary: 'detailed' }, text: { verbosity: 'high' } } },
    { name: 'effort_high_summary_auto', extras: { reasoning: { effort: 'high', summary: 'auto' }, text: { verbosity: 'medium' } } },
    // This flag may be ignored by the API, but include it in a variant to probe behavior.
    { name: 'effort_high_summary_detailed_metadata_include_reasoning', extras: { reasoning: { effort: 'high', summary: 'detailed' }, metadata: { include_reasoning: true }, text: { verbosity: 'medium' } } },
  ];

  type StreamResult = {
    success: boolean;
    model: string;
    variant: string;
    events: any[];
    order: string[];
    seenTypes: string[];
    missingTypes: string[];
    outputText: string;
    reasoningSummaryText: string;
    reasoningText: string;
    error?: any;
  };

  async function streamOnce(payload: any, variantName: string): Promise<StreamResult> {
    const events: any[] = [];
    const order: string[] = [];
    const seen = new Set<string>();
    let outputText = '';
    let reasoningSummaryText = '';
    let reasoningText = '';
    let completed = false;

    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`Responses API stream error ${res.status}: ${text || res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
          completed = true;
          return;
        }

        let obj: any = null;
        try {
          obj = JSON.parse(dataStr);
        } catch (e) {
          console.warn('Failed to parse SSE data JSON chunk:', e, dataStr);
          return;
        }

        const resolvedType = eventType !== 'message' ? eventType : (obj?.type || 'message');
        order.push(resolvedType);
        seen.add(resolvedType);

        let payloadSummary: any;
        switch (resolvedType) {
          case 'response.reasoning_summary_part.added':
            payloadSummary = { partType: obj?.part?.type ?? '' };
            break;
          case 'response.reasoning_summary_part.done':
            payloadSummary = { partType: obj?.part?.type ?? '', text: obj?.part?.text ?? '' };
            if (typeof obj?.part?.text === 'string') reasoningSummaryText += obj.part.text;
            break;
          case 'response.reasoning_summary_text.delta':
          case 'response.reasoning_summary.delta':
            payloadSummary = { delta: obj?.delta ?? '' };
            if (typeof obj?.delta === 'string') reasoningSummaryText += obj.delta;
            break;
          case 'response.reasoning_summary_text.done':
          case 'response.reasoning_summary.done':
            payloadSummary = { text: obj?.text ?? '' };
            if (typeof obj?.text === 'string') reasoningSummaryText += obj.text;
            break;
          case 'response.reasoning_text.delta':
          case 'response.reasoning.delta':
            payloadSummary = { delta: obj?.delta ?? '' };
            if (typeof obj?.delta === 'string') reasoningText += obj.delta;
            break;
          case 'response.reasoning_text.done':
          case 'response.reasoning.done':
            payloadSummary = { text: obj?.text ?? '' };
            if (typeof obj?.text === 'string') reasoningText += obj.text;
            break;
          case 'response.output_text.delta': {
            const deltaText =
              obj?.delta?.text ??
              obj?.delta ??
              obj?.output_text_delta ??
              obj?.text ??
              '';
            payloadSummary = { delta: typeof deltaText === 'string' ? deltaText : '' };
            if (typeof deltaText === 'string' && deltaText) {
              outputText += deltaText;
            }
            break;
          }
          case 'response.completed':
            payloadSummary = obj;
            completed = true;
            break;
          default:
            payloadSummary = obj;
            break;
        }

        events.push({ type: resolvedType, data: payloadSummary });
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

      const missingTypes = EXPECTED_REASONING_EVENT_TYPES.filter((t) => !seen.has(t));
      return {
        success: completed,
        model,
        variant: variantName,
        events,
        order,
        seenTypes: Array.from(seen),
        missingTypes,
        outputText,
        reasoningSummaryText,
        reasoningText
      };
    } catch (error) {
      const seenTypes = Array.from(new Set(events.map((e: any) => e.type)));
      const missingTypes = EXPECTED_REASONING_EVENT_TYPES.filter((t) => !seenTypes.includes(t));
      return {
        success: false,
        model,
        variant: variantName,
        events,
        order,
        seenTypes,
        missingTypes,
        outputText,
        reasoningSummaryText,
        reasoningText,
        error
      };
    }
  }

  const variantResults: StreamResult[] = [];
  let bestIndex = -1;

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const payload = {
      model,
      input,
      store: false,
      stream: true,
      // base "text" tool default; overridden by variant if provided
      text: { verbosity: 'medium' },
      ...v.extras,
    };
    console.log(`Trying variant ${i + 1}/${variants.length}: ${v.name}`, payload);

    const result = await streamOnce(payload, v.name);
    variantResults.push(result);

    // Consider it "reasoning-present" if we saw any expected reasoning event types
    const hasReasoning = EXPECTED_REASONING_EVENT_TYPES.some(t => result.seenTypes.includes(t));
    if (hasReasoning && bestIndex === -1) {
      bestIndex = i;
      break; // stop at first variant that yields reasoning events
    }
  }

  // Pick best result
  const chosen = bestIndex >= 0 ? variantResults[bestIndex] : (variantResults[0] || null);
  if (!chosen) {
    return {
      success: false,
      model,
      error: 'No variants executed',
      events: [],
      order: [],
      seenTypes: [],
      missingTypes: EXPECTED_REASONING_EVENT_TYPES,
      outputText: '',
      reasoningSummaryText: '',
      reasoningText: '',
      bestVariant: null,
      variants: []
    };
  }

  return {
    success: chosen.success,
    model,
    events: chosen.events,
    order: chosen.order,
    seenTypes: chosen.seenTypes,
    missingTypes: chosen.missingTypes,
    outputText: chosen.outputText,
    reasoningSummaryText: chosen.reasoningSummaryText,
    reasoningText: chosen.reasoningText,
    bestVariant: chosen.variant,
    variants: variantResults.map(v => ({
      name: v.variant,
      success: v.success,
      seenTypes: v.seenTypes,
      missingTypes: v.missingTypes,
      eventsCount: v.events.length
    }))
  };
}
