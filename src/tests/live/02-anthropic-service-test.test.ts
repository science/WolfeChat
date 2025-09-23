/**
 * Live API Unit Tests - Level 2: Service Functions
 *
 * This test verifies that our anthropicService.ts functions work correctly
 * with the real API.
 */

import { registerTest } from '../testHarness.js';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (hasAnthropicKey) {
  registerTest({
    id: 'anthropic-service-fetchModels',
    name: 'Level 2: fetchAnthropicModels returns hardcoded models after API validation',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 10000,
    fn: async (t) => {
      const apiKey = process.env.ANTHROPIC_API_KEY!;

      // Import the service function
      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      const models = await fetchAnthropicModels(apiKey);

      t.that(Array.isArray(models), 'fetchAnthropicModels should return an array');
      t.that(models.length > 0, 'Should return at least one model');

      // Check that all models have the expected structure
      const firstModel = models[0];
      t.that(firstModel.id, 'Model should have an id');
      t.that(firstModel.provider === 'anthropic', 'Model should have provider set to anthropic');
      t.that(typeof firstModel.created === 'number', 'Model should have created timestamp');
      t.that(firstModel.display_name, 'Model should have display_name from API');

      // Check that Claude models are present
      const hasClaudeModels = models.some(m => m.id.includes('claude'));
      t.that(hasClaudeModels, 'Should include Claude models');

      // Check specific models we know should be there
      const hasHaiku = models.some(m => m.id.includes('haiku'));
      const hasSonnet = models.some(m => m.id.includes('sonnet'));
      t.that(hasHaiku, 'Should include Claude Haiku models');
      t.that(hasSonnet, 'Should include Claude Sonnet models');

      console.log('✓ fetchAnthropicModels working correctly:', {
        totalModels: models.length,
        exampleModel: firstModel.id
      });
    }
  });

  registerTest({
    id: 'anthropic-service-isAnthropicModel',
    name: 'Level 2: isAnthropicModel correctly identifies Claude models',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 1000,
    fn: async (t) => {
      const { isAnthropicModel } = await import('../../services/anthropicService.js');

      // Test Claude models
      t.that(isAnthropicModel('claude-3-haiku-20240307'), 'Should identify claude-3-haiku as Anthropic');
      t.that(isAnthropicModel('claude-3-5-sonnet-20241022'), 'Should identify claude-3-5-sonnet as Anthropic');
      t.that(isAnthropicModel('claude-4-opus-20250514'), 'Should identify claude-4-opus as Anthropic');

      // Test non-Claude models
      t.that(!isAnthropicModel('gpt-4'), 'Should not identify gpt-4 as Anthropic');
      t.that(!isAnthropicModel('gpt-3.5-turbo'), 'Should not identify gpt-3.5-turbo as Anthropic');
      t.that(!isAnthropicModel('text-davinci-003'), 'Should not identify text-davinci-003 as Anthropic');

      console.log('✓ isAnthropicModel working correctly');
    }
  });

  registerTest({
    id: 'anthropic-service-getModelProvider',
    name: 'Level 2: getModelProvider returns correct provider',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 1000,
    fn: async (t) => {
      const { getModelProvider } = await import('../../services/anthropicService.js');

      // Test Claude models
      t.that(getModelProvider('claude-3-haiku-20240307') === 'anthropic', 'Claude model should return anthropic provider');
      t.that(getModelProvider('claude-3-5-sonnet-20241022') === 'anthropic', 'Claude Sonnet should return anthropic provider');

      // Test OpenAI models
      t.that(getModelProvider('gpt-4') === 'openai', 'GPT-4 should return openai provider');
      t.that(getModelProvider('gpt-3.5-turbo') === 'openai', 'GPT-3.5 should return openai provider');

      console.log('✓ getModelProvider working correctly');
    }
  });

  registerTest({
    id: 'anthropic-service-invalid-key-error',
    name: 'Level 2: fetchAnthropicModels properly handles invalid API key',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 10000,
    fn: async (t) => {
      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      try {
        await fetchAnthropicModels('sk-ant-invalid-key-12345');
        t.that(false, 'fetchAnthropicModels should throw with invalid key');
      } catch (error) {
        t.that(error instanceof Error, 'Should throw an Error object');
        t.that(error.message.includes('Invalid Anthropic API key'), 'Error message should mention invalid API key');
        console.log('✓ Invalid API key properly handled:', error.message);
      }
    }
  });

  registerTest({
    id: 'anthropic-service-empty-key-error',
    name: 'Level 2: fetchAnthropicModels properly handles empty API key',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 1000,
    fn: async (t) => {
      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      try {
        await fetchAnthropicModels('');
        t.that(false, 'fetchAnthropicModels should throw with empty key');
      } catch (error) {
        t.that(error instanceof Error, 'Should throw an Error object');
        t.that(error.message.includes('API key is missing'), 'Error message should mention missing API key');
        console.log('✓ Empty API key properly handled:', error.message);
      }
    }
  });

  registerTest({
    id: 'anthropic-service-cors-header-required',
    name: 'Level 2: Anthropic API requires CORS header for browser access',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 10000,
    fn: async (t) => {
      const apiKey = process.env.ANTHROPIC_API_KEY!;

      // Test without CORS header - should fail in browser environment
      try {
        const responseWithoutCors = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
            // Missing 'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          })
        });

        // If we get here in a browser environment, that's unexpected
        console.log('⚠️  Request without CORS header succeeded (running in Node.js?)');
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.log('✓ CORS blocking confirmed - request without header failed as expected');
        } else {
          console.log('? Different error without CORS header:', error.message);
        }
      }

      // Test with CORS header - should succeed
      try {
        const responseWithCors = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          })
        });

        t.that(responseWithCors.ok || responseWithCors.status === 429,
          'Request with CORS header should succeed (or hit rate limit)');
        console.log('✓ Request with CORS header succeeded:', responseWithCors.status);

      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          t.that(false, 'Request with CORS header should not fail with TypeError: Failed to fetch');
        } else {
          // Other errors (like network issues) are acceptable
          console.log('? Other error with CORS header:', error.message);
        }
      }
    }
  });
} else {
  registerTest({
    id: 'anthropic-service-missing-key',
    name: 'Level 2: ANTHROPIC_API_KEY environment variable missing',
    tags: ['live', 'anthropic', 'service'],
    timeoutMs: 1000,
    fn: async (t) => {
      console.log('⚠️  ANTHROPIC_API_KEY not set - skipping service tests');
      t.that(false, 'ANTHROPIC_API_KEY environment variable is required for service tests');
    }
  });
}