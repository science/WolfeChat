// Quick test to verify reasoning window fix
// This tests the core issue: conversation ID type mismatch

import { get } from 'svelte/store';
import { conversations, chosenConversationId } from './src/stores/stores.js';
import { reasoningWindows, createReasoningWindow } from './src/stores/reasoningStore.js';

// Setup test conversation
const testConv = {
  id: 'test-conv-verify',
  title: 'Test Conversation',
  assistantRole: 'You are a helpful assistant.',
  conversationTokens: 0,
  history: [
    { role: 'user', content: 'Test question' }
  ]
};

// Set up the stores
conversations.set([testConv]);
chosenConversationId.set(0);

// Get the conversation's string ID (this is what the fix ensures is used)
const conv = get(conversations)[0];
console.log('Conversation ID:', conv.id);
console.log('Conversation ID type:', typeof conv.id);

// Create a reasoning window using the string ID
const windowId = createReasoningWindow(conv.id, 'gpt-5', 0);
console.log('Created window ID:', windowId);

// Check if the window was created with the correct convId
const windows = get(reasoningWindows);
const createdWindow = windows.find(w => w.id === windowId);
console.log('Window convId:', createdWindow?.convId);
console.log('Window convId type:', typeof createdWindow?.convId);

// Verify the fix
if (createdWindow?.convId === conv.id) {
  console.log('✅ SUCCESS: Reasoning window correctly uses string conversation ID');
} else {
  console.log('❌ FAIL: Conversation ID mismatch');
  console.log('Expected:', conv.id);
  console.log('Got:', createdWindow?.convId);
}