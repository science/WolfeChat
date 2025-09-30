/**
 * E2E Test: Anthropic System Prompt Integration
 *
 * Verifies that system prompts (both default and custom) are correctly
 * sent to the Anthropic API via the SDK integration.
 *
 * TDD Test - Written before implementation fix
 */

import { test, expect } from '@playwright/test';
import {
  bootstrapBothProviders,
  operateQuickSettings,
  sendMessage,
  waitForAssistantDone,
  setConversationSystemPrompt
} from './helpers';

test.describe('Anthropic System Prompt Integration', () => {

  test('should include default system prompt in Anthropic API request', async ({ page }) => {
    // Capture API requests to Anthropic
    const anthropicRequests: any[] = [];

    page.on('request', async (request) => {
      if (request.url().includes('api.anthropic.com/v1/messages')) {
        try {
          const postData = request.postDataJSON();
          anthropicRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] Anthropic API Request captured:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse Anthropic request:', e);
        }
      }
    });

    // Setup API keys
    await page.goto('/');
    await bootstrapBothProviders(page);

    // Select Claude model
    await operateQuickSettings(page, {
      model: /claude-3-haiku-20240307/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'Think hard about Why Ruby is loved by many, but losing the adoption wars.');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 30000 });

    // Verify API request was captured
    expect(anthropicRequests.length).toBeGreaterThan(0);

    const request = anthropicRequests[0];

    // Verify structure
    expect(request).toHaveProperty('model');
    expect(request).toHaveProperty('messages');
    expect(request.messages).toBeInstanceOf(Array);

    // CRITICAL: Verify system prompt is present
    // The default system prompt should be included
    expect(request).toHaveProperty('system');
    expect(typeof request.system).toBe('string');
    expect(request.system.length).toBeGreaterThan(0);

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ System prompt present in Anthropic request');
      console.log('  System prompt:', request.system);
    }
  });

  test('should include custom conversation system prompt in Anthropic API request', async ({ page }) => {
    const anthropicRequests: any[] = [];
    const customSystemPrompt = 'You are a Ruby programming expert. Provide detailed technical analysis.';

    page.on('request', async (request) => {
      if (request.url().includes('api.anthropic.com/v1/messages')) {
        try {
          const postData = request.postDataJSON();
          anthropicRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] Anthropic API Request with custom prompt:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse Anthropic request:', e);
        }
      }
    });

    await page.goto('/');
    await bootstrapBothProviders(page);

    // Change the conversation-level system prompt using helper
    await setConversationSystemPrompt(page, customSystemPrompt);

    // Select Claude model
    await operateQuickSettings(page, {
      model: /claude-3-haiku-20240307/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'Explain Ruby metaprogramming');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 30000 });

    // Verify API request includes custom system prompt
    expect(anthropicRequests.length).toBeGreaterThan(0);

    const request = anthropicRequests[0];

    // Verify custom system prompt is present
    expect(request).toHaveProperty('system');
    expect(request.system).toBe(customSystemPrompt);

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ Custom conversation system prompt present in Anthropic request');
      console.log('  Expected:', customSystemPrompt);
      console.log('  Actual:', request.system);
    }
  });

  test('should send system prompt with reasoning models (Claude Sonnet 4)', async ({ page }) => {
    const anthropicRequests: any[] = [];

    page.on('request', async (request) => {
      if (request.url().includes('api.anthropic.com/v1/messages')) {
        try {
          const postData = request.postDataJSON();
          anthropicRequests.push(postData);

          if (process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
            console.log('[DEBUG] Anthropic reasoning model request:', JSON.stringify(postData, null, 2));
          }
        } catch (e) {
          console.error('Failed to parse Anthropic request:', e);
        }
      }
    });

    await page.goto('/');
    await bootstrapBothProviders(page);

    // Select Claude Sonnet 4 (reasoning model)
    await operateQuickSettings(page, {
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true
    });

    // Send a message
    await sendMessage(page, 'What is 2+2?');

    // Wait for response
    await waitForAssistantDone(page, { timeout: 60000 });

    // Verify request structure
    expect(anthropicRequests.length).toBeGreaterThan(0);

    const request = anthropicRequests[0];

    // Verify system prompt is present
    expect(request).toHaveProperty('system');
    expect(request.system).toBeTruthy();

    // Verify thinking configuration for reasoning model
    expect(request).toHaveProperty('thinking');
    expect(request.thinking).toHaveProperty('type', 'enabled');
    expect(request.thinking).toHaveProperty('budget_tokens');

    if (process.env.DEBUG_E2E === '1' || process.env.DEBUG_E2E === '2' || process.env.DEBUG_E2E === '3') {
      console.log('✓ System prompt present with reasoning model');
      console.log('  System prompt:', request.system);
      console.log('  Thinking config:', request.thinking);
    }
  });
});