/**
 * Live API Tests - OpenAI Raw API Testing
 *
 * Direct OpenAI API tests for models, chat completions, and streaming functionality.
 * These tests verify that the OpenAI API works correctly with our implementation.
 */

import { registerTest } from '../testHarness.js';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

if (hasOpenAIKey) {
  registerTest({
    id: 'openai-models-api',
    name: 'OpenAI Models API works',
    tags: ['live', 'openai', 'api'],
    timeoutMs: 10000,
    fn: async (t) => {
      const apiKey = process.env.OPENAI_API_KEY!;

      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      t.that(response.ok, `HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      t.that(Array.isArray(data.data), 'Response should have data array');
      t.that(data.data.length > 0, 'Should have at least one model');

      const modelIds = data.data.map((m: any) => m.id);
      t.that(modelIds.some((id: string) => id.includes('gpt')), 'Should have GPT models available');

      console.log('✅ Models API working');
      console.log(`Available models (first 10):`, modelIds.slice(0, 10));
    }
  });

  registerTest({
    id: 'openai-chat-completion',
    name: 'OpenAI Chat Completion works',
    tags: ['live', 'openai', 'chat'],
    timeoutMs: 15000,
    fn: async (t) => {
      const apiKey = process.env.OPENAI_API_KEY!;
      const model = 'gpt-3.5-turbo';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
      t.that(data.id, 'Response should have an id');
      t.that(data.object === 'chat.completion', 'Object type should be chat.completion');
      t.that(data.model.startsWith(model), `Model should start with requested model: ${data.model} should start with ${model}`);
      t.that(Array.isArray(data.choices), 'Response should have choices array');
      t.that(data.choices.length > 0, 'Should have at least one choice');
      t.that(data.choices[0].message?.content, 'First choice should have message content');

      console.log('✅ Chat completion working');
      console.log('Response:', data.choices[0].message.content);
    }
  });

  registerTest({
    id: 'openai-streaming',
    name: 'OpenAI Streaming works',
    tags: ['live', 'openai', 'streaming'],
    timeoutMs: 20000,
    fn: async (t) => {
      const apiKey = process.env.OPENAI_API_KEY!;
      const model = 'gpt-3.5-turbo';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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

      t.that(response.body, 'Response should have a readable stream');
      console.log('✅ Streaming response received');

      const reader = response.body!.getReader();
      let chunkCount = 0;
      let fullText = '';
      let hasData = false;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('Stream complete');
            break;
          }

          chunkCount++;
          const chunk = new TextDecoder().decode(value);

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
                if (parsed.choices?.[0]?.delta?.content) {
                  fullText += parsed.choices[0].delta.content;
                  hasData = true;
                }
              } catch (e) {
                // Ignore parsing errors for non-JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      t.that(chunkCount > 0, 'Should receive at least one chunk');
      t.that(hasData, 'Should receive some content data');
      t.that(fullText.length > 0, 'Should accumulate some text content');

      console.log('✅ Streaming test complete');
      console.log(`Received ${chunkCount} chunks, full text: "${fullText}"`);
    }
  });
} else {
  registerTest({
    id: 'openai-api-key-missing',
    name: 'OpenAI API key environment variable missing',
    tags: ['live', 'openai'],
    timeoutMs: 1000,
    fn: async (t) => {
      console.log('⚠️  OPENAI_API_KEY not set - skipping OpenAI live API tests');
      t.that(false, 'OPENAI_API_KEY environment variable is required for live OpenAI tests');
    }
  });
}