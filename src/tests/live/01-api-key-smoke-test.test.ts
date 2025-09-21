/**
 * Live API Unit Tests - Level 1: Basic API Key Validation
 *
 * This test verifies that our API key is valid and can connect to Anthropic's API
 * using the most basic approach (equivalent to CLI curl).
 */

import { registerTest } from '../testHarness.js';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (hasAnthropicKey) {
  registerTest({
    id: 'anthropic-api-key-format',
    name: 'Level 1: API key has valid format',
    tags: ['live', 'anthropic', 'smoke'],
    timeoutMs: 5000,
    fn: async (t) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      t.that(apiKey, 'ANTHROPIC_API_KEY should be defined');
      t.that(apiKey.startsWith('sk-ant-api03-'), 'API key should start with sk-ant-api03-');
      t.that(apiKey.length > 100, 'API key should be longer than 100 characters');

      console.log('✓ API key format validation passed');
    }
  });

  registerTest({
    id: 'anthropic-raw-api-call',
    name: 'Level 1: Raw API call succeeds with valid key',
    tags: ['live', 'anthropic', 'smoke'],
    timeoutMs: 10000,
    fn: async (t) => {
      const apiKey = process.env.ANTHROPIC_API_KEY!;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      t.that(response.status === 200, `Expected status 200, got ${response.status}`);

      const data = await response.json();
      t.that(data.id, 'Response should have an id');
      t.that(data.type === 'message', 'Response type should be message');
      t.that(data.role === 'assistant', 'Response role should be assistant');
      t.that(data.model === 'claude-3-haiku-20240307', 'Response model should match request');
      t.that(Array.isArray(data.content), 'Response content should be an array');

      console.log('✓ Raw API call successful:', {
        id: data.id,
        model: data.model,
        contentLength: data.content?.length || 0
      });
    }
  });

  registerTest({
    id: 'anthropic-invalid-key-rejection',
    name: 'Level 1: Invalid API key properly rejected',
    tags: ['live', 'anthropic', 'smoke'],
    timeoutMs: 10000,
    fn: async (t) => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': 'sk-ant-invalid-key-12345',
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      });

      t.that(response.status === 401, `Expected status 401, got ${response.status}`);

      const data = await response.json();
      t.that(data.type === 'error', 'Response type should be error');
      t.that(data.error.type === 'authentication_error', 'Error type should be authentication_error');

      console.log('✓ Invalid key properly rejected');
    }
  });
} else {
  registerTest({
    id: 'anthropic-api-key-missing',
    name: 'Level 1: ANTHROPIC_API_KEY environment variable missing',
    tags: ['live', 'anthropic', 'smoke'],
    timeoutMs: 1000,
    fn: async (t) => {
      console.log('⚠️  ANTHROPIC_API_KEY not set - skipping live API tests');
      t.that(false, 'ANTHROPIC_API_KEY environment variable is required for live tests');
    }
  });
}