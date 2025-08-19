import { get } from 'svelte/store';
import { registerTest } from '../testHarness';
import {
  reasoningWindows,
  reasoningPanels,
  createReasoningWindow,
  startReasoningPanel,
  appendReasoningText,
  completeReasoningPanel,
} from '../../stores/reasoningStore';
import { conversations, chosenConversationId } from '../../stores/stores';

// Helpers
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

function getReasoningDetailsInMessage(msgEl: HTMLElement): HTMLDetailsElement[] {
  return Array.from(msgEl.querySelectorAll('details')) as HTMLDetailsElement[];
}

function getPanelsInDetails(detailsEl: HTMLElement): HTMLElement[] {
  // Matches the panel container blocks rendered in ReasoningInline/Collapsible
  return Array.from(detailsEl.querySelectorAll('div.rounded.border.border-gray-500')) as HTMLElement[];
}

function getPanelText(panelEl: HTMLElement): string {
  const pre = panelEl.querySelector('pre');
  return (pre?.textContent || '').trim();
}

function getPanelStatus(panelEl: HTMLElement): string {
  const status = panelEl.querySelector('.text-xs');
  return (status?.textContent || '').trim().toLowerCase();
}

// Test: Single reasoning stream -> one panel, correct incremental text, no duplicates, finalizes to done
registerTest({
  id: 'reasoning-live-sse-panel-dedupe',
  name: 'Reasoning SSE: single panel streams once and finalizes without duplication',
  tags: ['live', 'reasoning', 'ui'],
  timeoutMs: 15000,
  fn: async (assert) => {
    // Preserve state
    const prevConvs = get(conversations);
    const prevChosen = get(chosenConversationId);
    const prevWindows = get(reasoningWindows);
    const prevPanels = get(reasoningPanels);

    try {
      // 1) Prepare a minimal conversation with one user message so ReasoningInline renders
      conversations.set([
        {
          title: 'Reasoning Test Conversation',
          assistantRole: 'You are a helpful assistant.',
          history: [
            { role: 'user', content: 'User question here' },
            { role: 'assistant', content: 'Assistant prior reply' },
          ],
        },
      ]);
      chosenConversationId.set(0);
      reasoningWindows.set([]);
      reasoningPanels.set([]);

      await sleep(0);
      await waitFor(() => !!getChatContainer(), 4000);
      await sleep(50);

      const msgEls = getMessageEls();
      assert.that(msgEls.length >= 1, 'At least one message element should render');

      // Anchor to the first user message (index 0)
      const anchorIndex = 0;
      const userMsgEl = msgEls[anchorIndex];
      assert.that(!!userMsgEl, 'User message element exists at anchor index');

      // Ensure no reasoning details exist yet
      let detailsBefore = getReasoningDetailsInMessage(userMsgEl);
      assert.that(detailsBefore.length === 0, 'No reasoning window present before SSE');

      // 2) Simulate SSE lifecycle via store APIs used by the streaming handler
      // Create one reasoning window for this conversation and anchor
      const convId = 0;
      const winId = createReasoningWindow(convId, 'gpt-5', anchorIndex);

      // Wait for UI to show the collapsible Reasoning window
      await waitFor(() => getReasoningDetailsInMessage(userMsgEl).length === 1, 3000);
      let detailsEls = getReasoningDetailsInMessage(userMsgEl);
      const detailsEl = detailsEls[0];

      assert.that(!!detailsEl, 'Reasoning collapsible window created on first reasoning SSE');

      // Start a single reasoning panel for this window (simulating "text" kind)
      const panelId = startReasoningPanel('text', convId, winId);

      // Wait for the panel shell to appear
      await waitFor(() => getPanelsInDetails(detailsEl).length === 1, 3000);
      let panelEls = getPanelsInDetails(detailsEl);
      assert.that(panelEls.length === 1, 'Exactly one reasoning panel is created for the stream');

      // 3) Stream deltas and verify incremental updates (no duplication)
      const chunks = ['Alpha ', 'Beta ', 'Gamma'];
      let agg = '';
      for (const c of chunks) {
        agg += c;
        appendReasoningText(panelId, c);
        await sleep(0);
        await waitFor(() => getPanelText(getPanelsInDetails(detailsEl)[0]) === agg.trim(), 2000);
        const textNow = getPanelText(getPanelsInDetails(detailsEl)[0]);
        assert.that(textNow === agg.trim(), `Panel text matches streamed content so far: "${agg.trim()}"`);
        // Ensure no duplicated concatenation occurs
        assert.that(!textNow.includes(agg.trim() + agg.trim()), 'Panel text is not duplicated');
      }

      // 4) Finalize panel and verify status and that content remains correct
      completeReasoningPanel(panelId);
      await sleep(0);
      await waitFor(() => getPanelStatus(getPanelsInDetails(detailsEl)[0]).includes('done'), 3000);

      const finalPanels = getPanelsInDetails(detailsEl);
      assert.that(finalPanels.length === 1, 'No additional panel created on finalize');

      const finalText = getPanelText(finalPanels[0]);
      assert.that(finalText === agg.trim(), 'Final panel text matches exactly the streamed data');
      assert.that(!finalText.includes(agg.trim() + agg.trim()), 'Final text is not duplicated');

      // 5) Verify only one reasoning window exists and is associated with the anchor
      detailsEls = getReasoningDetailsInMessage(userMsgEl);
      assert.that(detailsEls.length === 1, 'Exactly one reasoning window exists for the anchor');
    } finally {
      // Restore state
      reasoningPanels.set(prevPanels);
      reasoningWindows.set(prevWindows);
      conversations.set(prevConvs);
      chosenConversationId.set(prevChosen);
      await sleep(0);
    }
  },
});
