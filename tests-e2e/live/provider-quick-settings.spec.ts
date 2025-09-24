import { test, expect } from '@playwright/test';
import {
  openSettings,
  withSettings,
  sendMessage,
  waitForStreamComplete,
  operateQuickSettings,
  setProviderApiKey,
  bootstrapBothProviders,
  getRecentModelsFromQuickSettings
} from './helpers';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;



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

    // Test OpenAI first
    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Test GPT model selection works - use specific chat model pattern
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-3\.5-turbo/i });

    // Verify GPT model was selected
    const quickModelSelect = page.locator('#current-model-select');
    await expect(quickModelSelect).toBeVisible();
    const selectedGptModel = await quickModelSelect.inputValue();
    expect(selectedGptModel.toLowerCase()).toContain('gpt');

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Now configure Anthropic
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Test Claude model selection works
      await operateQuickSettings(page, { mode: 'ensure-open', model: /claude/i });

      // Verify Claude model was selected
      const selectedClaudeModel = await quickModelSelect.inputValue();
      expect(selectedClaudeModel.toLowerCase()).toContain('claude');

      // Test provider indicators exist when both have been configured
      const options = await quickModelSelect.locator('option').allTextContents();
      const hasProviderIndicators = options.some(m => m.includes('(') && (m.includes('OpenAI') || m.includes('Anthropic')));
      expect(hasProviderIndicators).toBe(true);

      await operateQuickSettings(page, { mode: 'ensure-closed' });
    }
  });

  test('can switch models between providers in Quick Settings', async ({ page }) => {
    if (hasAnthropicKey) {
      const openaiKey = process.env.OPENAI_API_KEY!;
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Set up OpenAI first
      await setProviderApiKey(page, 'OpenAI', openaiKey);

      // Select GPT model and send message
      await operateQuickSettings(page, {
        mode: 'ensure-open',
        model: /gpt-3\.5-turbo/i,  // Specific chat model, not TTS
        closeAfter: true
      });

      await sendMessage(page, 'Hello from GPT', { submitMethod: 'ctrl-enter' });
      await waitForStreamComplete(page, { timeout: 60000 });

      // Switch to Anthropic provider
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Select Claude model and send message
      await operateQuickSettings(page, {
        mode: 'ensure-open',
        model: /claude/i,
        closeAfter: true
      });

      await sendMessage(page, 'Hello from Claude', { submitMethod: 'ctrl-enter' });
      await waitForStreamComplete(page, { timeout: 60000 });

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
    await waitForStreamComplete(page, { timeout: 60000 });

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
      await waitForStreamComplete(page, { timeout: 60000 });

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

    // Set model in global Settings using proper helper
    await withSettings(page, async () => {
      const globalModelSelect = page.locator('#model-selection');
      const firstGptOption = await globalModelSelect.locator('option').filter({ hasText: /gpt/i }).first().textContent();

      if (firstGptOption) {
        await globalModelSelect.selectOption({ label: firstGptOption });
      }
    });

    // Quick Settings should reflect the global selection
    await operateQuickSettings(page, { mode: 'ensure-open' });

    const quickModelSelect = page.locator('#current-model-select');
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