import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

test.setTimeout(45_000);

test('Live: per-conversation Quick Settings persist across switches', async ({ page }) => {
  const DEBUG_LVL = Number.parseInt(process.env.DEBUG || '0', 10) || 0;
  if (DEBUG_LVL >= 2) {
    page.on('console', msg => {
      const t = msg.text();
      if (/[\[TEST\]]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') debugInfo(`[BROWSER-${msg.type()}] ${t}`);
    });
    page.on('pageerror', err => debugErr('[BROWSER-PAGEERROR]', { message: err.message }));
  }
  if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG = lvl; }, DEBUG_LVL);

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });

  await bootstrapLiveAPI(page);
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'minimal', verbosity: 'low', closeAfter: true });

  const input = page.getByRole('textbox', { name: /chat input/i });

  // Create two additional conversations so we have 3 total
  const sidebar = page.locator('nav').first();
  const newConvBtn = sidebar.getByRole('button', { name: /^new conversation$/i });

  const rows = page.locator('.conversation.title-container');

  // conv1 stays current; create conv2
  {
    const before = await rows.count();
    await expect(newConvBtn).toBeVisible();
    await newConvBtn.click();
    await expect(rows).toHaveCount(before + 1);
  }

  // create conv3
  {
    const before = await rows.count();
    await newConvBtn.click();
    await expect(rows).toHaveCount(before + 1);
  }

  // rows: 0->conv3, 1->conv2, 2->conv1

  // Set per-conversation models/reasoning using helper to ensure panel open and model availability
  // conv3: use gpt-5-nano (approved test model)
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'minimal', verbosity: 'low' });
  // Set summary last (helper doesn't include it by default in earlier calls)
  await operateQuickSettings(page, { mode: 'ensure-open', summary: 'detailed', closeAfter: true });

  // conv2 settings
  await rows.nth(1).click();
  // Ensure a reasoning model is selected before setting reasoning controls
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'high', verbosity: 'high', summary: 'auto', closeAfter: true });

  // conv1 settings
  await rows.nth(2).click();
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, reasoningEffort: 'medium', verbosity: 'medium', summary: 'null', closeAfter: true });

  // Verify cycling retains settings
  // conv3
  await rows.nth(0).click();
  await operateQuickSettings(page, { mode: 'ensure-open' });
  const modelSelect = page.locator('#current-model-select');
  const reasoningEffortSel = page.locator('#reasoning-effort');
  const verbositySel = page.locator('#verbosity');
  const summarySel = page.locator('#summary');
  // We use gpt-5-nano as the standard test model, and we can assert reasoning control values
  await expect(reasoningEffortSel).toHaveValue('minimal');
  await expect(verbositySel).toHaveValue('low');
  await expect(summarySel).toHaveValue('detailed');
  await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

  // conv2
  await rows.nth(1).click();
  await operateQuickSettings(page, { mode: 'ensure-open' });
  await expect(page.locator('#reasoning-effort')).toHaveValue('high');
  await expect(page.locator('#verbosity')).toHaveValue('high');
  await expect(page.locator('#summary')).toHaveValue('auto');
  await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

  // conv1
  await rows.nth(2).click();
  await operateQuickSettings(page, { mode: 'ensure-open' });
  await expect(page.locator('#reasoning-effort')).toHaveValue('medium');
  await expect(page.locator('#verbosity')).toHaveValue('medium');
  await expect(page.locator('#summary')).toHaveValue('null');
  await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });
});
