import { get } from 'svelte/store';
import { tick } from 'svelte';
import { registerTest } from '../testHarness.js';
import {
  conversations,
  chosenConversationId,
  selectedModel,
} from '../../stores/stores.js';
import {
  reasoningWindows,
  reasoningPanels,
} from '../../stores/reasoningStore.js';
import { reasoningEffort } from '../../stores/reasoningSettings.js';
import { streamResponseViaResponsesAPI } from '../../services/openaiService.js';

// Helper functions
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(cond: () => boolean, timeoutMs = 5000, intervalMs = 50) {
  const start = performance.now();
  while (!cond()) {
    if (performance.now() - start > timeoutMs) throw new Error('waitFor: timeout');
    await sleep(intervalMs);
  }
}

function getChatContainer(): HTMLElement | null {
  const root = document.querySelector('.main-content-area') as HTMLElement | null;
  if (!root) return null;
  return root.querySelector('.overflow-y-auto') as HTMLElement | null;
}

function getMessageEls(): HTMLElement[] {
  const container = getChatContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll('.message')) as HTMLElement[];
}

function getReasoningDetailsInMessage(msgEl: HTMLElement): HTMLDetailsElement[] {
  return Array.from(msgEl.querySelectorAll('details')) as HTMLDetailsElement[];
}

function getDeleteAllBelowButton(msgEl: HTMLElement): HTMLButtonElement | null {
  // Look for button with deleteBelow.svg icon
  const buttons = Array.from(msgEl.querySelectorAll('button')) as HTMLButtonElement[];
  for (const btn of buttons) {
    const img = btn.querySelector('img');
    if (img && img.src && img.src.includes('deleteBelow')) {
      return btn;
    }
  }
  return null;
}

function getMessageContent(msgEl: HTMLElement): string {
  const displayDiv = msgEl.querySelector('.message-display');
  return displayDiv?.textContent?.trim() || '';
}

function getMessageRole(msgEl: HTMLElement): 'user' | 'assistant' | null {
  const profileImg = msgEl.querySelector('.profile-picture img') as HTMLImageElement;
  if (!profileImg) return null;
  if (profileImg.src.includes('UserIcon')) return 'user';
  if (profileImg.src.includes('RobotIcon')) return 'assistant';
  return null;
}

// Mock SSE response helper
function makeSSEResponse(events: { event: string; data: any }[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const e of events) {
        const chunk = `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } as any });
}

registerTest({
  id: 'delete-all-below-button-functionality',
  name: 'Delete All Below: button deletes all messages and reasoning windows below clicked message',
  tags: ['live', 'ui', 'delete'],
  timeoutMs: 60000,
  fn: async (assert) => {
    // Preserve state
    const prevConvs = get(conversations);
    const prevChosen = get(chosenConversationId);
    const prevWindows = get(reasoningWindows);
    const prevPanels = get(reasoningPanels);
    const prevModel = get(selectedModel);
    const origFetch = window.fetch?.bind(window);

    try {
      // Setup: Configure for reasoning
      selectedModel.set('gpt-5-nano');
      reasoningEffort.set('low');

      // Create initial conversation
      conversations.set([{
        id: 'test-conv-1',
        title: 'Delete Below Test',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [],
      }]);
      chosenConversationId.set(0);
      reasoningWindows.set([]);
      reasoningPanels.set([]);

      // Ensure DOM has app container
      if (!document.getElementById('app')) {
        const appDiv = document.createElement('div');
        appDiv.id = 'app';
        document.body.appendChild(appDiv);
      }

      // Try to mount App if not already mounted
      let app = (window as any).__svelteApp;
      if (!app && !getChatContainer()) {
        try {
          const App = (await import('../../App.svelte')).default;
          app = new App({
            target: document.getElementById('app')!
          });
          (window as any).__svelteApp = app;
          await tick();
        } catch (e) {
          console.warn('Could not mount App, assuming it is already mounted:', e);
        }
      }

      await sleep(100);
      await tick();
      
      // Wait for chat container with better error reporting
      await waitFor(() => {
        const container = getChatContainer();
        if (!container) {
          // Check if main-content-area exists
          const mainArea = document.querySelector('.main-content-area');
          if (!mainArea) {
            console.log('No .main-content-area found in DOM');
          } else {
            console.log('Found .main-content-area but no .overflow-y-auto inside');
          }
        }
        return !!container;
      }, 10000);

      // Track messages and reasoning windows as we create them
      const messageTracker: {
        index: number;
        role: 'user' | 'assistant';
        content: string;
        hasReasoning: boolean;
      }[] = [];

      // Helper to add a user message and get AI response
      async function addExchange(userText: string, aiResponse: string, includeReasoning = true) {
        const convId = 0;
        
        // Add user message to conversation
        conversations.update(convs => {
          const updated = [...convs];
          updated[convId].history.push({ role: 'user', content: userText });
          return updated;
        });
        
        await tick();
        await sleep(100);
        await tick();
        const userMsgIndex = get(conversations)[convId].history.length - 1;
        
        // Track user message
        messageTracker.push({
          index: userMsgIndex,
          role: 'user',
          content: userText,
          hasReasoning: false,
        });

        // Mock AI response with reasoning if requested
        const sseEvents: { event: string; data: any }[] = [];
        
        if (includeReasoning) {
          // Add reasoning events
          sseEvents.push(
            { event: 'response.reasoning_text.delta', data: { delta: 'Thinking about: ' } },
            { event: 'response.reasoning_text.delta', data: { delta: userText } },
            { event: 'response.reasoning_text.done', data: { text: `Thinking about: ${userText}` } }
          );
        }
        
        // Add main response
        const words = aiResponse.split(' ');
        for (const word of words) {
          sseEvents.push({ event: 'response.output_text.delta', data: { delta: word + ' ' } });
        }
        sseEvents.push({ event: 'response.completed', data: {} });

        // Mock fetch for this response
        window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
          if (/\/v1\/responses$/.test(url) && init?.method === 'POST') {
            return Promise.resolve(makeSSEResponse(sseEvents));
          }
          return origFetch ? origFetch(input as any, init) : Promise.reject(new Error('No fetch'));
        };

        // Stream the response
        await streamResponseViaResponsesAPI(
          userText,
          'gpt-5-nano',
          undefined,
          undefined,
          { convId: String(convId), anchorIndex: userMsgIndex }
        );

        await sleep(200);
        await tick();
        
        // Track assistant message
        const assistantMsgIndex = get(conversations)[convId].history.length - 1;
        messageTracker.push({
          index: assistantMsgIndex,
          role: 'assistant',
          content: aiResponse,
          hasReasoning: includeReasoning,
        });
      }

      // Create a sequence of messages
      await addExchange('First question', 'First AI response', true);
      await tick();
      await addExchange('Second question', 'Second AI response', true);
      await tick();
      await addExchange('Third question', 'Third AI response', true);
      await tick();
      await addExchange('Fourth question', 'Fourth AI response', false); // No reasoning on last one
      await tick();

      // Verify all messages are present
      await waitFor(() => getMessageEls().length === 8, 10000); // 4 user + 4 assistant
      const allMessages = getMessageEls();
      assert.that(allMessages.length === 8, `Should have 8 messages, got ${allMessages.length}`);

      // Verify reasoning windows are present where expected
      let reasoningCount = 0;
      for (let i = 0; i < allMessages.length; i++) {
        const msgEl = allMessages[i];
        const role = getMessageRole(msgEl);
        const reasoningEls = getReasoningDetailsInMessage(msgEl);
        
        if (role === 'user' && i < 6) { // First 3 user messages should have reasoning
          assert.that(reasoningEls.length === 1, `Message ${i} should have reasoning window`);
          reasoningCount++;
        } else {
          assert.that(reasoningEls.length === 0, `Message ${i} should not have reasoning window`);
        }
      }
      assert.that(reasoningCount === 3, `Should have 3 reasoning windows, got ${reasoningCount}`);

      // Now click the delete-all-below button on the 3rd message (index 2, which is the second user message)
      const targetMessageIndex = 2; // Second user message
      const targetMessage = allMessages[targetMessageIndex];
      const deleteAllButton = getDeleteAllBelowButton(targetMessage);
      
      assert.that(!!deleteAllButton, 'Delete all below button should exist on message');
      
      // Remember which messages should remain
      const shouldRemainIndices = [0, 1, 2]; // First user, first assistant, second user
      
      // Click the button
      deleteAllButton?.click();
      await tick();
      await sleep(200);
      await tick();
      
      // Wait for DOM to update
      await waitFor(() => getMessageEls().length === 3, 10000);
      
      // Verify correct messages remain
      const remainingMessages = getMessageEls();
      assert.that(remainingMessages.length === 3, `Should have 3 messages after deletion, got ${remainingMessages.length}`);
      
      // Check that remaining messages are the correct ones
      for (let i = 0; i < remainingMessages.length; i++) {
        const msgEl = remainingMessages[i];
        const content = getMessageContent(msgEl);
        const role = getMessageRole(msgEl);
        const expectedTracker = messageTracker[shouldRemainIndices[i]];
        
        assert.that(role === expectedTracker.role, `Message ${i} should be ${expectedTracker.role}, got ${role}`);
        assert.that(content.includes(expectedTracker.content.split(' ')[0]), `Message ${i} content mismatch`);
      }
      
      // Verify reasoning windows are preserved/deleted correctly
      const firstUserMsg = remainingMessages[0];
      const firstUserReasoning = getReasoningDetailsInMessage(firstUserMsg);
      assert.that(firstUserReasoning.length === 1, 'First user message should still have reasoning window');
      
      const secondUserMsg = remainingMessages[2];
      const secondUserReasoning = getReasoningDetailsInMessage(secondUserMsg);
      assert.that(secondUserReasoning.length === 0, 'Second user message should not have reasoning (was deleted with messages below)');
      
      // Verify conversation history in store matches DOM
      const finalHistory = get(conversations)[0].history;
      assert.that(finalHistory.length === 3, `Store should have 3 messages, got ${finalHistory.length}`);
      
      // Verify reasoning windows in store
      const finalWindows = get(reasoningWindows);
       const windowsForConv = finalWindows.filter(w => w.convId === 'test-conv-1');
      assert.that(windowsForConv.length === 1, `Should have 1 reasoning window remaining, got ${windowsForConv.length}`);
      
    } finally {
      // Restore state
      selectedModel.set(prevModel);
      reasoningPanels.set(prevPanels);
      reasoningWindows.set(prevWindows);
      conversations.set(prevConvs);
      chosenConversationId.set(prevChosen);
      await sleep(0);
      if (origFetch) window.fetch = origFetch;
    }
  },
});

registerTest({
  id: 'delete-all-below-button-ui-presence',
  name: 'Delete All Below: button appears with correct icon and tooltip',
  tags: ['live', 'ui', 'delete'],
  timeoutMs: 10000,
  fn: async (assert) => {
    // Preserve state
    const prevConvs = get(conversations);
    const prevChosen = get(chosenConversationId);

    try {
      // Create a simple conversation with messages
      conversations.set([{
        id: 'test-conv-2',
        title: 'UI Test',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
          { role: 'assistant', content: 'I am doing well!' },
        ],
      }]);
      chosenConversationId.set(0);

      // Ensure App is mounted
      if (!document.getElementById('app')) {
        const appDiv = document.createElement('div');
        appDiv.id = 'app';
        document.body.appendChild(appDiv);
      }
      
      let app = (window as any).__svelteApp;
      if (!app && !getChatContainer()) {
        try {
          const App = (await import('../../App.svelte')).default;
          app = new App({
            target: document.getElementById('app')!
          });
          (window as any).__svelteApp = app;
          await tick();
        } catch (e) {
          console.warn('Could not mount App, assuming it is already mounted:', e);
        }
      }

      await sleep(100);
      await tick();
      await waitFor(() => !!getChatContainer(), 5000);
      await waitFor(() => getMessageEls().length === 4, 10000);

      const messages = getMessageEls();
      
      // Check each message has the delete-all-below button
      for (let i = 0; i < messages.length - 1; i++) { // All except last message
        const msgEl = messages[i];
        const deleteAllBtn = getDeleteAllBelowButton(msgEl);
        
        assert.that(!!deleteAllBtn, `Message ${i} should have delete-all-below button`);
        
        if (deleteAllBtn) {
          // Check tooltip
          const tooltip = deleteAllBtn.getAttribute('title') || deleteAllBtn.getAttribute('aria-label');
          assert.that(
            tooltip?.toLowerCase().includes('delete') && tooltip?.toLowerCase().includes('below'),
            `Button should have tooltip mentioning "delete" and "below", got: ${tooltip}`
          );
          
          // Check icon
          const img = deleteAllBtn.querySelector('img');
          assert.that(!!img, 'Button should have an image icon');
          assert.that(
            img?.src?.includes('deleteBelow') || img?.alt?.toLowerCase().includes('delete'),
            'Button should use deleteBelow.svg icon'
          );
        }
      }
      
      // Last message should NOT have the button (nothing to delete below it)
      const lastMsg = messages[messages.length - 1];
      const lastDeleteBtn = getDeleteAllBelowButton(lastMsg);
      assert.that(!lastDeleteBtn, 'Last message should not have delete-all-below button');
      
    } finally {
      conversations.set(prevConvs);
      chosenConversationId.set(prevChosen);
      await sleep(0);
    }
  },
});

registerTest({
  id: 'delete-all-below-edge-cases',
  name: 'Delete All Below: handles edge cases correctly',
  tags: ['live', 'ui', 'delete'],
  timeoutMs: 15000,
  fn: async (assert) => {
    const prevConvs = get(conversations);
    const prevChosen = get(chosenConversationId);

    try {
      // Test case 1: Delete from first message (should delete everything except first)
      conversations.set([{
        id: 'test-conv-3',
        title: 'Edge Case Test',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: 'Message 2' },
          { role: 'assistant', content: 'Response 2' },
        ],
      }]);
      chosenConversationId.set(0);

      // Ensure App is mounted
      if (!document.getElementById('app')) {
        const appDiv = document.createElement('div');
        appDiv.id = 'app';
        document.body.appendChild(appDiv);
      }
      
      let app = (window as any).__svelteApp;
      if (!app && !getChatContainer()) {
        try {
          const App = (await import('../../App.svelte')).default;
          app = new App({
            target: document.getElementById('app')!
          });
          (window as any).__svelteApp = app;
          await tick();
        } catch (e) {
          console.warn('Could not mount App, assuming it is already mounted:', e);
        }
      }

      await sleep(100);
      await tick();
      await waitFor(() => getMessageEls().length === 4, 10000);

      let messages = getMessageEls();
      const firstMsgBtn = getDeleteAllBelowButton(messages[0]);
      assert.that(!!firstMsgBtn, 'First message should have delete-all-below button');
      
      firstMsgBtn?.click();
      await tick();
      await sleep(200);
      await tick();
      await waitFor(() => getMessageEls().length === 1, 10000);
      
      messages = getMessageEls();
      assert.that(messages.length === 1, 'Should have only 1 message after deleting all below first');
      assert.that(getMessageContent(messages[0]).includes('Message 1'), 'First message should remain');
      
      // Test case 2: Empty conversation should not crash
      conversations.set([{
        id: 'test-conv-4',
        title: 'Empty Test',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [],
      }]);
      await sleep(100);
      
      messages = getMessageEls();
      assert.that(messages.length === 0, 'Empty conversation should have no messages');
      
      // Test case 3: Single message should not have delete-all-below button
      conversations.set([{
        id: 'test-conv-5',
        title: 'Single Message Test',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [
          { role: 'user', content: 'Only message' },
        ],
      }]);
      await sleep(100);
      await tick();
      await waitFor(() => getMessageEls().length === 1, 10000);
      
      messages = getMessageEls();
      const singleMsgBtn = getDeleteAllBelowButton(messages[0]);
      assert.that(!singleMsgBtn, 'Single message should not have delete-all-below button');
      
    } finally {
      conversations.set(prevConvs);
      chosenConversationId.set(prevChosen);
      await sleep(0);
    }
  },
});
