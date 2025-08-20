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
import { streamResponseViaResponsesAPI } from '../../services/openaiService';
import { reasoningEffort, verbosity, summary } from '../../stores/reasoningSettings';

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

// SSE mocking helpers
function makeSSEStream(events: { event: string; data: any }[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        const chunk =
          `event: ${e.event}\n` +
          `data: ${JSON.stringify(e.data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

function makeSSEResponse(events: { event: string; data: any }[]): Response {
  const stream = makeSSEStream(events);
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } as any });
}

// Additional DOM helpers
function getPanelsInMessage(msgEl: HTMLElement): HTMLElement[] {
  return Array.from(msgEl.querySelectorAll('div.rounded.border.border-gray-500')) as HTMLElement[];
}

function hasExactDouble(text: string): boolean {
  if (!text) return false;
  const half = Math.floor(text.length / 2);
  if (text.length % 2 !== 0) return false;
  const a = text.slice(0, half);
  const b = text.slice(half);
  return a === b;
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
          conversationTokens: 0,
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

registerTest({
  id: 'reasoning-live-sse-realistic-duplication',
  name: 'Reasoning SSE: realistic stream (gpt-5-nano) detects duplicate text and panels',
  tags: ['live', 'reasoning', 'ui'],
  timeoutMs: 20000,
  fn: async (assert) => {
    // Preserve state and fetch
    const prevConvs = get(conversations);
    const prevChosen = get(chosenConversationId);
    const prevWindows = get(reasoningWindows);
    const prevPanels = get(reasoningPanels);
    const origFetch = window.fetch?.bind(window);

    try {
      // Configure reasoning settings to match requested scenario
      reasoningEffort.set('high');
      verbosity.set('low');
      summary.set('auto');

      // Prepare a conversation with one user message to anchor ReasoningInline
      conversations.set([{
        title: 'Reasoning SSE Realistic',
        assistantRole: 'You are a helpful assistant.',
        conversationTokens: 0,
        history: [
          { role: 'user', content: 'User question here' },
          { role: 'assistant', content: 'Assistant prior reply' },
        ],
      }]);
      chosenConversationId.set(0);
      reasoningWindows.set([]);
      reasoningPanels.set([]);

      await sleep(0);
      await waitFor(() => !!getChatContainer(), 4000);
      await sleep(50);

      const msgEls = getMessageEls();
      assert.that(msgEls.length >= 1, 'At least one message element should render');
      const userMsgEl = msgEls[0];

      // Mock fetch to return SSE for two reasoning sequences and a completion
      const seq1Chunks = ['Alpha ', 'Beta '];
      const seq2Chunks = ['Gamma ', 'Delta '];
      const seq1DoneFull = seq1Chunks.join('');
      const seq2DoneFull = seq2Chunks.join('');

      const sseEvents: { event: string; data: any }[] = [
        // Sequence 1
        { event: 'response.reasoning_text.delta', data: { delta: seq1Chunks[0] } },
        { event: 'response.reasoning_text.delta', data: { delta: seq1Chunks[1] } },
        // Done sends full text again (this reproduces real-world duplication scenario)
        { event: 'response.reasoning_text.done', data: { text: seq1DoneFull } },
        // Sequence 2
        { event: 'response.reasoning_text.delta', data: { delta: seq2Chunks[0] } },
        { event: 'response.reasoning_text.delta', data: { delta: seq2Chunks[1] } },
        // Done sends full text again
        { event: 'response.reasoning_text.done', data: { text: seq2DoneFull } },
        // Final completion
        { event: 'response.completed', data: {} },
      ];

      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : (input as Request).url ?? String(input);
        if (/\/v1\/responses$/.test(url) && init?.method === 'POST') {
          return Promise.resolve(makeSSEResponse(sseEvents));
        }
        return origFetch ? origFetch(input as any, init) : Promise.reject(new Error('No fetch'));
      };

      // Kick off the real streaming path
      await streamResponseViaResponsesAPI(
        'Explain the Monte Hall problem using logic. Think hard about the answer.',
        'gpt-5-nano',
        undefined,
        undefined,
        { convId: 0, anchorIndex: 0 }
      );

      // Wait for UI to reflect the reasoning window and both panels marked done
      await waitFor(() => getReasoningDetailsInMessage(userMsgEl).length === 1, 4000);
      const detailsEl = getReasoningDetailsInMessage(userMsgEl)[0];
      await waitFor(() => getPanelsInDetails(detailsEl).length >= 2, 4000);
      await waitFor(() => getPanelsInDetails(detailsEl).every(p => getPanelStatus(p).includes('done')), 4000);

      const panels = getPanelsInDetails(detailsEl);
      const panelCount = panels.length;
      // Expect exactly two panels (one per reasoning sequence)
      assert.that(panelCount === 2, `Expected 2 panels, found ${panelCount}`);

      // Verify no duplicate reasoning window is created
      const detailsEls = getReasoningDetailsInMessage(userMsgEl);
      assert.that(detailsEls.length === 1, `Expected exactly one Reasoning window, found ${detailsEls.length}`);

      // Validate texts for both panels are not duplicated
      const text0 = getPanelText(panels[0]);
      const text1 = getPanelText(panels[1]);
      const expected0 = seq1DoneFull.trim();
      const expected1 = seq2DoneFull.trim();

      // Panel 1
      assert.that(text0 === expected0, `Panel 1 final text should equal streamed content (${JSON.stringify(expected0)}), got ${JSON.stringify(text0)}`);
      assert.that(!hasExactDouble(text0), 'Panel 1 text is not an exact double of itself');
      assert.that(!text0.includes(expected0 + expected0), 'Panel 1 text is not duplicated by concatenation');

      // Panel 2
      assert.that(text1 === expected1, `Panel 2 final text should equal streamed content (${JSON.stringify(expected1)}), got ${JSON.stringify(text1)}`);
      assert.that(!hasExactDouble(text1), 'Panel 2 text is not an exact double of itself');
      assert.that(!text1.includes(expected1 + expected1), 'Panel 2 text is not duplicated by concatenation');
    } finally {
      // Restore state and fetch
      reasoningPanels.set(prevPanels);
      reasoningWindows.set(prevWindows);
      conversations.set(prevConvs);
      chosenConversationId.set(prevChosen);
      await sleep(0);
      if (origFetch) window.fetch = origFetch;
    }
  },
});
