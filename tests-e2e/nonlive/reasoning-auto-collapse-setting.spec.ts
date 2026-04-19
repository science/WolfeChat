// Reasoning auto-collapse setting — migrated from live/. The 4 Settings/QS
// tests never hit the API (pure UI state). The 4 behaviour tests replay a
// single reasoning fixture per provider; the setting's effect is observed
// by checking the <details open> attribute after the stream completes.
//
// Record:
//   RECORD=1 npx playwright test tests-e2e/nonlive/reasoning-auto-collapse-setting.spec.ts --project=record
import { test, expect } from '@playwright/test';
import {
  seedAppState,
  mockModelsEndpoint,
  mockResponsesEndpoint,
  fixtureRecordOrReplay,
  waitForStreamIdle,
} from './mock-helpers';

const RECORDING = !!process.env.RECORD;
const NON_REASONING_UI_MODEL_REGEX = /gpt-4\.1-nano/i;
const OPENAI_REASONING_REGEX = /gpt-5\.4-nano/i;
const ANTHROPIC_REASONING_REGEX = /claude-sonnet-4-5-20250929/i;

function reasoningRegion(page: import('@playwright/test').Page) {
  const byRole = page.getByRole('region', { name: /reasoning/i });
  const byAria = page.locator('details[role="region"][aria-label="Reasoning"]');
  const bySummaryParent = page.locator('summary', { hasText: 'Reasoning' }).locator('..');
  const byText = page.locator('details:has-text("Reasoning")');
  return byRole.or(byAria).or(bySummaryParent).or(byText);
}

async function sendPrompt(page: import('@playwright/test').Page, text: string) {
  const textarea = page.getByRole('textbox', { name: /chat input/i });
  await expect(textarea).toBeVisible();
  await textarea.click({ force: true });
  await textarea.fill(text);
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
}

async function baseSetupOpenAI(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await mockModelsEndpoint(page);
    await mockResponsesEndpoint(page, { titleText: 'Auto-collapse test' });
    await page.goto('/');
  }
}

async function baseSetupAnthropic(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'Anthropic');
  } else {
    await seedAppState(page, { provider: 'Anthropic', selectedModel: 'claude-sonnet-4-5-20250929' });
    await page.goto('/');
  }
}

async function baseSetupBoth(page: import('@playwright/test').Page) {
  if (RECORDING) {
    const { bootstrapLiveAPI } = await import('../live/helpers');
    await page.goto('/');
    await bootstrapLiveAPI(page, 'OpenAI');
  } else {
    await seedAppState(page, { provider: 'OpenAI', selectedModel: 'gpt-5.4-nano' });
    await mockModelsEndpoint(page);
    await page.goto('/');
  }
}

test.describe('Reasoning Auto-Collapse Setting', () => {
  // ===== SETTINGS / QS UI TESTS (no API) =====

  test('Settings: checkbox appears when reasoning model is selected and defaults to checked', async ({ page }) => {
    await baseSetupBoth(page);
    const { openSettings, saveAndCloseSettings } = await import('../live/helpers');

    await openSettings(page);
    const modelSelect = page.locator('#model-selection');
    await expect(modelSelect).toBeVisible();

    const options = await modelSelect.locator('option').allTextContents();
    const reasoningOpt = options.find(o => OPENAI_REASONING_REGEX.test(o));
    if (!reasoningOpt) throw new Error('gpt-5.4-nano not found');
    await modelSelect.selectOption(reasoningOpt);
    await page.waitForTimeout(200);

    const checkbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(checkbox).toBeVisible({ timeout: 5000 });
    await expect(checkbox).toBeChecked();

    await saveAndCloseSettings(page);
  });

  test('Settings: checkbox is not visible when non-reasoning model is selected', async ({ page }) => {
    await baseSetupBoth(page);
    const { openSettings, saveAndCloseSettings } = await import('../live/helpers');

    await openSettings(page);
    const modelSelect = page.locator('#model-selection');
    await expect(modelSelect).toBeVisible();

    const options = await modelSelect.locator('option').allTextContents();
    const nonReasoningOpt = options.find(o => NON_REASONING_UI_MODEL_REGEX.test(o));
    if (!nonReasoningOpt) throw new Error('gpt-4.1-nano not found');
    await modelSelect.selectOption(nonReasoningOpt);
    await page.waitForTimeout(200);

    const checkbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(checkbox).toBeHidden();

    await saveAndCloseSettings(page);
  });

  test('Settings: checkbox state persists across page reloads', async ({ page }) => {
    await baseSetupBoth(page);
    const { openSettings, saveAndCloseSettings } = await import('../live/helpers');

    await openSettings(page);
    let modelSelect = page.locator('#model-selection');
    const options = await modelSelect.locator('option').allTextContents();
    const reasoningOpt = options.find(o => OPENAI_REASONING_REGEX.test(o));
    if (!reasoningOpt) throw new Error('gpt-5.4-nano not found');
    await modelSelect.selectOption(reasoningOpt);
    await page.waitForTimeout(200);

    const checkbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck({ force: true });
    await expect(checkbox).not.toBeChecked();
    await saveAndCloseSettings(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await openSettings(page);
    modelSelect = page.locator('#model-selection');
    const options2 = await modelSelect.locator('option').allTextContents();
    const opt2 = options2.find(o => OPENAI_REASONING_REGEX.test(o));
    if (!opt2) throw new Error('gpt-5.4-nano not found after reload');
    await modelSelect.selectOption(opt2);
    await page.waitForTimeout(200);

    const checkbox2 = page.locator('#settings-reasoning-auto-collapse');
    await expect(checkbox2).toBeVisible();
    await expect(checkbox2).not.toBeChecked();
    await saveAndCloseSettings(page);
  });

  test('Quick Settings: checkbox appears for reasoning models and syncs with Settings', async ({ page }) => {
    await baseSetupBoth(page);
    const { operateQuickSettings, openSettings, saveAndCloseSettings } = await import('../live/helpers');

    await operateQuickSettings(page, { mode: 'ensure-open', model: OPENAI_REASONING_REGEX });

    const qsCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(qsCheckbox).toBeVisible({ timeout: 5000 });
    await expect(qsCheckbox).toBeChecked();
    await qsCheckbox.uncheck({ force: true });
    await expect(qsCheckbox).not.toBeChecked();

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await openSettings(page);
    const settingsSelect = page.locator('#model-selection');
    const settingsOpts = await settingsSelect.locator('option').allTextContents();
    const opt = settingsOpts.find(o => OPENAI_REASONING_REGEX.test(o));
    if (!opt) throw new Error('gpt-5.4-nano not found in Settings');
    await settingsSelect.selectOption(opt);
    await page.waitForTimeout(200);

    const settingsCheckbox = page.locator('#settings-reasoning-auto-collapse');
    await expect(settingsCheckbox).toBeVisible();
    await expect(settingsCheckbox).not.toBeChecked();
    await saveAndCloseSettings(page);
  });

  // ===== BEHAVIOUR TESTS =====

  test('OpenAI: with auto-collapse enabled, reasoning window closes when response completes', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetupOpenAI(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixtureRecordOrReplay(page, {
      name: 'autocollapse-openai-reasoning',
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'autocollapse OpenAI Monte Hall',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: OPENAI_REASONING_REGEX,
      reasoningEffort: 'high',
    });

    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'Explain the Monty Hall 3 door problem using logic and clear detail.');

    const reasoningWindow = reasoningRegion(page);
    // We intentionally skip asserting the window is initially open — replay
    // fulfills the fixture fast enough that auto-collapse can fire before
    // the assertion runs. The assertion that matters is the final state.
    await waitForStreamIdle(page, 1);
    await page.waitForTimeout(500);

    expect(await reasoningWindow.getAttribute('open')).toBeNull();

    if (RECORDING) {
      await page.waitForTimeout(5_000);
    }
  });

  test('OpenAI: with auto-collapse disabled, reasoning window stays open when response completes', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetupOpenAI(page);
    const { operateQuickSettings } = await import('../live/helpers');

    // Same fixture as the enabled case — setting behaviour is client-side only.
    await fixtureRecordOrReplay(page, {
      name: 'autocollapse-openai-reasoning',
      urlSubstring: 'api.openai.com/v1/responses',
      matchBody: '"stream":true',
      promptPreview: 'autocollapse OpenAI Monte Hall',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: OPENAI_REASONING_REGEX,
      reasoningEffort: 'high',
    });

    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'Explain the Monty Hall 3 door problem using logic and clear detail.');

    const reasoningWindow = reasoningRegion(page);
    await waitForStreamIdle(page, 1);
    await page.waitForTimeout(500);

    // With the setting disabled, the window stays open after completion.
    expect(await reasoningWindow.getAttribute('open')).not.toBeNull();

    if (RECORDING) {
      await page.waitForTimeout(5_000);
    }
  });

  test('Anthropic: with auto-collapse enabled, reasoning window closes when response completes', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetupAnthropic(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixtureRecordOrReplay(page, {
      name: 'autocollapse-anthropic-reasoning',
      urlSubstring: 'api.anthropic.com/v1/messages',
      matchBody: '"stream":true',
      promptPreview: 'autocollapse Anthropic what is 1+1',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: ANTHROPIC_REASONING_REGEX,
    });

    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'What is 1+1? Think step by step.');

    const reasoningWindow = reasoningRegion(page);
    // Intentionally skipping the "initially open" check — see OpenAI enabled test.
    await waitForStreamIdle(page, 1);
    await page.waitForTimeout(500);

    expect(await reasoningWindow.getAttribute('open')).toBeNull();

    if (RECORDING) {
      await page.waitForTimeout(5_000);
    }
  });

  test('Anthropic: with auto-collapse disabled, reasoning window stays open when response completes', async ({ page }) => {
    test.setTimeout(120_000);
    await baseSetupAnthropic(page);
    const { operateQuickSettings } = await import('../live/helpers');

    await fixtureRecordOrReplay(page, {
      name: 'autocollapse-anthropic-reasoning',
      urlSubstring: 'api.anthropic.com/v1/messages',
      matchBody: '"stream":true',
      promptPreview: 'autocollapse Anthropic what is 1+1',
    });

    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: ANTHROPIC_REASONING_REGEX,
    });

    const autoCollapseCheckbox = page.locator('#reasoning-auto-collapse');
    await expect(autoCollapseCheckbox).toBeChecked();
    await autoCollapseCheckbox.uncheck({ force: true });
    await expect(autoCollapseCheckbox).not.toBeChecked();
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    await sendPrompt(page, 'What is 2+2? Think step by step.');

    const reasoningWindow = reasoningRegion(page);
    await waitForStreamIdle(page, 1);
    await page.waitForTimeout(500);

    expect(await reasoningWindow.getAttribute('open')).not.toBeNull();

    if (RECORDING) {
      await page.waitForTimeout(5_000);
    }
  });
});
