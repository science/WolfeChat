import { registerTest } from './testHarness';
import { get } from 'svelte/store';
import { apiKey, conversations, chosenConversationId } from '../stores/stores';
import { sendRegularMessage } from '../services/openaiService';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

registerTest({
  id: 'responses-title-update',
  name: 'Live API: conversation title updates after first message',
  tags: ['smoke', 'responses', 'api', 'network'],
  timeoutMs: 45000,
  fn: async (assert) => {
    const key = get(apiKey);
    assert.that(!!key, 'API key is configured');
    if (!key) return;

    const convId = get(chosenConversationId);
    // Ensure the current conversation exists
    const convs0 = get(conversations);
    assert.that(convs0 && convs0[convId] != null, 'Current conversation exists');
    if (!convs0 || convs0[convId] == null) return;

    // Reset title and history to simulate a brand-new conversation
    conversations.update((all) => {
      const copy = [...all];
      const curr = { ...copy[convId] };
      curr.title = '';
      if (Array.isArray(curr.history)) curr.history = [];
      copy[convId] = curr;
      return copy;
    });

    const beforeTitle = (get(conversations)[convId]?.title ?? '').trim();
    // UI shows "New conversation" when title === '', so we expect '' here
    assert.that(beforeTitle === '', 'Initial title is empty (renders as "New conversation")');

    // Send the first user message; app flow should trigger a follow-up title generation
    const userMsg = [
      {
        role: 'user',
        content:
          'Please answer briefly. Then the app should generate a short title summarizing this new chat.',
      },
    ];

    try {
      await sendRegularMessage(userMsg as any, convId);
    } catch (e) {
      assert.that(false, `sendRegularMessage completed without throwing: ${e?.message ?? e}`);
      return;
    }

    // Poll for the title to be updated by the secondary title-generation request
    const deadline = Date.now() + 30000;
    let finalTitle = '';
    while (Date.now() < deadline) {
      const t = (get(conversations)[convId]?.title ?? '').trim();
      if (t && t.toLowerCase() !== 'new conversation') {
        finalTitle = t;
        break;
      }
      await sleep(500);
    }

    assert.that(!!finalTitle, `Conversation title updated to a non-empty value (got: "${finalTitle}")`);
    assert.that(finalTitle.toLowerCase() !== 'new conversation', 'Title is not the placeholder "New conversation"');
  },
});
