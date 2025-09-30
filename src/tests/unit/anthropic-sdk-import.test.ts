/**
 * Unit Test: Anthropic SDK Import and Initialization
 *
 * Tests the ability to import and initialize the Anthropic SDK
 * This is the foundation test that all other SDK functionality depends on
 */

import { registerTest } from '../testHarness.js';

registerTest({
  id: 'anthropic-sdk-import-basic',
  name: 'Should import Anthropic SDK without errors',
  fn: async () => {
    // This test verifies the SDK can be imported
    let importError: Error | null = null;
    let Anthropic: any = null;

    try {
      // Attempt to import the Anthropic SDK
      const module = await import('@anthropic-ai/sdk');
      Anthropic = module.default;
    } catch (error) {
      importError = error as Error;
    }

    // Assert: SDK imports without errors
    if (importError) {
      throw new Error(`Failed to import Anthropic SDK: ${importError.message}`);
    }
    if (!Anthropic) {
      throw new Error('Anthropic SDK default export is undefined');
    }
    if (typeof Anthropic !== 'function') {
      throw new Error('Anthropic SDK default export is not a constructor function');
    }

    console.log('✓ Anthropic SDK imported successfully');
  }
});

registerTest({
  id: 'anthropic-sdk-client-creation',
  name: 'Should create Anthropic client with API key and browser config',
  fn: async () => {
    // This test verifies we can create a client instance with browser configuration
    let clientError: Error | null = null;
    let client: any = null;

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');

      // Create client with test API key and browser configuration
      client = new Anthropic({
        apiKey: 'test-api-key-12345',
        dangerouslyAllowBrowser: true,
      });
    } catch (error) {
      clientError = error as Error;
    }

    // Assert: Client can be created with API key
    if (clientError) {
      throw new Error(`Failed to create Anthropic client: ${clientError.message}`);
    }
    if (!client) {
      throw new Error('Anthropic client is undefined');
    }
    if (client.apiKey !== 'test-api-key-12345') {
      throw new Error(`Expected API key 'test-api-key-12345', got '${client.apiKey}'`);
    }

    console.log('✓ Anthropic client created successfully with browser config');
  }
});

registerTest({
  id: 'anthropic-sdk-browser-config',
  name: 'Should require dangerouslyAllowBrowser for browser environments',
  fn: async () => {
    // This test verifies that browser configuration is required
    let browserError: Error | null = null;

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');

      // Attempt to create client without browser config (should fail)
      new Anthropic({
        apiKey: 'test-key-12345',
        // dangerouslyAllowBrowser: false (default)
      });
    } catch (error) {
      browserError = error as Error;
    }

    // Assert: Error thrown for browser environment without proper config
    if (!browserError) {
      throw new Error('Expected error when creating client without browser config, but no error was thrown');
    }
    if (!browserError.message.toLowerCase().includes('browser')) {
      throw new Error(`Expected error message to contain 'browser', got: ${browserError.message}`);
    }

    console.log('✓ Properly requires dangerouslyAllowBrowser for browser use');
  }
});