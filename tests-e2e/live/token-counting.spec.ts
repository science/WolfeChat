import { test, expect } from '@playwright/test';
import {
  bootstrapLiveAPI,
  bootstrapBothProviders,
  sendMessage,
  waitForAssistantDone,
  operateQuickSettings,
  enableTokenDisplay,
  getTokenCount,
  TEST_MODEL_REGEX
} from './helpers';
import { REASONING_OFF, REASONING_LIGHT } from '../../src/tests/testModel';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Token Counting - OpenAI', () => {
  test('should count tokens correctly for TEST_MODEL with reasoning', async ({ page }) => {
    test.setTimeout(120000);

    // Enable token display via localStorage BEFORE navigating
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('show_tokens', 'true'));
    await page.reload(); // Reload to pick up localStorage change

    await bootstrapLiveAPI(page, 'OpenAI');

    // Select TEST_MODEL with LIGHT (medium) reasoning effort
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: TEST_MODEL_REGEX,
      reasoningEffort: REASONING_LIGHT,
      verbosity: 'medium',
      closeAfter: true
    });

    // Send a message that will generate reasoning tokens
    await sendMessage(page, 'What is 2+2? Think step by step.');

    // Wait for response to complete
    await waitForAssistantDone(page, { timeout: 90000 });

    // Get the token count from the sidebar
    const tokenCount = await getTokenCount(page);

    // For reasoning models, token usage varies based on model behavior:
    // - Input tokens (system prompt + user message): ~50-100 tokens
    // - Reasoning tokens (model-dependent): may be 0-2000+ tokens
    // - Output tokens: 50-500+ tokens
    // The bug would show only ~5-10 tokens (first SSE chunk only)
    // If token counting works, we should see > 30 tokens
    expect(tokenCount).toBeGreaterThan(30);

    console.log(`✓ Token count for TEST_MODEL with reasoning: ${tokenCount} tokens`);
  });

  test('should count tokens correctly for TEST_MODEL without reasoning', async ({ page }) => {
    test.setTimeout(120000);

    // Enable token display via localStorage BEFORE navigating
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('show_tokens', 'true'));
    await page.reload(); // Reload to pick up localStorage change

    await bootstrapLiveAPI(page, 'OpenAI');

    // TEST_MODEL with reasoning OFF — same model as the reasoning test above,
    // but effort='none' suppresses reasoning events (observationally equivalent
    // to a non-reasoning model for anything the token-count assertion checks).
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: TEST_MODEL_REGEX,
      reasoningEffort: REASONING_OFF,
      closeAfter: true
    });

    // Send a simple message
    await sendMessage(page, 'Say hello in exactly 3 words');

    await waitForAssistantDone(page, { timeout: 60000 });

    // Get the token count
    const tokenCount = await getTokenCount(page);

    // For a simple non-reasoning message:
    // - Input tokens (system + user): ~20-40 tokens
    // - Output tokens: ~10-20 tokens
    // Total should be at least 30 tokens

    // If the bug is present, we'd see ~5-15 tokens (first chunk only)
    // If fixed, we should see 30+ tokens
    expect(tokenCount).toBeGreaterThan(30);

    console.log(`✓ Token count for TEST_MODEL no reasoning: ${tokenCount} tokens`);
  });
});

(test as any)[hasAnthropicKey ? 'describe' : 'skip']('Token Counting - Anthropic', () => {
  test('should count tokens correctly for Claude Haiku', async ({ page }) => {
    test.setTimeout(120000);

    // Enable token display via localStorage BEFORE navigating
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('show_tokens', 'true'));
    await page.reload(); // Reload to pick up localStorage change

    await bootstrapBothProviders(page);

    // Select Claude Haiku
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-3-haiku-20240307/i,
      closeAfter: true
    });

    // Send a simple message
    await sendMessage(page, 'Say hello in exactly 3 words');

    await waitForAssistantDone(page, { timeout: 60000 });

    // Get the token count
    const tokenCount = await getTokenCount(page);

    // For Claude with a simple message:
    // - Input tokens: ~20-40 tokens
    // - Output tokens: ~10-20 tokens
    // Total should be at least 30 tokens
    expect(tokenCount).toBeGreaterThan(30);

    console.log(`✓ Token count for Claude Haiku: ${tokenCount} tokens`);
  });

  test('should count tokens correctly for Claude Sonnet with reasoning', async ({ page }) => {
    test.setTimeout(120000);

    // Enable token display via localStorage BEFORE navigating.
    // Also disable auto title generation — title-gen fires a parallel Anthropic
    // request using the conversation's model, and under load that can pull
    // completion signals forward before the main reasoning stream has finished,
    // leaving tokenCount at 0 even though the main stream will eventually finish.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('show_tokens', 'true');
      localStorage.setItem('title_generation_enabled', 'false');
    });
    await page.reload();

    await bootstrapBothProviders(page);

    // Select Claude Sonnet 4.5 (reasoning model)
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /claude-sonnet-4-5-20250929/i,
      closeAfter: true
    });

    // Send a message that will generate reasoning
    await sendMessage(page, 'Explain the Monte Hall problem using logic');

    await waitForAssistantDone(page, { timeout: 60000 });

    // Extra settle: Claude Sonnet reasoning streams continue after the UI completion
    // signals fire, but token counting only happens on stream 'done'. Poll up to 30s
    // for a non-zero count to land, rather than reading immediately.
    let tokenCount = 0;
    const tokenDeadline = Date.now() + 30000;
    while (Date.now() < tokenDeadline) {
      tokenCount = await getTokenCount(page);
      if (tokenCount > 0) break;
      await page.waitForTimeout(500);
    }

    // For Claude Sonnet with reasoning:
    // - Input tokens: ~30-50 tokens
    // - Output tokens: 50-400 tokens
    // Note: Thinking/reasoning tokens may not be included in conversationTokens
    // depending on the Anthropic response format. The key check is that token
    // counting works at all (non-zero), not the exact magnitude.
    expect(tokenCount).toBeGreaterThan(50);

    console.log(`✓ Token count for Claude Sonnet (reasoning): ${tokenCount} tokens`);
  });
});
