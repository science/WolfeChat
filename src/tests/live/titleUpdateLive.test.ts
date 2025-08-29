import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';
import { apiKey, conversations, chosenConversationId } from '../../stores/stores.js';
import { sendRegularMessage } from '../../services/openaiService.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

registerTest({
  id: 'live-title-update',
  name: 'Live API: conversation title updates after first message',
  tags: ['live', 'api', 'responses', 'network', 'smoke'],
  timeoutMs: 45000,
  fn: async (assert) => {
    const key = get(apiKey);
    assert.that(!!key, 'API key is configured');
    if (!key) return;

    // Force a sane model for the initial send regardless of persisted localStorage
    const { selectedModel } = await import('../../stores/stores.js');
    const { getReasoningModel } = await import('../testModel.js');
    const prevModel = get(selectedModel as any);
    localStorage.removeItem('selectedModel');
    (selectedModel as any).set(getReasoningModel());

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
    assert.that(beforeTitle === '', 'Initial title is empty (renders as "New conversation")');

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
      // Restore model before exiting
      if (prevModel != null) (selectedModel as any).set(prevModel);
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

    // Restore prior model selection
    if (prevModel != null) (selectedModel as any).set(prevModel);

    assert.that(!!finalTitle, `Conversation title updated to a non-empty value (got: "${finalTitle}")`);
    assert.that(finalTitle.toLowerCase() !== 'new conversation', 'Title is not the placeholder "New conversation"');
  },
});
