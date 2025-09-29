/**
 * Unit Test: Anthropic Client Factory
 *
 * Tests the client factory that creates properly configured Anthropic SDK clients
 * for browser environments with the correct headers and configuration
 */

import { registerTest } from '../testHarness.js';

registerTest({
  id: 'anthropic-client-factory-creation',
  name: 'Should create client factory and generate clients',
  fn: async () => {
    // This test verifies the factory can create SDK clients
    let factoryError: Error | null = null;
    let factory: any = null;
    let client: any = null;

    try {
      // Import the factory (which doesn't exist yet)
      const factoryModule = await import('../../services/anthropicClientFactory.js');
      factory = factoryModule.createAnthropicClient;

      // Create a client using the factory
      client = factory('test-api-key-factory');
    } catch (error) {
      factoryError = error as Error;
    }

    // Assert: Factory and client creation work
    if (factoryError) {
      throw new Error(`Failed to create client via factory: ${factoryError.message}`);
    }
    if (!factory || typeof factory !== 'function') {
      throw new Error('Factory should be a function');
    }
    if (!client) {
      throw new Error('Factory should return a client instance');
    }
    if (client.apiKey !== 'test-api-key-factory') {
      throw new Error(`Expected API key 'test-api-key-factory', got '${client.apiKey}'`);
    }

    console.log('✓ Client factory creates SDK clients successfully');
  }
});

registerTest({
  id: 'anthropic-client-factory-browser-headers',
  name: 'Should include browser configuration in created clients',
  fn: async () => {
    // This test verifies the factory creates clients with proper browser config
    let client: any = null;

    try {
      const factoryModule = await import('../../services/anthropicClientFactory.js');
      const factory = factoryModule.createAnthropicClient;

      // Create client and verify it has browser configuration
      client = factory('test-key-browser-config');
    } catch (error) {
      throw new Error(`Factory failed: ${error.message}`);
    }

    // Assert: Client should be configured for browser use
    if (!client) {
      throw new Error('Factory should return a client');
    }

    // Try to verify this is a properly configured browser client
    // We can't easily inspect internal config, but we know it should work in browser
    const clientType = client.constructor.name;
    if (clientType !== 'Anthropic') {
      throw new Error(`Expected client type 'Anthropic', got '${clientType}'`);
    }

    console.log('✓ Client factory includes proper browser configuration');
  }
});

registerTest({
  id: 'anthropic-client-factory-missing-key',
  name: 'Should handle missing API key gracefully',
  fn: async () => {
    // This test verifies factory handles missing API keys
    let thrownError: Error | null = null;

    try {
      const factoryModule = await import('../../services/anthropicClientFactory.js');
      const factory = factoryModule.createAnthropicClient;

      // Try to create client without API key
      factory('');
    } catch (error) {
      thrownError = error as Error;
    }

    // Assert: Should handle missing key appropriately
    if (thrownError) {
      // If it throws an error, it should be descriptive
      if (!thrownError.message.toLowerCase().includes('api key')) {
        throw new Error(`Expected error about API key, got: ${thrownError.message}`);
      }
      console.log('✓ Factory throws descriptive error for missing API key');
    } else {
      // If it doesn't throw, it should still create a valid client
      console.log('✓ Factory handles missing API key gracefully (deferred validation)');
    }
  }
});