/**
 * Migrated from tests-e2e/live/new-chat-preserves-input.spec.ts
 *
 * Tests draft persistence across conversation switches.
 * No real API calls needed — purely UI/state management.
 */

import { test, expect } from '@playwright/test';
import { seedAppState } from './mock-helpers';
import { debugInfo, debugErr, debugWarn } from '../debug-utils';

test.describe('New Chat Button Input Preservation Bug Tests', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppState(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  async function getChatInput(page: any) {
    const selectors = [
      () => page.getByRole('textbox', { name: /chat input/i }),
      () => page.locator('textarea[aria-label="Chat input"]').first(),
      () => page.locator('textarea[placeholder*="Type your message"]').first(),
      () => page.locator('textarea').first(),
    ];

    for (const selector of selectors) {
      const locator = await selector();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    throw new Error('Could not find chat input textbox');
  }

  async function selectConversation(page: any, index: number) {
    {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (await page.locator('.conversation').count() > 0) break;
        await page.waitForTimeout(200);
      }
    }

    const conversations = await page.locator('.conversation').all();
    if (conversations.length === 0) {
      throw new Error('No conversations found');
    }

    const targetIndex = Math.min(index, conversations.length - 1);
    await conversations[targetIndex].click({ force: true });

    await expect(page.getByRole('textbox', { name: /chat input/i })).toBeVisible();
  }

  async function getDraftForConversation(page: any, conversationId: string) {
    return await page.evaluate((id: string) => {
      return (window as any).drafts?.getDraft(id) || '';
    }, conversationId);
  }

  async function getCurrentConversationId(page: any) {
    return await page.evaluate(() => {
      const convs = (window as any).conversations || [];
      const chosenId = (window as any).chosenConversationId;

      if (chosenId === undefined || chosenId === null || convs.length === 0) {
        return null;
      }

      const safeId = Math.min(chosenId, convs.length - 1);
      return convs[safeId]?.id || null;
    });
  }

  async function getConversationCount(page: any) {
    return await page.evaluate(() => {
      const convs = (window as any).conversations;
      if (!convs) {
        return 0;
      }
      return Array.isArray(convs) ? convs.length : 0;
    });
  }

  test.describe('Basic New Chat Functionality', () => {
    test('TEST 1: Basic New Chat Button Preserves Input', async ({ page }) => {
      debugInfo('Starting Test 1: Basic New Chat Button Input Preservation');

      const input = await getChatInput(page);
      const testMessage = 'Important message XYZ that should be preserved';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);
      debugInfo('✓ Typed test message into input');

      await page.waitForTimeout(500);

      const originalConversationId = await getCurrentConversationId(page);
      debugInfo('✓ Original conversation ID:', { originalConversationId });

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await expect(newChatButton).toBeVisible();
      await newChatButton.click({ force: true });
      debugInfo('✓ Clicked New Chat button');

      await page.waitForTimeout(500);

      await selectConversation(page, 1);
      debugInfo('✓ Navigated back to original conversation');

      const currentInputValue = await input.inputValue();
      debugInfo('Current input value:', { currentInputValue });
      debugInfo('Expected input value:', { testMessage });

      await expect(input).toHaveValue(testMessage);

      debugInfo('✓ Input preservation verified');
    });

    test('TEST 2: Multiple Conversations Input Preservation', async ({ page }) => {
      debugInfo('Starting Test 2: Multiple Conversations Input Preservation');

      const newChatButton = page.getByRole('button', { name: /new conversation/i });

      await newChatButton.click({ force: true });
      await newChatButton.click({ force: true });

      debugInfo('✓ Created 3 conversations total');

      await selectConversation(page, 1);

      const input = await getChatInput(page);
      const middleMessage = 'Middle conversation text';
      await input.fill(middleMessage);
      debugInfo('✓ Added text to middle conversation');

      await selectConversation(page, 2);

      const firstMessage = 'First conversation text';
      await input.fill(firstMessage);
      debugInfo('✓ Added text to first conversation');

      await newChatButton.click({ force: true });
      debugInfo('✓ Created new chat while first conversation was active');

      await selectConversation(page, 3);
      const firstConvInput = await input.inputValue();
      debugInfo('First conversation input after new chat:', { firstConvInput });

      expect(firstConvInput).toBe(firstMessage);

      debugInfo('✓ First conversation text preserved');
    });
  });

  test.describe('New Chat vs Clear Chat Behavior', () => {
    test('TEST 3: New Chat vs Clear Chat Behavior Difference', async ({ page }) => {
      debugInfo('Starting Test 3: New Chat vs Clear Chat Behavior Comparison');

      const input = await getChatInput(page);

      const clearTestMessage = 'Test message for clear chat - should be cleared';
      await input.fill(clearTestMessage);
      debugInfo('✓ Added text for clear chat test');

      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await expect(clearButton).toBeVisible();
      await clearButton.click({ force: true });

      const clearedInput = await input.inputValue();
      expect(clearedInput).toBe('');
      debugInfo('✓ Clear Chat correctly cleared input');

      const newChatTestMessage = 'Test message for new chat - should be preserved';
      await input.fill(newChatTestMessage);
      debugInfo('✓ Added text for new chat test');

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click({ force: true });

      await selectConversation(page, 1);

      const preservedInput = await input.inputValue();
      debugInfo('Input after new chat:', { preservedInput });
      debugInfo('Expected input:', { newChatTestMessage });

      expect(preservedInput).toBe(newChatTestMessage);

      debugInfo('✓ New Chat correctly preserves input');
    });
  });

  test.describe('Draft System Integration', () => {
    test('TEST 4: Draft Persistence Through New Chat', async ({ page }) => {
      debugInfo('Starting Test 4: Draft Persistence Through New Chat');

      await page.waitForTimeout(500);

      let conversationId = await getCurrentConversationId(page);
      if (!conversationId) {
        const newChatButton = page.getByRole('button', { name: /new conversation/i });
        await newChatButton.click({ force: true });
        await page.waitForTimeout(500);
        conversationId = await getCurrentConversationId(page);
      }

      const input = await getChatInput(page);
      const draftMessage = 'Draft message that should persist';

      await input.fill(draftMessage);
      await page.waitForTimeout(600);
      debugInfo('✓ Typed message and waited for draft save');

      conversationId = await getCurrentConversationId(page);
      debugInfo('✓ Current conversation ID:', { conversationId });

      const savedDraft = await getDraftForConversation(page, conversationId);
      expect(savedDraft).toBe(draftMessage);
      debugInfo('✓ Draft was correctly saved');

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click({ force: true });
      await page.waitForTimeout(500);
      debugInfo('✓ Clicked New Chat button');

      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      const remainingDraft = await getDraftForConversation(page, conversationId);
      debugInfo('Draft after new chat:', { remainingDraft });
      debugInfo('Expected draft:', { draftMessage });

      const uiInput = await input.inputValue();
      debugInfo('UI input after return:', { uiInput });

      expect(remainingDraft).toBe(draftMessage);
      expect(uiInput).toBe(draftMessage);

      debugInfo('✓ Draft was correctly preserved');
    });
  });

  test.describe('Edge Cases', () => {
    test('TEST 5: Rapid New Chat Clicking', async ({ page }) => {
      debugInfo('Starting Test 5: Rapid New Chat Clicking');

      const input = await getChatInput(page);
      const rapidTestMessage = 'Message before rapid clicking';

      await input.fill(rapidTestMessage);
      await page.waitForTimeout(500);
      debugInfo('✓ Added text before rapid clicking');

      const initialCount = await getConversationCount(page);
      debugInfo('✓ Initial conversation count:', { initialCount });

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click({ force: true });
      await newChatButton.click({ force: true });
      await newChatButton.click({ force: true });
      await page.waitForTimeout(1000);
      debugInfo('✓ Clicked New Chat 3 times rapidly');

      const finalCount = await getConversationCount(page);
      expect(finalCount).toBe(initialCount + 3);
      debugInfo('✓ Confirmed 3 new conversations were created');

      await selectConversation(page, 3);
      await page.waitForTimeout(300);

      const finalInput = await input.inputValue();
      debugInfo('Input after rapid clicking:', { finalInput });
      debugInfo('Expected input:', { rapidTestMessage });

      expect(finalInput).toBe(rapidTestMessage);

      debugInfo('✓ Rapid clicking preserved original text');
    });

    test('TEST 6: Complex Text Preservation', async ({ page }) => {
      debugInfo('Starting Test 6: Complex Text Preservation');

      const input = await getChatInput(page);
      const complexMessage = `Multi-line message with:
- Special characters: !@#$%^&*()
- Emojis: 🚀🎉💻
- Unicode: αβγδε
- Newlines and spaces

This should all be preserved when creating a new chat.`;

      await input.fill(complexMessage);
      await page.waitForTimeout(500);
      debugInfo('✓ Added complex multi-line message');

      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click({ force: true });
      await page.waitForTimeout(500);

      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      const preservedText = await input.inputValue();
      debugInfo('Preserved text length:', { length: preservedText.length });
      debugInfo('Original text length:', { length: complexMessage.length });

      expect(preservedText).toBe(complexMessage);

      debugInfo('✓ Complex text was preserved');
    });
  });

  test.describe('Cross-Platform New Chat Buttons', () => {
    test('TEST 7: Topbar New Chat Button', async ({ page }) => {
      debugInfo('Starting Test 7: Topbar New Chat Button');

      const input = await getChatInput(page);
      const topbarTestMessage = 'Message for topbar new chat test';

      await input.fill(topbarTestMessage);
      await page.waitForTimeout(500);
      debugInfo('✓ Added text for topbar test');

      const topbarNewChat = page.locator('button:has(img[alt="+"])').first();
      if (await topbarNewChat.isVisible().catch(() => false)) {
        await topbarNewChat.click({ force: true });
        debugInfo('✓ Clicked topbar New Chat button');
      } else {
        const sidebarNewChat = page.getByRole('button', { name: /new conversation/i });
        await sidebarNewChat.click({ force: true });
        debugInfo('✓ Clicked sidebar New Chat button (topbar not visible)');
      }

      await page.waitForTimeout(500);

      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      const preservedText = await input.inputValue();
      debugInfo('Input after topbar new chat:', { preservedText });

      expect(preservedText).toBe(topbarTestMessage);

      debugInfo('✓ Topbar new chat preserved text');
    });
  });
});
