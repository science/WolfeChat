import { test, expect } from '@playwright/test';

// Captures stack traces when the chat input textarea value is set/changed.
// Helps identify where assistantRole text enters the field.

test('Trace: textarea value setter call sites', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder="Type your message..."]') as HTMLTextAreaElement | null;
    if (!ta) return;

    const proto = Object.getPrototypeOf(ta);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
                 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (!desc || !desc.set) return;

    const originalSetter = desc.set!.bind(ta);
    const originalGetter = desc.get!.bind(ta);

    Object.defineProperty(ta, 'value', {
      configurable: true,
      get() { return originalGetter(); },
      set(v: any) {
        // Print a trimmed value to avoid flooding logs
        const s = typeof v === 'string' ? v : String(v);
        const preview = s.length > 120 ? s.slice(0, 120) + '…' : s;
        console.log('[trace] textarea.value set =>', JSON.stringify(preview));
        // Stack trace
        try { throw new Error('[trace] stack'); } catch (e) {
          console.log((e as Error).stack || 'no stack');
        }
        originalSetter(v);
      }
    });
  });

  // Wait a bit for any reactive assignments
  await page.waitForTimeout(600);

  // Trigger New Chat (which may cause assignment)
  const newChatBtn = page.locator('button[aria-label="New Chat"], button[title="New Chat"]').first();
  if (await newChatBtn.isVisible()) {
    await newChatBtn.click();
    await page.waitForTimeout(400);
  }

  // Read value and print gathered logs
  const val = await page.locator('textarea[placeholder="Type your message..."]').inputValue();
  console.log('[trace] final textarea value:', JSON.stringify(val));

  // Emit the captured logs to the test output
  for (const l of logs) console.log(l);

  // No assertion here; this test is for diagnostics. If desired, assert it does not include assistant role.
  // Example:
  // expect(val.includes("Don't provide compliments")).toBeFalsy();
});
