import { registerTest } from './testHarness';
import { conversations, chosenConversationId } from '../stores/stores';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(cond: () => boolean, timeoutMs = 3000, intervalMs = 50) {
  const start = performance.now();
  while (!cond()) {
    if (performance.now() - start > timeoutMs) throw new Error('waitFor: timeout');
    await sleep(intervalMs);
  }
}

function getChatContainer(): HTMLElement | null {
  const root = document.querySelector('.main-content-area') as HTMLElement | null;
  if (!root) return null;
  // The chat scroller has "overflow-y-auto" in App.svelte
  const scroller = root.querySelector('.overflow-y-auto') as HTMLElement | null;
  return scroller;
}

function makeLongText(label: string, lines = 60) {
  return Array.from({ length: lines }, (_, i) => `${label} line ${i + 1} — lorem ipsum dolor sit amet.`).join('\n');
}

async function createLongConversation(turns = 3) {
  // A "turn" is user + assistant
  const history: any[] = [];
  for (let t = 0; t < turns; t++) {
    history.push({ role: 'user', content: makeLongText(`User turn ${t + 1}`) });
    history.push({ role: 'assistant', content: makeLongText(`Assistant turn ${t + 1}`) });
  }
  conversations.set([
    {
      title: 'Test Long Conversation',
      assistantRole: 'assistant',
      conversationTokens: 0,
      history,
    },
  ] as any);
  chosenConversationId.set(0);
  // Wait for Svelte to render
  await waitFor(() => document.querySelectorAll('.message').length >= history.length);
}

function getAnchors(container: HTMLElement): number[] {
  const msgEls = Array.from(container.querySelectorAll('.message')) as HTMLElement[];
  // Compute top offset relative to container's scrollable area
  const cRect = container.getBoundingClientRect();
  const anchors = msgEls.map((el) => {
    const r = el.getBoundingClientRect();
    return (r.top - cRect.top) + container.scrollTop;
  });
  return anchors;
}

function getQuickSettingsToggle(): HTMLButtonElement | null {
  return document.querySelector('button[aria-controls="quick-settings-body"]') as HTMLButtonElement | null;
}

function getNavButtons() {
  const body = document.getElementById('quick-settings-body');
  if (!body) return { upBtn: null as HTMLButtonElement | null, downBtn: null as HTMLButtonElement | null };
  const buttons = Array.from(body.querySelectorAll('button')) as HTMLButtonElement[];
  const matchText = (el: HTMLButtonElement, txt: string) => (el.textContent || '').trim().toLowerCase() === txt.toLowerCase();
  const upBtn = buttons.find((b) => matchText(b, 'Up')) || buttons.find((b) => matchText(b, '▲ Up')) || buttons.find((b) => matchText(b, 'up')) || null;
  const downBtn = buttons.find((b) => matchText(b, 'Down')) || buttons.find((b) => matchText(b, '▼ Down')) || buttons.find((b) => matchText(b, 'down')) || null;
  return { upBtn, downBtn };
}

function approx(a: number, b: number, tol = 10) {
  return Math.abs(a - b) <= tol;
}

registerTest({
  id: 'conv-nav-prev-next',
  name: 'Quick Settings Up/Down navigates between conversation turns',
  tags: ['ui', 'non-api', 'navigation'],
  timeoutMs: 15000,
  fn: async (assert) => {
    // Ensure Quick Settings is open
    const toggle = getQuickSettingsToggle();
    assert.that(!!toggle, 'Quick Settings toggle button should exist');
    if (!toggle) return;
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      toggle.click();
      await sleep(100);
    }

    // Buttons should exist (this will currently fail until feature is implemented)
    const { upBtn, downBtn } = getNavButtons();
    assert.that(!!upBtn, 'Up button should exist in Quick Settings');
    assert.that(!!downBtn, 'Down button should exist in Quick Settings');
    if (!upBtn || !downBtn) return;

    // Create a long conversation with multiple turns
    await createLongConversation(4); // 4 user+assistant turns => 8 messages

    const container = getChatContainer();
    assert.that(!!container, 'Chat scroll container should exist');
    if (!container) return;

    const anchors = getAnchors(container);
    assert.that(anchors.length >= 8, 'Expected at least 8 message anchors');
    if (anchors.length < 8) return;

    // Start "midway" inside the 4th message (index 3, assistant)
    const startIdx = 3;
    const midOffset = anchors[startIdx] + 100;
    container.scrollTop = midOffset;
    await sleep(100);

    // Clicking Up should snap to the start of the current assistant turn (index 3)
    upBtn.click();
    await sleep(150);
    const afterUp = container.scrollTop;
    assert.that(approx(afterUp, anchors[startIdx]), `After Up, scrollTop should be near anchor ${startIdx}`);

    // Clicking Down should snap to the start of the next user message (index 4)
    downBtn.click();
    await sleep(150);
    const afterDown = container.scrollTop;
    assert.that(approx(afterDown, anchors[startIdx + 1]), `After Down, scrollTop should be near anchor ${startIdx + 1}`);

    // Step down through remaining anchors
    let idx = startIdx + 2;
    while (idx < anchors.length) {
      downBtn.click();
      await sleep(120);
      const st = container.scrollTop;
      // For the last "extra" down beyond the final message, expect to be at bottom instead of an anchor
      if (idx < anchors.length) {
        assert.that(approx(st, anchors[Math.min(idx, anchors.length - 1)]) || approx(st, container.scrollHeight - container.clientHeight, 15),
          `After Down, scrollTop should be near anchor ${Math.min(idx, anchors.length - 1)} or bottom`);
      }
      idx++;
    }

    // Go back up to top
    let upIdx = Math.max(0, anchors.length - 2);
    while (upIdx >= 0) {
      upBtn.click();
      await sleep(120);
      const st = container.scrollTop;
      assert.that(approx(st, anchors[upIdx]) || (upIdx === 0 && approx(st, 0, 5)),
        `After Up, scrollTop should be near anchor ${upIdx} (or top for first anchor)`);
      upIdx--;
    }

    // Extra Up at top should have no effect
    const beforeExtraUp = container.scrollTop;
    upBtn.click();
    await sleep(100);
    assert.that(approx(container.scrollTop, beforeExtraUp, 2), 'Extra Up at the start should not change scroll position');
  },
});
