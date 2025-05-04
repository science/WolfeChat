#!/usr/bin/env node

// Simple test script to check OpenAI API functionality
// Run with: node test-api-simple.js

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

async function main() {
  console.log('Starting OpenAI API tests...\n');
  
  // Test 1: Models API
  console.log('=== Testing Models API ===');
  try {
    const modelsResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!modelsResponse.ok) {
      throw new Error(`HTTP ${modelsResponse.status}: ${modelsResponse.statusText}`);
    }

    const modelsData = await modelsResponse.json();
    console.log('✅ Models API working');
    console.log('Available models:', modelsData.data.map(m => m.id).slice(0, 10));
    
    // Test 2: Chat Completion
    console.log('\n=== Testing Chat Completion ===');
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello, this is a test message.'" }
        ],
        max_tokens: 50,
        stream: false
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`HTTP ${chatResponse.status}: ${chatResponse.statusText}\n${errorText}`);
    }

    const chatData = await chatResponse.json();
    console.log('✅ Chat completion working');
    console.log('Response:', chatData.choices[0].message.content);
    
    // Test 3: Streaming
    console.log('\n=== Testing Streaming ===');
    const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello, this is a streaming test.'" }
        ],
        max_tokens: 50,
        stream: true
      })
    });

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      throw new Error(`HTTP ${streamResponse.status}: ${streamResponse.statusText}\n${errorText}`);
    }

    console.log('✅ Streaming response received');
    
    const reader = streamResponse.body.getReader();
    let chunkCount = 0;
    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete');
        break;
      }
      
      chunkCount++;
      const chunk = new TextDecoder().decode(value);
      console.log(`Chunk ${chunkCount}:`, chunk);
      
      // Parse the chunk to extract content
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('Stream finished');
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices[0]?.delta?.content) {
              fullText += parsed.choices[0].delta.content;
            }
          } catch (e) {
            // Ignore parsing errors for non-JSON lines
          }
        }
      }
    }
    
    console.log('Full text received:', fullText);
    console.log('\n=== Test Summary ===');
    console.log('✅ All tests passed! The issue is likely in the SmoothGPT application code.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n=== Test Summary ===');
    console.log('❌ API test failed. Check your API key and OpenAI service status.');
  }
}

main().catch(console.error);
