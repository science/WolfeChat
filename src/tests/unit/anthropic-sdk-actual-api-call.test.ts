/**
 * TEST: Verify Anthropic API actually returns thinking blocks
 *
 * This test makes a real API call to verify the API returns thinking content
 * when the thinking parameter is provided.
 */

import { registerTest } from '../testHarness.js';

registerTest({
  id: 'anthropic-api-thinking-blocks',
  name: 'Anthropic API should return thinking blocks when thinking parameter is set',
  tags: ['live', 'anthropic'],
  fn: async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.log('⚠️ SKIPPED: ANTHROPIC_API_KEY not set');
      return;
    }

    const { createAnthropicClient } = await import('../../services/anthropicClientFactory.js');
    const { addThinkingConfigurationWithBudget } = await import('../../services/anthropicReasoning.js');

    const client = createAnthropicClient(apiKey);

    const baseParams = {
      model: 'claude-sonnet-4-5', // Try without date suffix
      max_tokens: 64000, // Must use full max tokens for model
      messages: [
        { role: 'user', content: 'A farmer has 17 sheep. All but 9 die. How many sheep are left? Think through this carefully step by step, considering what "all but 9" means.' }
      ]
    };

    const configuredParams = addThinkingConfigurationWithBudget(baseParams);

    console.log('\n=== Testing Real API Call ===');
    console.log('Params:', JSON.stringify(configuredParams, null, 2));

    // Make streaming call
    const stream = client.messages.stream(configuredParams);

    let hasThinkingBlock = false;
    let thinkingText = '';
    let responseText = '';

    stream.on('content_block_start', (block) => {
      console.log('content_block_start:', block.type);
      if (block.type === 'thinking') {
        hasThinkingBlock = true;
      }
    });

    stream.on('thinking_delta', (delta) => {
      console.log('thinking_delta event fired!');
      thinkingText += delta.text || '';
    });

    stream.on('text', (text) => {
      responseText += text;
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      throw error;
    });

    await stream.finalMessage();

    console.log('\n=== Results ===');
    console.log('Has thinking block:', hasThinkingBlock);
    console.log('Thinking text length:', thinkingText.length);
    console.log('Response text length:', responseText.length);
    console.log('Thinking text sample:', thinkingText.slice(0, 100));
    console.log('Response text sample:', responseText.slice(0, 100));

    if (!hasThinkingBlock) {
      throw new Error('❌ FAILED: API did not return thinking block even though thinking parameter was set');
    }

    if (thinkingText.length === 0) {
      throw new Error('❌ FAILED: thinking_delta events never fired or had no text');
    }

    console.log('✅ API correctly returned thinking blocks');
  }
});