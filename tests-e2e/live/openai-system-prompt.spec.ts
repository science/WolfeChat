/**
 * E2E Test: OpenAI System Prompt Integration
 *
 * Verifies that system prompts (both default and custom) are correctly
 * sent to the OpenAI API via the Responses API integration.
 *
 * Parallel test to anthropic-system-prompt.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  operateQuickSettings,
  sendMessage,
  waitForAssistantDone,
  setConversationSystemPrompt
} from './helpers';

test.describe('OpenAI System Prompt Integration', () => {

  test('should include default system prompt in OpenAI API request', async ({ page }) => {
    const openaiRequests: any[] = [];

    page.on('request', async (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        try {
          const postData = request.postDataJSON();
          openaiRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] OpenAI API Request captured:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse OpenAI request:', e);
        }
      }
    });

    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Select a GPT model (non-reasoning for speed)
    await operateQuickSettings(page, {
      model: /gpt-3\.5-turbo/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'What is 2+2?');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 30000 });

    // Verify API request was captured
    expect(openaiRequests.length).toBeGreaterThan(0);

    const request = openaiRequests[0];

    // Verify structure
    expect(request).toHaveProperty('input');
    expect(Array.isArray(request.input)).toBe(true);

    // The default system prompt should be in the input array as first message
    // OpenAI Responses API uses structured content format
    const systemMessage = request.input.find((msg: any) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toBeTruthy();
    expect(Array.isArray(systemMessage.content)).toBe(true);

    // Extract text from content array
    const textContent = systemMessage.content.find((c: any) => c.type === 'input_text');
    expect(textContent).toBeDefined();
    expect(textContent.text).toBeTruthy();
    expect(textContent.text.length).toBeGreaterThan(0);

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ System prompt present in OpenAI request');
      console.log('  System prompt:', textContent.text);
    }
  });

  test('should include custom conversation system prompt in OpenAI API request', async ({ page }) => {
    const openaiRequests: any[] = [];
    const customSystemPrompt = 'You are a mathematics expert. Provide precise numerical answers.';

    page.on('request', async (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        try {
          const postData = request.postDataJSON();
          openaiRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] OpenAI API Request with custom prompt:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse OpenAI request:', e);
        }
      }
    });

    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Change the conversation-level system prompt using helper
    await setConversationSystemPrompt(page, customSystemPrompt);

    // Select a GPT model
    await operateQuickSettings(page, {
      model: /gpt-3\.5-turbo/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'What is the square root of 144?');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 30000 });

    // Verify API request includes custom system prompt
    expect(openaiRequests.length).toBeGreaterThan(0);

    const request = openaiRequests[0];

    // Find system message in input array
    const systemMessage = request.input.find((msg: any) => msg.role === 'system');
    expect(systemMessage).toBeDefined();

    // Extract text from structured content
    const textContent = systemMessage.content.find((c: any) => c.type === 'input_text');
    expect(textContent).toBeDefined();
    expect(textContent.text).toBe(customSystemPrompt);

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ Custom conversation system prompt present in OpenAI request');
      console.log('  Expected:', customSystemPrompt);
      console.log('  Actual:', textContent.text);
    }
  });

  test('should send system prompt with reasoning models (GPT-5 nano)', async ({ page }) => {
    const openaiRequests: any[] = [];

    page.on('request', async (request) => {
      if (request.url().includes('api.openai.com/v1/responses')) {
        try {
          const postData = request.postDataJSON();
          openaiRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] OpenAI reasoning model request:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse OpenAI request:', e);
        }
      }
    });

    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');

    // Select a reasoning model
    await operateQuickSettings(page, {
      model: /gpt-5-nano/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'What is 2+2?');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 60000 });

    // Verify request structure
    expect(openaiRequests.length).toBeGreaterThan(0);

    const request = openaiRequests[0];

    // Verify system prompt is present
    const systemMessage = request.input.find((msg: any) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toBeTruthy();

    // Extract text from structured content
    const textContent = systemMessage.content.find((c: any) => c.type === 'input_text');
    expect(textContent).toBeDefined();
    expect(textContent.text).toBeTruthy();

    // Verify reasoning configuration (OpenAI Responses API format)
    expect(request).toHaveProperty('reasoning');
    expect(request.reasoning).toHaveProperty('effort');

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ System prompt present with reasoning model');
      console.log('  System prompt:', textContent.text);
      console.log('  Reasoning config:', request.reasoning);
    }
  });
});