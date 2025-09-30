#!/usr/bin/env node

/**
 * Test script to investigate Anthropic SDK behavior with reasoning models
 * This tests how the SDK handles the 'thinking' parameter
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

// Try to read API key from .env file
let apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const match = envContent.match(/VITE_ANTHROPIC_API_KEY=(.+)/);
    if (match) {
      apiKey = match[1].trim();
    }
  } catch (e) {
    // ignore
  }
}

if (!apiKey) {
  console.error('❌ No Anthropic API key found in environment');
  process.exit(1);
}

console.log('🔍 Testing Anthropic SDK with reasoning models\n');

const client = new Anthropic({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});

// Test 1: Non-reasoning model (should work)
async function testNonReasoningModel() {
  console.log('Test 1: Non-reasoning model (claude-3-haiku-20240307)');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
    };

    console.log('Request params:', JSON.stringify(params, null, 2));

    const response = await client.messages.create(params);

    console.log('✅ Success! Response:', {
      model: response.model,
      contentLength: response.content[0].text.length,
      firstFewChars: response.content[0].text.substring(0, 50)
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error('Response status:', error.status);
    }
    if (error.error) {
      console.error('Error details:', error.error);
    }
  }
  console.log('\n');
}

// Test 2: Reasoning model WITHOUT thinking parameter (might fail with 400)
async function testReasoningModelWithoutThinking() {
  console.log('Test 2: Reasoning model WITHOUT thinking parameter (claude-sonnet-4-20250514)');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
    };

    console.log('Request params:', JSON.stringify(params, null, 2));

    const response = await client.messages.create(params);

    console.log('✅ Success! Response:', {
      model: response.model,
      contentLength: response.content[0].text.length,
      firstFewChars: response.content[0].text.substring(0, 50)
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error('Response status:', error.status);
    }
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
  console.log('\n');
}

// Test 3: Reasoning model WITH thinking parameter (should work)
async function testReasoningModelWithThinking() {
  console.log('Test 3: Reasoning model WITH thinking parameter (claude-sonnet-4-20250514)');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
      thinking: {
        type: 'enabled',
        budget_tokens: 16384
      }
    };

    console.log('Request params:', JSON.stringify(params, null, 2));

    const response = await client.messages.create(params);

    console.log('✅ Success! Response:', {
      model: response.model,
      contentLength: response.content[0].text.length,
      firstFewChars: response.content[0].text.substring(0, 50),
      hasThinking: !!response.thinking
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error('Response status:', error.status);
    }
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
  console.log('\n');
}

// Test 4: Check what exact request is being sent
async function debugRequestDetails() {
  console.log('Test 4: Debug request internals for reasoning model');
  console.log('----------------------------------------');

  // Intercept the actual request being made
  const originalFetch = global.fetch;
  let capturedRequest = null;
  let capturedError = null;

  global.fetch = async function(url, options) {
    capturedRequest = {
      url,
      method: options?.method,
      headers: Object.fromEntries(Object.entries(options?.headers || {}).filter(([k]) => !k.toLowerCase().includes('api-key'))),
      body: options?.body ? JSON.parse(options.body) : null
    };
    console.log('\n📦 Actual request being sent to API:');
    console.log('URL:', capturedRequest.url);
    console.log('Method:', capturedRequest.method);
    console.log('Headers (without API key):', JSON.stringify(capturedRequest.headers, null, 2));
    console.log('Body:', JSON.stringify(capturedRequest.body, null, 2));

    // Still make the actual request
    try {
      const response = await originalFetch.apply(this, arguments);
      if (!response.ok) {
        const errorText = await response.text();
        capturedError = {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        };
        console.log('\n❌ API Response Error:');
        console.log('Status:', response.status, response.statusText);
        console.log('Error body:', errorText);
      }
      return response;
    } catch (e) {
      throw e;
    }
  };

  try {
    // First try without thinking
    console.log('\n=== WITHOUT thinking parameter ===');
    const paramsWithout = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
    };

    await client.messages.create(paramsWithout).catch(e => {
      console.log('\nCaught error:', e.message);
    });

    // Then try with thinking
    console.log('\n=== WITH thinking parameter ===');
    const paramsWith = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
      thinking: {
        type: 'enabled',
        budget_tokens: 16384
      }
    };

    await client.messages.create(paramsWith).catch(e => {
      console.log('\nCaught error:', e.message);
    });

  } finally {
    global.fetch = originalFetch;
  }
  console.log('\n');
}

// Test 5: Test streaming with reasoning model
async function testStreamingReasoningModel() {
  console.log('Test 5: Streaming with reasoning model');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
      stream: true,
      thinking: {
        type: 'enabled',
        budget_tokens: 16384
      }
    };

    console.log('Request params:', JSON.stringify(params, null, 2));

    const stream = await client.messages.create(params);

    let fullText = '';
    let eventCount = 0;

    for await (const event of stream) {
      eventCount++;
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullText += event.delta.text;
      }
    }

    console.log('✅ Stream Success!');
    console.log('Event count:', eventCount);
    console.log('Response length:', fullText.length);
    console.log('First few chars:', fullText.substring(0, 50));
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error('Response status:', error.status);
    }
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
  console.log('\n');
}

// Run all tests
async function runAllTests() {
  await testNonReasoningModel();
  await testReasoningModelWithoutThinking();
  await testReasoningModelWithThinking();
  await debugRequestDetails();
  await testStreamingReasoningModel();

  console.log('🏁 All tests completed');
}

runAllTests().catch(console.error);