// Simple test script to check OpenAI API functionality
// Run with: node test-api.js

const API_KEY = process.env.OPENAI_API_KEY; // Set your API key as environment variable

if (!API_KEY) {
  console.error('Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

async function testModels() {
  console.log('=== Testing Models API ===');
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Models API working');
    console.log('Available models:', data.data.map(m => m.id).slice(0, 10));
    
    return data.data;
  } catch (error) {
    console.error('❌ Models API failed:', error.message);
    return null;
  }
}

async function testChatCompletion(model = 'gpt-3.5-turbo') {
  console.log(`\n=== Testing Chat Completion with ${model} ===`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello, this is a test message.'" }
        ],
        max_tokens: 50,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Chat completion working');
    console.log('Response:', data.choices[0].message.content);
    
    return data;
  } catch (error) {
    console.error('❌ Chat completion failed:', error.message);
    return null;
  }
}

async function testStreaming(model = 'gpt-3.5-turbo') {
  console.log(`\n=== Testing Streaming with ${model} ===`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello, this is a streaming test.'" }
        ],
        max_tokens: 50,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }

    console.log('✅ Streaming response received');
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const reader = response.body.getReader();
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
    return { chunkCount, fullText };
    
  } catch (error) {
    console.error('❌ Streaming failed:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('Starting OpenAI API tests...\n');
  
  const models = await testModels();
  if (!models) {
    console.log('Cannot proceed without models API');
    return;
  }
  
  // Test with different models
  const modelsToTest = ['gpt-3.5-turbo'];
  
  for (const model of modelsToTest) {
    // Check if model is available
    const isAvailable = models.some(m => m.id === model);
    if (!isAvailable) {
      console.log(`\n⚠️  Model ${model} not available, skipping...`);
      continue;
    }
    
    await testChatCompletion(model);
    await testStreaming(model);
  }
  
  console.log('\n=== Test Summary ===');
  console.log('If all tests pass, the issue is likely in the SmoothGPT application code.');
  console.log('If some tests fail, there may be an issue with your API key or OpenAI service.');
}

// Run the tests
runTests().catch(console.error);
