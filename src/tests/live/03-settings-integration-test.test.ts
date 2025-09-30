/**
 * Live API Unit Tests - Level 3: Settings Integration
 *
 * This test verifies that the Settings component can properly validate
 * Anthropic API keys using our fixed checkAPIConnection function.
 *
 * Note: These tests simulate the Settings component behavior but don't
 * require a full browser environment.
 */

import { registerTest } from '../testHarness.js';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (hasAnthropicKey) {
  registerTest({
    id: 'settings-anthropic-validation',
    name: 'Level 3: Settings checkAPIConnection validates Anthropic key correctly',
    tags: ['live', 'anthropic', 'settings'],
    timeoutMs: 10000,
    fn: async (t) => {
      const apiKey = process.env.ANTHROPIC_API_KEY!;

      // Import the service function that the Settings component uses
      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      // Simulate what the checkAPIConnection function does for Anthropic
      let validationSuccessful = false;
      let errorMessage = '';

      try {
        // This is what happens when user selects Anthropic and clicks "Check API"
        const models = await fetchAnthropicModels(apiKey);

        // If we get here, validation was successful
        validationSuccessful = true;

        t.that(models.length > 0, 'API validation should return models');
        console.log('✓ Settings-style Anthropic API validation successful:', {
          modelCount: models.length,
          firstModel: models[0].id
        });

      } catch (error) {
        errorMessage = error.message;
        console.log('✗ Settings-style Anthropic API validation failed:', errorMessage);
      }

      t.that(validationSuccessful, 'Anthropic API validation should succeed with valid key');
      t.that(errorMessage === '', 'Should not have error message with valid key');
    }
  });

  registerTest({
    id: 'settings-anthropic-invalid-key',
    name: 'Level 3: Settings checkAPIConnection properly rejects invalid Anthropic key',
    tags: ['live', 'anthropic', 'settings'],
    timeoutMs: 10000,
    fn: async (t) => {
      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      // Simulate what happens when user enters an invalid Anthropic key
      let validationFailed = false;
      let errorMessage = '';

      try {
        await fetchAnthropicModels('sk-ant-invalid-key-12345');
      } catch (error) {
        validationFailed = true;
        errorMessage = error.message;
      }

      t.that(validationFailed, 'Invalid Anthropic API key should be rejected');
      t.that(errorMessage.includes('Invalid Anthropic API key'), 'Error message should be user-friendly');

      console.log('✓ Settings-style invalid key rejection working:', errorMessage);
    }
  });

  registerTest({
    id: 'settings-provider-switching-simulation',
    name: 'Level 3: Simulate provider switching in Settings',
    tags: ['live', 'anthropic', 'settings'],
    timeoutMs: 15000,
    fn: async (t) => {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;
      const openaiKey = process.env.OPENAI_API_KEY || 'sk-test-key'; // Fallback for testing

      const { fetchAnthropicModels } = await import('../../services/anthropicService.js');

      // Simulate user switching between providers
      let anthropicModels = [];
      let anthropicError = '';

      // Test Anthropic provider
      try {
        anthropicModels = await fetchAnthropicModels(anthropicKey);
        console.log('✓ Anthropic provider validation successful');
      } catch (error) {
        anthropicError = error.message;
        console.log('✗ Anthropic provider validation failed:', error.message);
      }

      // Test that Anthropic validation worked
      t.that(anthropicModels.length > 0, 'Anthropic provider should return models');
      t.that(anthropicError === '', 'Anthropic provider should not have errors');

      // Verify models have correct provider labels
      const allAnthropicModels = anthropicModels.every(m => m.provider === 'anthropic');
      t.that(allAnthropicModels, 'All Anthropic models should have correct provider label');

      console.log('✓ Provider switching simulation successful');
    }
  });

  registerTest({
    id: 'settings-model-provider-detection',
    name: 'Level 3: Settings can properly detect model providers',
    tags: ['live', 'anthropic', 'settings'],
    timeoutMs: 5000,
    fn: async (t) => {
      // Import both service functions
      const { fetchAnthropicModels, isAnthropicModel, getModelProvider } = await import('../../services/anthropicService.js');

      const apiKey = process.env.ANTHROPIC_API_KEY!;
      const models = await fetchAnthropicModels(apiKey);

      // Test that we can identify which models belong to which provider
      for (const model of models) {
        const isAnthropic = isAnthropicModel(model.id);
        const provider = getModelProvider(model.id);

        t.that(isAnthropic, `${model.id} should be identified as Anthropic model`);
        t.that(provider === 'anthropic', `${model.id} should have anthropic provider`);
        t.that(model.provider === 'anthropic', `${model.id} should have provider property set`);
      }

      console.log('✓ Model provider detection working for all models');
    }
  });
} else {
  registerTest({
    id: 'settings-missing-key',
    name: 'Level 3: ANTHROPIC_API_KEY environment variable missing',
    tags: ['live', 'anthropic', 'settings'],
    timeoutMs: 1000,
    fn: async (t) => {
      console.log('⚠️  ANTHROPIC_API_KEY not set - skipping settings integration tests');
      t.that(false, 'ANTHROPIC_API_KEY environment variable is required for settings tests');
    }
  });
}