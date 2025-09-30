#!/usr/bin/env node

/**
 * Test script to investigate Anthropic SDK behavior with reasoning models
 * This tests how the SDK handles the 'thinking' parameter
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

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
      content: response.content,
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  console.log('\n');
}

// Test 2: Reasoning model WITHOUT thinking parameter (likely fails)
async function testReasoningModelWithoutThinking() {
  console.log('Test 2: Reasoning model WITHOUT thinking parameter (claude-sonnet-4)');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-sonnet-4',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
    };

    console.log('Request params:', JSON.stringify(params, null, 2));

    const response = await client.messages.create(params);

    console.log('✅ Success! Response:', {
      model: response.model,
      content: response.content,
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  console.log('\n');
}

// Test 3: Reasoning model WITH thinking parameter (should work)
async function testReasoningModelWithThinking() {
  console.log('Test 3: Reasoning model WITH thinking parameter (claude-sonnet-4)');
  console.log('----------------------------------------');

  try {
    const params = {
      model: 'claude-sonnet-4',
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
      content: response.content,
      thinking: response.thinking || 'No thinking in response'
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  console.log('\n');
}

// Test 4: Check what exact request is being sent
async function debugRequestDetails() {
  console.log('Test 4: Debug request internals');
  console.log('----------------------------------------');

  // Intercept the actual request being made
  const originalFetch = global.fetch;
  let capturedRequest = null;

  global.fetch = async function(url, options) {
    capturedRequest = {
      url,
      method: options?.method,
      headers: options?.headers,
      body: options?.body ? JSON.parse(options.body) : null
    };
    // Still make the actual request
    return originalFetch.apply(this, arguments);
  };

  try {
    const params = {
      model: 'claude-sonnet-4',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
      thinking: {
        type: 'enabled',
        budget_tokens: 16384
      }
    };

    console.log('Creating request with params:', JSON.stringify(params, null, 2));

    await client.messages.create(params).catch(e => {
      console.log('Expected error (for debugging):', e.message);
    });

    if (capturedRequest) {
      console.log('\n📦 Actual request sent to API:');
      console.log('URL:', capturedRequest.url);
      console.log('Method:', capturedRequest.method);
      console.log('Body:', JSON.stringify(capturedRequest.body, null, 2));
    }

  } finally {
    global.fetch = originalFetch;
  }
  console.log('\n');
}

// Run all tests
async function runAllTests() {
  await testNonReasoningModel();
  await testReasoningModelWithoutThinking();
  await testReasoningModelWithThinking();
  await debugRequestDetails();

  console.log('🏁 All tests completed');
}

runAllTests().catch(console.error);