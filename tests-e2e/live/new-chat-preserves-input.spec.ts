import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI } from './helpers';

const hasKey = !!process.env.OPENAI_API_KEY;

(test as any)[hasKey ? 'describe' : 'skip']('New Chat Button Input Preservation Bug Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await bootstrapLiveAPI(page);
  });

  /**
   * Helper function to get the chat input textbox using multiple fallback strategies
   */
  async function getChatInput(page: any) {
    const selectors = [
      () => page.getByRole('textbox', { name: /chat input/i }),
      () => page.locator('textarea[aria-label="Chat input"]').first(),
      () => page.locator('textarea[placeholder*="Type your message"]').first(),
      () => page.locator('textarea').first(), // Fallback to first textarea
    ];

    for (const selector of selectors) {
      const locator = await selector();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    throw new Error('Could not find chat input textbox');
  }

  /**
   * Helper function to get the currently selected conversation index
   */
  async function getCurrentConversationIndex(page: any) {
    return await page.evaluate(() => {
      return (window as any).chosenConversationId || 0;
    });
  }

  /**
   * Helper function to navigate to a specific conversation by clicking it
   */
  async function selectConversation(page: any, index: number) {
    // Wait for conversations to be visible
    await page.waitForSelector('.conversation', { timeout: 5000 });

    // Get all conversation elements (they're in reverse order in the UI)
    const conversations = await page.locator('.conversation').all();
    if (conversations.length === 0) {
      throw new Error('No conversations found');
    }

    // Click the conversation at the given index (accounting for reverse order)
    const targetIndex = Math.min(index, conversations.length - 1);
    await conversations[targetIndex].click();

    // Wait a moment for the conversation to be selected
    await page.waitForTimeout(300);
  }

  /**
   * Helper function to get draft for a conversation
   */
  async function getDraftForConversation(page: any, conversationId: string) {
    return await page.evaluate((id) => {
      return (window as any).drafts?.getDraft(id) || '';
    }, conversationId);
  }

  /**
   * Helper function to get the current conversation ID
   */
  async function getCurrentConversationId(page: any) {
    return await page.evaluate(() => {
      const convs = (window as any).conversations || [];
      const chosenId = (window as any).chosenConversationId;

      // Handle case where chosenId might be undefined or null
      if (chosenId === undefined || chosenId === null || convs.length === 0) {
        return null;
      }

      // Ensure chosenId is within bounds
      const safeId = Math.min(chosenId, convs.length - 1);
      return convs[safeId]?.id || null;
    });
  }

  /**
   * Helper function to count total conversations
   */
  async function getConversationCount(page: any) {
    return await page.evaluate(() => {
      // Add error handling and logging
      const convs = (window as any).conversations;
      if (!convs) {
        console.warn('conversations not exposed to window');
        return 0;
      }
      return Array.isArray(convs) ? convs.length : 0;
    });
  }

  test.describe('Basic New Chat Functionality', () => {
    test('TEST 1: Basic New Chat Button Preserves Input ', async ({ page }) => {
      console.log('Starting Test 1: Basic New Chat Button Input Preservation');

      // Arrange: Type text in the current conversation's input
      const input = await getChatInput(page);
      const testMessage = 'Important message XYZ that should be preserved';
      await input.fill(testMessage);
      await expect(input).toHaveValue(testMessage);
      console.log('✓ Typed test message into input');

      // Wait for draft to be saved (300ms + buffer)
      await page.waitForTimeout(500);

      // Get the current conversation ID before creating new chat
      const originalConversationId = await getCurrentConversationId(page);
      console.log('✓ Original conversation ID:', originalConversationId);

      // Act: Click the "New Chat" button in sidebar
      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await expect(newChatButton).toBeVisible();
      await newChatButton.click();
      console.log('✓ Clicked New Chat button');

      // Wait for new conversation to be created
      await page.waitForTimeout(500);

      // Navigate back to the original conversation
      await selectConversation(page, 1); // Original conversation should be at index 1 now
      console.log('✓ Navigated back to original conversation');

      // Wait for conversation switch to complete
      await page.waitForTimeout(300);

      // Assert: The input should still contain the original message
      // The input should contain the original message
      const currentInputValue = await input.inputValue();
      console.log('Current input value:', `"${currentInputValue}"`);
      console.log('Expected input value:', `"${testMessage}"`);

      // Verify the message was preserved
      await expect(input).toHaveValue(testMessage);

      console.log('✓ Input preservation verified');
    });

    test('TEST 2: Multiple Conversations Input Preservation ', async ({ page }) => {
      console.log('Starting Test 2: Multiple Conversations Input Preservation');

      // Create multiple conversations
      const newChatButton = page.getByRole('button', { name: /new conversation/i });

      // Click new chat twice to create 3 total conversations
      await newChatButton.click();
      await page.waitForTimeout(300);
      await newChatButton.click();
      await page.waitForTimeout(300);

      console.log('✓ Created 3 conversations total');

      // Navigate to middle conversation (index 1)
      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      // Type in middle conversation
      const input = await getChatInput(page);
      const middleMessage = 'Middle conversation text';
      await input.fill(middleMessage);
      await page.waitForTimeout(500); // Wait for draft save
      console.log('✓ Added text to middle conversation');

      // Navigate to first conversation (index 2, due to reverse order)
      await selectConversation(page, 2);
      await page.waitForTimeout(300);

      // Type in first conversation
      const firstMessage = 'First conversation text';
      await input.fill(firstMessage);
      await page.waitForTimeout(500); // Wait for draft save
      console.log('✓ Added text to first conversation');

      // With first conversation active, click "New Chat"
      await newChatButton.click();
      await page.waitForTimeout(500);
      console.log('✓ Created new chat while first conversation was active');

      // Check all original conversations
      // First conversation (now at index 3) should have its text preserved but won't due to bug
      await selectConversation(page, 3);
      await page.waitForTimeout(300);
      const firstConvInput = await input.inputValue();
      console.log('First conversation input after new chat:', `"${firstConvInput}"`);

      // first conversation text should be preserved
      expect(firstConvInput).toBe(firstMessage);

      console.log('✓ First conversation text preserved');
    });
  });

  test.describe('New Chat vs Clear Chat Behavior', () => {
    test('TEST 3: New Chat vs Clear Chat Behavior Difference ', async ({ page }) => {
      console.log('Starting Test 3: New Chat vs Clear Chat Behavior Comparison');

      const input = await getChatInput(page);

      // Test Clear Chat behavior first (this should work correctly)
      const clearTestMessage = 'Test message for clear chat - should be cleared';
      await input.fill(clearTestMessage);
      await page.waitForTimeout(500);
      console.log('✓ Added text for clear chat test');

      // Click Clear Chat button
      const clearButton = page.locator('button[aria-label="Clear Conversation"]').first();
      await expect(clearButton).toBeVisible();
      await clearButton.click();
      await page.waitForTimeout(300);

      // Verify clear chat correctly cleared the input
      const clearedInput = await input.inputValue();
      expect(clearedInput).toBe('');
      console.log('✓ Clear Chat correctly cleared input');

      // Now test New Chat behavior
      // Add text to a conversation
      const newChatTestMessage = 'Test message for new chat - should be preserved';
      await input.fill(newChatTestMessage);
      await page.waitForTimeout(500);
      console.log('✓ Added text for new chat test');

      // Click New Chat button
      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click();
      await page.waitForTimeout(500);

      // Navigate back to the previous conversation
      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      // Check if text is preserved (it won't be due to the bug)
      const preservedInput = await input.inputValue();
      console.log('Input after new chat:', `"${preservedInput}"`);
      console.log('Expected input:', `"${newChatTestMessage}"`);

      // new chat should preserve input unlike clear chat
      expect(preservedInput).toBe(newChatTestMessage);

      console.log('✓ New Chat correctly preserves input');
    });
  });

  test.describe('Draft System Integration', () => {
    test('TEST 4: Draft Persistence Through New Chat ', async ({ page }) => {
      console.log('Starting Test 4: Draft Persistence Through New Chat');

      // Wait for app to initialize and ensure we have a conversation
      await page.waitForTimeout(500);

      // Check if we have a conversation, if not create one
      let conversationId = await getCurrentConversationId(page);
      if (!conversationId) {
        // Click new chat to create first conversation
        const newChatButton = page.getByRole('button', { name: /new conversation/i });
        await newChatButton.click();
        await page.waitForTimeout(500);
        conversationId = await getCurrentConversationId(page);
      }

      const input = await getChatInput(page);
      const draftMessage = 'Draft message that should persist';

      // Type message and ensure draft is saved
      await input.fill(draftMessage);
      await page.waitForTimeout(600); // Wait longer for draft save
      console.log('✓ Typed message and waited for draft save');

      // Get current conversation ID for draft checking (refresh it)
      conversationId = await getCurrentConversationId(page);
      console.log('✓ Current conversation ID:', conversationId);

      // Verify draft was saved
      const savedDraft = await getDraftForConversation(page, conversationId);
      expect(savedDraft).toBe(draftMessage);
      console.log('✓ Draft was correctly saved');

      // Click "New Chat"
      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click();
      await page.waitForTimeout(500);
      console.log('✓ Clicked New Chat button');

      // Return to original conversation
      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      // Check if draft is still preserved
      const remainingDraft = await getDraftForConversation(page, conversationId);
      console.log('Draft after new chat:', `"${remainingDraft}"`);
      console.log('Expected draft:', `"${draftMessage}"`);

      // Check both UI and internal draft store
      const uiInput = await input.inputValue();
      console.log('UI input after return:', `"${uiInput}"`);

      // Both should contain the original message
      expect(remainingDraft).toBe(draftMessage);
      expect(uiInput).toBe(draftMessage);

      console.log('✓ Draft was correctly preserved');
    });
  });

  test.describe('Edge Cases', () => {
    test('TEST 5: Rapid New Chat Clicking ', async ({ page }) => {
      console.log('Starting Test 5: Rapid New Chat Clicking');

      const input = await getChatInput(page);
      const rapidTestMessage = 'Message before rapid clicking';

      // Type text in current conversation
      await input.fill(rapidTestMessage);
      await page.waitForTimeout(500);
      console.log('✓ Added text before rapid clicking');

      // Get initial conversation count
      const initialCount = await getConversationCount(page);
      console.log('✓ Initial conversation count:', initialCount);

      // Click "New Chat" multiple times rapidly
      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click();
      await newChatButton.click();
      await newChatButton.click();
      await page.waitForTimeout(1000); // Wait for all operations to complete
      console.log('✓ Clicked New Chat 3 times rapidly');

      // Verify multiple conversations were created
      const finalCount = await getConversationCount(page);
      expect(finalCount).toBe(initialCount + 3);
      console.log('✓ Confirmed 3 new conversations were created');

      // Navigate back to original conversation (should be at index 3 now)
      await selectConversation(page, 3);
      await page.waitForTimeout(300);

      // Verify original text is preserved
      const finalInput = await input.inputValue();
      console.log('Input after rapid clicking:', `"${finalInput}"`);
      console.log('Expected input:', `"${rapidTestMessage}"`);

      // rapid clicking should still preserve the first conversation's text
      expect(finalInput).toBe(rapidTestMessage);

      console.log('✓ Rapid clicking preserved original text');
    });

    test('TEST 6: Complex Text Preservation ', async ({ page }) => {
      console.log('Starting Test 6: Complex Text Preservation');

      const input = await getChatInput(page);
      const complexMessage = `Multi-line message with:
- Special characters: !@#$%^&*()
- Emojis: 🚀🎉💻
- Unicode: αβγδε
- Newlines and spaces

This should all be preserved when creating a new chat.`;

      // Type complex message
      await input.fill(complexMessage);
      await page.waitForTimeout(500);
      console.log('✓ Added complex multi-line message');

      // Create new chat
      const newChatButton = page.getByRole('button', { name: /new conversation/i });
      await newChatButton.click();
      await page.waitForTimeout(500);

      // Return to original conversation
      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      // Check preservation of complex text
      const preservedText = await input.inputValue();
      console.log('Preserved text length:', preservedText.length);
      console.log('Original text length:', complexMessage.length);

      // complex text should be preserved
      expect(preservedText).toBe(complexMessage);

      console.log('✓ Complex text was preserved');
    });
  });

  test.describe('Cross-Platform New Chat Buttons', () => {
    test('TEST 7: Topbar New Chat Button ', async ({ page }) => {
      console.log('Starting Test 7: Topbar New Chat Button');

      const input = await getChatInput(page);
      const topbarTestMessage = 'Message for topbar new chat test';

      // Type message
      await input.fill(topbarTestMessage);
      await page.waitForTimeout(500);
      console.log('✓ Added text for topbar test');

      // Click New Chat button in topbar (if visible)
      const topbarNewChat = page.locator('button:has(img[alt="+"])').first();
      if (await topbarNewChat.isVisible().catch(() => false)) {
        await topbarNewChat.click();
        console.log('✓ Clicked topbar New Chat button');
      } else {
        // Fallback to sidebar button
        const sidebarNewChat = page.getByRole('button', { name: /new conversation/i });
        await sidebarNewChat.click();
        console.log('✓ Clicked sidebar New Chat button (topbar not visible)');
      }

      await page.waitForTimeout(500);

      // Return to original conversation
      await selectConversation(page, 1);
      await page.waitForTimeout(300);

      // Check preservation
      const preservedText = await input.inputValue();
      console.log('Input after topbar new chat:', `"${preservedText}"`);

      // Text should be preserved
      expect(preservedText).toBe(topbarTestMessage);

      console.log('✓ Topbar new chat preserved text');
    });
  });
});