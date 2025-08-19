/**
 * Tests for Reasoning Windows (RW) behavior and placement.
 * Non-API, DOM-based tests using the in-app test harness.
 *
 * Verifies:
 * 1) RW appear only when reasoning data is received for a chat and stay associated with that chat.
 * 2) New chats have distinct RW data; switching preserves/isolates RWs per chat.
 * 3) RW placement is stable between a user message and its AI response (no vertical shifting).
 * 4) Non-reasoning chat sessions do not show RW; switching back to reasoning chats preserves RW.
 */

import { registerTest } from './testHarness';
import { conversations, chosenConversationId, selectedModel } from '../stores/stores';
import { reasoningWindows, reasoningPanels } from '../stores/reasoningStore';

// --- Helpers ---
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(cond: () => boolean, timeoutMs = 4000, intervalMs = 25) {
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

function getRWDetailsInMessage(msgEl: HTMLElement): HTMLElement[] {
  return Array.from(msgEl.querySelectorAll('details')) as HTMLElement[];
}

function approx(a: number, b: number, tol = 10) {
  return Math.abs(a - b) <= tol;
}

function defaultSystemRole(): string {
  return "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.";
}

async function setConversationsState(convs: any[], activeIdx: number) {
  conversations.set(convs);
  chosenConversationId.set(activeIdx);
  await sleep(0);
  await waitFor(() => !!getChatContainer(), 3000);
  // Wait for DOM to reflect messages
  await sleep(50);
}

async function clearReasoningStores() {
  reasoningWindows.set([]);
  reasoningPanels.set([]);
  await sleep(0);
}

function addReasoningWindowFor(convId: number, anchorIndex: number, opts?: { id?: string; model?: string; summaryText?: string; done?: boolean }) {
  const id = opts?.id ?? `win-${convId}-${anchorIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const model = opts?.model ?? 'gpt-5';
  const text = opts?.summaryText ?? 'Reasoning summary text';
  const done = opts?.done ?? true;

  reasoningWindows.update((arr: any[]) => [
    ...arr,
    {
      id,
      convId,
      anchorIndex,
      open: true,
      model,
    },
  ]);
  reasoningPanels.update((arr: any[]) => [
    ...arr,
    {
      id: `panel-${id}`,
      responseId: id,
      kind: 'summary',
      text,
      done,
    },
  ]);
  return id;
}

// --- Test 1: RW appear only when reasoning data is received in a chat, and associate with that chat ---
registerTest({
  id: 'rw-appear-only-with-data',
  name: 'RW appear only with reasoning data and bind to the correct chat session',
  tags: ['non-api', 'reasoning', 'ui'],
  async fn(assert) {
    await clearReasoningStores();

    await setConversationsState(
      [
        {
          history: [
            { role: 'user', content: 'Hi there' },
            { role: 'assistant', content: 'Hello!' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Chat A',
        },
      ],
      0
    );

    // Initially no RW
    const container = getChatContainer()!;
    assert.that(container != null, 'Chat container exists');
    let detailsCount = container.querySelectorAll('details').length;
    assert.that(detailsCount === 0, 'No Reasoning windows before reasoning data arrives');

    // Add reasoning window for user message index 0 in chat 0
    addReasoningWindowFor(0, 0, { id: 'w-a-0' });
    await waitFor(() => container.querySelectorAll('details').length === 1);
    detailsCount = container.querySelectorAll('details').length;
    assert.that(detailsCount === 1, 'One Reasoning window appears after reasoning data is added');

    const msgs = getMessageEls();
    assert.that(msgs.length >= 2, 'At least user+assistant messages are rendered');
    const rwInFirst = getRWDetailsInMessage(msgs[0]).length;
    const rwInSecond = getRWDetailsInMessage(msgs[1]).length;
    assert.that(rwInFirst === 1, 'RW is attached under the user message (anchorIndex 0)');
    assert.that(rwInSecond === 0, 'RW is not attached to the assistant message');
  },
});

// --- Test 2: New chats have distinct RW data; switching preserves/isolates RWs per chat ---
registerTest({
  id: 'rw-per-conversation-separation',
  name: 'RW per-conversation separation and switching between chats',
  tags: ['non-api', 'reasoning', 'ui', 'switching'],
  async fn(assert) {
    await clearReasoningStores();

    // Two conversations, each with one user+assistant turn
    await setConversationsState(
      [
        {
          history: [
            { role: 'user', content: 'A: user 1' },
            { role: 'assistant', content: 'A: assistant 1' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Chat A',
        },
        {
          history: [
            { role: 'user', content: 'B: user 1' },
            { role: 'assistant', content: 'B: assistant 1' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Chat B',
        },
      ],
      0
    );

    // Add RW only to Chat A (convId 0), anchored at first user msg (index 0)
    addReasoningWindowFor(0, 0, { id: 'w-a-0' });
    await waitFor(() => getChatContainer()!.querySelectorAll('details').length === 1);
    let msgs = getMessageEls();
    assert.that(getRWDetailsInMessage(msgs[0]).length === 1, 'Chat A shows its RW');

    // Switch to Chat B (should have no RW yet)
    chosenConversationId.set(1);
    await sleep(50);
    await waitFor(() => getMessageEls().length >= 2);
    let container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 0, 'Chat B initially shows no RW');

    // Add RW only to Chat B now
    addReasoningWindowFor(1, 0, { id: 'w-b-0' });
    await waitFor(() => getChatContainer()!.querySelectorAll('details').length === 1);
    msgs = getMessageEls();
    assert.that(getRWDetailsInMessage(msgs[0]).length === 1, 'Chat B shows its own RW');

    // Switch back to Chat A; ensure Chat A’s RW is still present and B’s does not leak
    chosenConversationId.set(0);
    await sleep(50);
    await waitFor(() => getMessageEls().length >= 2);
    container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 1, 'Chat A still shows exactly one RW after switching back');
    msgs = getMessageEls();
    assert.that(getRWDetailsInMessage(msgs[0]).length === 1, 'RW remains attached under the correct user message in Chat A');
  },
});

// --- Test 3: RW do not shift up or down between responses ---
registerTest({
  id: 'rw-stable-placement',
  name: 'RW placement is stable between a user message and assistant response',
  tags: ['non-api', 'reasoning', 'ui', 'placement'],
  async fn(assert) {
    await clearReasoningStores();

    await setConversationsState(
      [
        {
          history: [
            { role: 'user', content: 'Anchor me' },
            { role: 'assistant', content: 'Initial reply' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Placement Chat',
        },
      ],
      0
    );

    // Add RW under the first user message
    addReasoningWindowFor(0, 0, { id: 'w-place-0' });
    await waitFor(() => getChatContainer()!.querySelectorAll('details').length === 1);

    const container = getChatContainer()!;
    const msgsBefore = getMessageEls();
    const firstUserMsgEl = msgsBefore[0];
    const detailsElBefore = firstUserMsgEl.querySelector('details') as HTMLElement | null;
    assert.that(!!detailsElBefore, 'RW details exists before adding more content');
    const cRectBefore = container.getBoundingClientRect();
    const topBefore = (detailsElBefore!.getBoundingClientRect().top - cRectBefore.top) + container.scrollTop;

    // Append more content (assistant response after) which should not move the anchored RW
    conversations.update((all: any[]) => {
      const arr = [...all];
      arr[0] = {
        ...arr[0],
        history: [
          ...arr[0].history,
          { role: 'assistant', content: Array.from({ length: 30 }, (_, i) => `Extra line ${i + 1}`).join('\n') },
        ],
      };
      return arr;
    });
    await sleep(50);

    const msgsAfter = getMessageEls();
    const firstUserMsgElAfter = msgsAfter[0];
    const detailsElAfter = firstUserMsgElAfter.querySelector('details') as HTMLElement | null;
    assert.that(!!detailsElAfter, 'RW details still exists after adding more content');

    const cRectAfter = container.getBoundingClientRect();
    const topAfter = (detailsElAfter!.getBoundingClientRect().top - cRectAfter.top) + container.scrollTop;

    assert.that(approx(topAfter, topBefore, 10), `RW position stable (before=${topBefore.toFixed(1)}, after=${topAfter.toFixed(1)})`);
  },
});

// --- Test 4: Non-reasoning chat has no RW; switching back preserves RW in reasoning chats ---
registerTest({
  id: 'rw-non-reasoning-switching',
  name: 'Non-reasoning chat sessions do not show RW; switching back preserves RW for reasoning sessions',
  tags: ['non-api', 'reasoning', 'ui', 'switching'],
  async fn(assert) {
    await clearReasoningStores();

    // Create two chats: Chat R (reasoning), Chat N (non-reasoning)
    await setConversationsState(
      [
        {
          history: [
            { role: 'user', content: 'R: user 1' },
            { role: 'assistant', content: 'R: assistant 1' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Chat R (reasoning)',
        },
        {
          history: [
            { role: 'user', content: 'N: user 1' },
            { role: 'assistant', content: 'N: assistant 1' },
          ],
          conversationTokens: 0,
          assistantRole: defaultSystemRole(),
          title: 'Chat N (non-reasoning)',
        },
      ],
      0
    );

    // Simulate reasoning model for Chat R and add RW there
    selectedModel.set('gpt-5');
    addReasoningWindowFor(0, 0, { id: 'w-r-0' });
    await waitFor(() => getChatContainer()!.querySelectorAll('details').length === 1);
    let container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 1, 'Chat R shows one RW');

    // Switch to Chat N and simulate a non-reasoning model; ensure no RW appears
    chosenConversationId.set(1);
    selectedModel.set('gpt-4.1');
    await sleep(50);
    await waitFor(() => getMessageEls().length >= 2);
    container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 0, 'Chat N shows no RW');

    // Switch back to Chat R; ensure its RW is still present
    chosenConversationId.set(0);
    selectedModel.set('gpt-5');
    await sleep(50);
    await waitFor(() => getMessageEls().length >= 2);
    container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 1, 'Chat R still shows its RW after switching back');

    // And switching again to Chat N still shows no RW
    chosenConversationId.set(1);
    await sleep(50);
    await waitFor(() => getMessageEls().length >= 2);
    container = getChatContainer()!;
    assert.that(container.querySelectorAll('details').length === 0, 'Chat N continues to show no RW');
  },
});
