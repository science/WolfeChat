import { test, expect } from '@playwright/test';

// Helpers executed in the page context
const pageHelpers = {
  makeLongText: (label: string, lines = 60) =>
    Array.from({ length: lines }, (_, i) => `${label} line ${i + 1} — lorem ipsum dolor sit amet.`).join('\n'),
};

async function seedLongConversation(page, turns = 4) {
  await page.evaluate(([turns]) => {
    const makeLongText = (label: string, lines = 60) =>
      Array.from({ length: lines }, (_, i) => `${label} line ${i + 1} — lorem ipsum dolor sit amet.`).join('\n');

    const history: any[] = [];
    for (let t = 0; t < (turns as number); t++) {
      history.push({ role: 'user', content: makeLongText(`User turn ${t + 1}`) });
      history.push({ role: 'assistant', content: makeLongText(`Assistant turn ${t + 1}`) });
    }
    // @ts-ignore - stores are globally available in app bundle
    const { conversations, chosenConversationId } = (window as any).wolfeStores || {};
    if (!conversations || !chosenConversationId) {
      // Fallback to __wolfeTest hook if present
      if ((window as any).__wolfeTest?.setConversations) {
        (window as any).__wolfeTest.setConversations([
          { title: 'Test Long Conversation', assistantRole: 'assistant', conversationTokens: 0, history },
        ], 0);
      } else {
        // Last-resort: attach to window for developer visibility
        console.error('Missing wolfeStores or __wolfeTest hook. Ensure test hooks are exposed.');
      }
      return;
    }
    conversations.set([
      { title: 'Test Long Conversation', assistantRole: 'assistant', conversationTokens: 0, history },
    ]);
    chosenConversationId.set(0);
  }, [turns]);

  // Wait for messages to render
  await expect.poll(async () => {
    return await page.evaluate(() => document.querySelectorAll('.message').length);
  }, { timeout: 3000 }).toBeGreaterThanOrEqual(turns * 2);
}

async function openQuickSettings(page) {
  // Prefer data-testid, fall back to aria-controls
  const toggle = page.locator('[data-testid="quick-settings-toggle"], button[aria-controls="quick-settings-body"]');
  await expect(toggle).toBeVisible();
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await toggle.click();
  }
  const body = page.locator('#quick-settings-body');
  await expect(body).toBeVisible();
}

async function getNavButtons(page) {
  const up = page.locator('[data-testid="nav-up"], #quick-settings-body button:has-text("Up"), #quick-settings-body button:has-text("▲ Up")');
  const down = page.locator('[data-testid="nav-down"], #quick-settings-body button:has-text("Down"), #quick-settings-body button:has-text("▼ Down")');
  await expect(up).toBeVisible();
  await expect(down).toBeVisible();
  return { up, down } as const;
}

async function getScroller(page) {
  const scroller = page.locator('.main-content-area .overflow-y-auto');
  await expect(scroller).toBeVisible();
  return scroller;
}

async function computeAnchors(page) {
  return await page.evaluate(() => {
    const container = document.querySelector('.main-content-area .overflow-y-auto') as HTMLElement | null;
    if (!container) return [] as number[];
    const cRect = container.getBoundingClientRect();
    const msgs = Array.from(container.querySelectorAll('.message')) as HTMLElement[];
    return msgs.map(el => {
      const r = el.getBoundingClientRect();
      return (r.top - cRect.top) + container.scrollTop;
    });
  });
}

function approx(a: number, b: number, tol = 12) {
  return Math.abs(a - b) <= tol;
}

test.describe('conversation navigation anchors', () => {
  test('Up/Down navigates between message anchors', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');

    await openQuickSettings(page);
    const { up, down } = await getNavButtons(page);

    await seedLongConversation(page, 4); // 8 messages

    const scroller = await getScroller(page);

    let anchors = await computeAnchors(page);
    expect(anchors.length).toBeGreaterThanOrEqual(8);

    // Start midway inside message index 3
    const startIdx = 3;
    const midOffset = anchors[startIdx] + 100;

    // Set scrollTop directly
    await page.evaluate((y) => {
      const el = document.querySelector('.main-content-area .overflow-y-auto') as HTMLElement | null;
      if (el) el.scrollTop = y as number;
    }, midOffset);

    // Click Up -> snap to anchors[3]
    await up.click();
    await page.waitForTimeout(150);
    let afterUp = await scroller.evaluate(el => (el as HTMLElement).scrollTop);
    expect(approx(afterUp, anchors[startIdx])).toBeTruthy();

    // Click Down -> snap to anchors[4]
    await down.click();
    await page.waitForTimeout(150);
    let afterDown = await scroller.evaluate(el => (el as HTMLElement).scrollTop);
    expect(approx(afterDown, anchors[startIdx + 1])).toBeTruthy();

    // Step Down through remaining anchors
    let idx = startIdx + 2;
    while (idx < anchors.length) {
      await down.click();
      await page.waitForTimeout(120);
      const st = await scroller.evaluate(el => (el as HTMLElement).scrollTop);
      const bottom = await scroller.evaluate(el => (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight);
      // Either land on next anchor or bottom for extra down
      const target = anchors[Math.min(idx, anchors.length - 1)];
      expect(approx(st, target) || approx(st, bottom, 15)).toBeTruthy();
      idx++;
    }

    // Go back up to top
    let upIdx = Math.max(0, anchors.length - 2);
    while (upIdx >= 0) {
      await up.click();
      await page.waitForTimeout(120);
      const st = await scroller.evaluate(el => (el as HTMLElement).scrollTop);
      expect(approx(st, anchors[upIdx]) || (upIdx === 0 && approx(st, 0, 5))).toBeTruthy();
      upIdx--;
    }

    // Extra Up at top remains at top
    await up.click();
    await page.waitForTimeout(120);
    const stTop = await scroller.evaluate(el => (el as HTMLElement).scrollTop);
    expect(approx(stTop, 0, 2)).toBeTruthy();
  });
});
