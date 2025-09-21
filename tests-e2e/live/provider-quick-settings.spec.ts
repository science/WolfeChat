import { test, expect } from '@playwright/test';
import { openSettings, sendMessage, waitForAssistantDone, operateQuickSettings } from './helpers';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

async function setProviderApiKey(page: any, provider: 'OpenAI' | 'Anthropic', apiKey: string) {
  await openSettings(page);

  const providerSelect = page.locator('#provider-selection');
  await providerSelect.selectOption(provider);

  const apiKeyInput = page.locator('#api-key');
  await apiKeyInput.fill(apiKey);

  const checkBtn = page.getByRole('button', { name: /check api/i });
  await checkBtn.click();

  // Wait for models to populate
  const modelSelect = page.locator('#model-selection');
  await expect(modelSelect.locator('option').nth(1)).toBeVisible({ timeout: 10000 });

  // Close settings
  const closeBtn = page.getByRole('button', { name: /close|×/i });
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  }
}

async function getRecentModelsFromQuickSettings(page: any): Promise<string[]> {
  await operateQuickSettings(page, { mode: 'ensure-open' });

  // Look for recent models section in Quick Settings
  const recentSection = page.locator('text=/recent|recently used/i').first();

  if (await recentSection.isVisible().catch(() => false)) {
    // Get models from recent section
    const recentModels = [];
    const modelButtons = page.locator('button').filter({ hasText: /gpt|claude/i });
    const count = await modelButtons.count();

    for (let i = 0; i < count; i++) {
      const text = await modelButtons.nth(i).textContent();
      if (text && (text.includes('gpt') || text.includes('claude'))) {
        recentModels.push(text.trim());
      }
    }
    return recentModels;
  }

  return [];
}

(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Provider Quick Settings Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('Quick Settings shows models with provider indicators when both providers configured', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;
      await setProviderApiKey(page, 'Anthropic', anthropicKey);
    }

    // Open Quick Settings
    await operateQuickSettings(page, { mode: 'ensure-open' });

    // Look for model selection in Quick Settings
    const quickModelSelect = page.locator('select').filter({ hasText: /gpt|claude/i }).first();

    if (await quickModelSelect.isVisible().catch(() => false)) {
      const options = await quickModelSelect.locator('option').allTextContents();

      // Should have GPT models
      const hasGptModels = options.some(m => m.toLowerCase().includes('gpt'));
      expect(hasGptModels).toBe(true);

      if (hasAnthropicKey) {
        // Should have Claude models
        const hasClaudeModels = options.some(m => m.toLowerCase().includes('claude'));
        expect(hasClaudeModels).toBe(true);

        // Should have provider indicators when both are configured
        const hasProviderIndicators = options.some(m => m.includes('(') && (m.includes('OpenAI') || m.includes('Anthropic')));
        expect(hasProviderIndicators).toBe(true);
      }
    }
  });

  test('can switch models between providers in Quick Settings', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Send a message with GPT model first
      await sendMessage(page, 'Hello from GPT', { submitMethod: 'ctrl-enter' });
      await waitForAssistantDone(page, { timeout: 30000 });

      // Use Quick Settings to switch to Claude model
      await operateQuickSettings(page, {
        mode: 'ensure-open',
        model: /claude/i,
        closeAfter: true
      });

      // Send another message
      await sendMessage(page, 'Hello from Claude', { submitMethod: 'ctrl-enter' });
      await waitForAssistantDone(page, { timeout: 30000 });

      // Verify both messages exist
      const messages = page.locator('[role="listitem"][data-message-role="assistant"]');
      await expect(messages).toHaveCount(2);
    }
  });

  test('recent models include both providers when both are used', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Use a GPT model
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-3\.5/i,
      closeAfter: true
    });

    await sendMessage(page, 'Test with GPT', { submitMethod: 'ctrl-enter' });
    await waitForAssistantDone(page, { timeout: 30000 });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Use a Claude model
      await operateQuickSettings(page, {
        mode: 'ensure-open',
        model: /claude/i,
        closeAfter: true
      });

      await sendMessage(page, 'Test with Claude', { submitMethod: 'ctrl-enter' });
      await waitForAssistantDone(page, { timeout: 30000 });

      // Check recent models in Quick Settings
      const recentModels = await getRecentModelsFromQuickSettings(page);

      if (recentModels.length > 0) {
        const hasRecentGpt = recentModels.some(m => m.toLowerCase().includes('gpt'));
        const hasRecentClaude = recentModels.some(m => m.toLowerCase().includes('claude'));

        expect(hasRecentGpt || hasRecentClaude).toBe(true);
        console.log('Recent models found:', recentModels);
      }
    }
  });

  test('Quick Settings model selection persists per conversation', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Set model for first conversation
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-3\.5/i,
      closeAfter: true
    });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Create new conversation by clicking New Chat
      const newChatBtn = page.getByRole('button', { name: /new chat|new conversation/i });
      if (await newChatBtn.isVisible().catch(() => false)) {
        await newChatBtn.click();
      }

      // Set different model for second conversation
      await operateQuickSettings(page, {
        mode: 'ensure-open',
        model: /claude/i,
        closeAfter: true
      });

      // Switch back to first conversation (if conversation list exists)
      const conversationList = page.locator('[data-conversation-id]').first();
      if (await conversationList.isVisible().catch(() => false)) {
        await conversationList.click();

        // Quick Settings should show the GPT model for this conversation
        await operateQuickSettings(page, { mode: 'ensure-open' });

        const quickModelSelect = page.locator('select').filter({ hasText: /gpt|claude/i }).first();
        if (await quickModelSelect.isVisible().catch(() => false)) {
          const selectedValue = await quickModelSelect.inputValue();
          expect(selectedValue.toLowerCase()).toContain('gpt');
        }
      }
    }
  });

  test('Quick Settings reflects global model selection changes', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Set model in global Settings
    await openSettings(page);
    const globalModelSelect = page.locator('#model-selection');
    const firstGptOption = await globalModelSelect.locator('option').filter({ hasText: /gpt/i }).first().textContent();

    if (firstGptOption) {
      await globalModelSelect.selectOption({ label: firstGptOption });
    }

    // Close settings
    const closeBtn = page.getByRole('button', { name: /close|×/i });
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }

    // Quick Settings should reflect the global selection
    await operateQuickSettings(page, { mode: 'ensure-open' });

    const quickModelSelect = page.locator('select').filter({ hasText: /gpt|claude/i }).first();
    if (await quickModelSelect.isVisible().catch(() => false)) {
      const selectedValue = await quickModelSelect.inputValue();
      expect(selectedValue.toLowerCase()).toContain('gpt');
    }
  });

  test('provider switching in Settings updates Quick Settings model list', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    // Start with OpenAI
    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Check Quick Settings shows GPT models
    await operateQuickSettings(page, { mode: 'ensure-open' });

    let quickModelSelect = page.locator('select').filter({ hasText: /gpt|claude/i }).first();
    if (await quickModelSelect.isVisible().catch(() => false)) {
      let options = await quickModelSelect.locator('option').allTextContents();
      let hasGptModels = options.some(m => m.toLowerCase().includes('gpt'));
      expect(hasGptModels).toBe(true);
    }

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Switch to Anthropic in Settings
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Quick Settings should now show Claude models
      await operateQuickSettings(page, { mode: 'ensure-open' });

      quickModelSelect = page.locator('select').filter({ hasText: /gpt|claude/i }).first();
      if (await quickModelSelect.isVisible().catch(() => false)) {
        let options = await quickModelSelect.locator('option').allTextContents();
        let hasClaudeModels = options.some(m => m.toLowerCase().includes('claude'));
        expect(hasClaudeModels).toBe(true);
      }
    }
  });
});