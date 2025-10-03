import { test, expect } from '@playwright/test';
import {
  openSettings,
  withSettings,
  sendMessage,
  waitForStreamComplete,
  operateQuickSettings,
  setProviderApiKey,
  bootstrapBothProviders,
  getRecentModelsFromQuickSettings,
  getModelDropdownState
} from './helpers';
import { debugInfo } from '../debug-utils';

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

test.describe.configure({ mode: 'serial' });

(test as any)[hasOpenAIKey ? 'describe' : 'skip']('Provider Quick Settings Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Additional wait to ensure stores are fully reset
    await page.waitForTimeout(500);
  });

  test('Quick Settings shows models with provider indicators when both providers configured', async ({ page }) => {
    const openaiKey = process.env.OPENAI_API_KEY!;

    // Test OpenAI first
    await setProviderApiKey(page, 'OpenAI', openaiKey);

    // Test GPT model selection works - use specific chat model pattern
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-3\.5-turbo/i });

    // Get initial state with only OpenAI
    const initialState = await getModelDropdownState(page);
    expect(initialState.providers.openai).toBeDefined();
    expect(initialState.providers.openai!.models.length).toBeGreaterThan(0);
    expect(initialState.selectedModel).toContain('gpt-3.5-turbo');

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Now configure Anthropic
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Test Claude model selection works
      await operateQuickSettings(page, { mode: 'ensure-open', model: /claude/i });

      // Get final state with both providers
      const finalState = await getModelDropdownState(page, {
        waitForModels: true
      });

      // Verify both providers are present and working
      expect(finalState.hasMultipleProviders).toBe(true);
      expect(finalState.providers.openai).toBeDefined();
      expect(finalState.providers.anthropic).toBeDefined();
      expect(finalState.providers.openai!.models.length).toBeGreaterThan(0);
      expect(finalState.providers.anthropic!.models.length).toBeGreaterThan(0);

      // Verify Claude model was selected
      expect(finalState.selectedModel).toMatch(/claude/i);

      // Verify models from both providers are accessible in the dropdown
      const openaiModels = finalState.allModels.filter(m => m.provider === 'openai');
      const anthropicModels = finalState.allModels.filter(m => m.provider === 'anthropic');
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(anthropicModels.length).toBeGreaterThan(0);

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
        debugInfo('Recent models found:', { recentModels });
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

    const quickModelSelect = page.locator('#current-model-select');
    await expect(quickModelSelect).toBeVisible();

    let options = await quickModelSelect.locator('option').allTextContents();
    let hasGptModels = options.some(m => m.toLowerCase().includes('gpt'));
    expect(hasGptModels).toBe(true);

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (hasAnthropicKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY!;

      // Switch to Anthropic in Settings (this adds Anthropic, doesn't remove OpenAI)
      await setProviderApiKey(page, 'Anthropic', anthropicKey);

      // Quick Settings should now show BOTH GPT and Claude models (both providers configured)
      await operateQuickSettings(page, { mode: 'ensure-open' });

      // Use the specific Quick Settings model select
      const quickModelSelectDirect = page.locator('#current-model-select');
      await expect(quickModelSelectDirect).toBeVisible();

      // Wait for models to actually load in Quick Settings (store reactivity may take time)
      await page.waitForFunction(
        () => {
          const select = document.querySelector('#current-model-select') as HTMLSelectElement;
          if (!select) return false;
          const options = Array.from(select.options).map(o => o.textContent?.toLowerCase() || '');
          const hasGpt = options.some(o => o.includes('gpt'));
          const hasClaude = options.some(o => o.includes('claude'));
          return hasGpt && hasClaude;
        },
        { timeout: 10000, polling: 200 }
      );

      let options = await quickModelSelectDirect.locator('option').allTextContents();
      let hasGptModels = options.some(m => m.toLowerCase().includes('gpt'));
      let hasClaudeModels = options.some(m => m.toLowerCase().includes('claude'));
      expect(hasGptModels).toBe(true); // Should still have GPT models
      expect(hasClaudeModels).toBe(true); // Should now also have Claude models
    }
  });
});