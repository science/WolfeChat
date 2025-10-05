import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings, sendMessage, waitForAssistantDone } from './helpers';
import { debugInfo } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Title Update', () => {
  test.setTimeout(60000);

  test('conversation title updates after first message', async ({ page }) => {
    await page.goto(APP_URL);
    
    // Bootstrap API key and wait for models to load
    await bootstrapLiveAPI(page);
    
    // Select a reasoning model
    await selectReasoningModelInQuickSettings(page);

    // Create new conversation - look for "New Chat" button or similar
    const newChatBtn = page.getByRole('button', { name: /new chat|new conversation|add conversation/i }).first();
    if (await newChatBtn.isVisible().catch(() => false)) {
      await newChatBtn.click();
      // Wait a moment for new conversation to be created
      await page.waitForTimeout(500);
    }

    // Look for the currently selected conversation in the sidebar
    // Based on Sidebar.svelte, the selected conversation has 'bg-hover2' class
    const selectedConversation = page.locator('.title-container.conversation').filter({ hasText: /New conversation|Brief Response|./ }).first();
    const titleText = selectedConversation.locator('.title-text');
    
    // Wait for the sidebar to be visible
    await expect(selectedConversation).toBeVisible({ timeout: 10000 });
    
    // Get initial title
    const initialTitle = (await titleText.textContent() || '').trim().toLowerCase();
    
    // Initial title should be "New conversation"
    expect(initialTitle).toBe('new conversation');

    // Set up title change monitoring before sending message
    // Inject a store subscriber to detect title changes
    await page.evaluate(() => {
      return new Promise((resolve) => {
        // Set up monitoring for title updates
        (window as any).__titleUpdatePromise = new Promise((titleResolve) => {
          // Import conversations store and set up subscriber
          import('/src/stores/stores.js').then((stores) => {
            const { conversations } = stores;
            let initialTitle = '';
            
            // Get initial title state
            const unsubscribe = conversations.subscribe((convs: any[]) => {
              const currentConv = convs[0]; // Assuming first conversation
              if (currentConv) {
                if (!initialTitle && currentConv.title === '') {
                  initialTitle = '';
                } else if (initialTitle === '' && currentConv.title && currentConv.title !== 'New conversation') {
                  // Title was updated!
                  unsubscribe();
                  titleResolve(currentConv.title);
                }
              }
            });
            
            // Set up timeout
            setTimeout(() => {
              unsubscribe();
              titleResolve(null);
            }, 45000);
          }).catch(() => {
            titleResolve(null);
          });
        });
        
        resolve(undefined);
      });
    });

    // Send a message that should trigger title generation
    const testMessage = 'Please answer briefly. Then the app should generate a short title summarizing this new chat.';
    await sendMessage(page, testMessage, { submitMethod: 'ctrl-enter' });

    // Wait for assistant response to complete
    await waitForAssistantDone(page, { timeout: 45000 });

    // Wait for title update from store subscriber or fall back to DOM polling
    let updatedTitle = await page.evaluate(() => (window as any).__titleUpdatePromise).catch(() => null);
    
    if (!updatedTitle) {
      // Fallback: Wait for title update using DOM polling
      updatedTitle = await page.waitForFunction(
        () => {
          const conversations = document.querySelectorAll('.title-container.conversation .title-text');
          
          for (const titleEl of conversations) {
            const currentTitle = (titleEl.textContent || '').trim();
            if (currentTitle && 
                currentTitle.toLowerCase() !== 'new conversation' && 
                !currentTitle.toLowerCase().includes('untitled') &&
                currentTitle.length > 0) {
              return currentTitle;
            }
          }
          
          return null;
        },
        { timeout: 15000, polling: 500 }
      ).then(handle => handle.jsonValue()).catch(() => null);
    }

    // Assert title was updated
    expect(updatedTitle).toBeTruthy();
    expect(typeof updatedTitle).toBe('string');
    expect(updatedTitle.toLowerCase()).not.toBe('new conversation');
    expect(updatedTitle.length).toBeGreaterThan(0);

    // Optional debug output
    const debugLevel = Number(process.env.DEBUG || '0');
    if (debugLevel >= 2) {
      debugInfo('[TEST] Title update test succeeded');
      debugInfo('[TEST] Initial title:', { initialTitle: initialTitle || '(empty)' });
      debugInfo('[TEST] Updated title:', { updatedTitle });
    }
  });
});