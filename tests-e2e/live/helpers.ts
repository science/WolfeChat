import { expect, Page } from '@playwright/test';

export async function openSettings(page: Page) {
  // Semantic-first cascade to open Settings without test-only hooks
  const tryOpen = async (): Promise<boolean> => {
    const cascades = [
      // 1) Accessible role/name (Sidebar button says "Settings" and may include extra text)
      page.getByRole('button', { name: /settings(\s*\(.*\))?$/i }),
      page.getByRole('button', { name: /settings|preferences|api/i }),
      // 2) ARIA relationship commonly used in this app
      page.locator('button[aria-controls="settings-body"]'),
      page.locator('[aria-controls="settings-dialog"]'),
      // 3) Stable production id if present
      page.locator('#open-settings'),
      // 4) Fallbacks that are still production attributes (not test-only)
      page.locator('button[title="Settings"]'),
      page.locator('button[aria-label="Settings"]'),
    ];
    for (const c of cascades) {
      if (await c.isVisible().catch(() => false)) {
        await c.click();
        return true;
      }
    }
    return false;
  };

  // First attempt directly
  if (!(await tryOpen())) {
    // If not visible, it may be behind a menu/hamburger. Try opening a main menu, then retry.
    const menuCandidates = [
      page.getByRole('button', { name: /menu|more|open menu|toggle menu|wolfechat/i }),
      page.locator('button[aria-controls="topbar-menu"]'),
      page.locator('#open-menu'),
    ];
    for (const m of menuCandidates) {
      if (await m.isVisible().catch(() => false)) {
        await m.click();
        break;
      }
    }
    // Retry after opening menu
    if (!(await tryOpen())) {
      // As a last semantic fallback, search within the banner/topbar region
      const banner = page.getByRole('banner');
      const withinBanner = [
        banner.getByRole('button', { name: /settings|preferences|api/i }),
        banner.locator('button[aria-controls="settings-body"]'),
      ];
      for (const b of withinBanner) {
        if (await b.isVisible().catch(() => false)) {
          await b.click();
          break;
        }
      }
    }
  }

  // If a sidebar menu must be opened for Settings, ensure it is open first
  // Sidebar opens when menuVisible is true; open via the mobile menu button if present
  const sidebarVisible = await page.locator('.md\\:flex, .md\\:translate-x-0, nav[role="navigation"]').first().isVisible().catch(() => false);
  if (!sidebarVisible) {
    const menuBtn = page.getByRole('button', { name: /menu/i });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
    }
    // Retry Settings after opening menu
    await tryOpen();
  }

  // Verify dialog/panel is open via accessible UI
  const dialogOrPanel = page.getByRole('dialog', { name: /settings/i });
  const heading = page.getByRole('heading', { name: /settings/i });
  await Promise.race([
    dialogOrPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    heading.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
  ]);

  // If still not visible, dump some helpful diagnostics and fail
  const visible = (await dialogOrPanel.isVisible().catch(() => false)) || (await heading.isVisible().catch(() => false));
  if (!visible) {
    const topbarHtml = await page.locator('header, [role="banner"]').first().evaluateAll(
      nodes => nodes.map(n => (n as HTMLElement).outerHTML).join('\n')
    ).catch(() => '');
    throw new Error(
      'Could not find or open Settings using semantic selectors.\n' +
      'Checked role/name, aria-controls, and banner scope.\n' +
      'Topbar snippet for debugging:\n' + topbarHtml
    );
  }
}

export async function bootstrapLiveAPI(page: Page) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY env not set for live tests.');

  await openSettings(page);

  const apiInput = page.locator('#api-key');
  await expect(apiInput).toBeVisible();
  await apiInput.fill(key);

  const checkBtn = page.getByRole('button', { name: /check api/i });
  await expect(checkBtn).toBeVisible();
  await checkBtn.click();

  // Wait for success or for models to populate in Settings select
  // Prefer semantic combobox by label, fallback to id
  let modelSelect = page.getByRole('combobox', { name: /model selection/i });
  if (!(await modelSelect.isVisible().catch(() => false))) {
    modelSelect = page.locator('#model-selection');
  }

  // Wait up to 15s for real options to appear after clicking Check API
  const deadline = Date.now() + 15000;
  let lastTexts: string[] = [];
  while (Date.now() < deadline) {
    if (await modelSelect.isVisible().catch(() => false)) {
      const options = modelSelect.locator('option:not([disabled])');
      const count = await options.count();
      if (count > 0) {
        const texts = await Promise.all(
          Array.from({ length: count }, (_, i) => options.nth(i).textContent())
        );
        lastTexts = texts.map(t => (t || '').trim());
        // Accept if at least one is not the placeholder
        if (lastTexts.some(t => t && !/no models available/i.test(t))) break;
      }
    }
    await page.waitForTimeout(200);
  }

  // Assert we have usable options
  await expect(modelSelect).toBeVisible();
  const usableOptions = modelSelect.locator('option:not([disabled])');
  const count = await usableOptions.count();
  if (count === 0 || !lastTexts.some(t => t && !/no models available/i.test(t))) {
    // Gather diagnostics
    const msg = await page.locator('p:has-text("API connection")').innerText().catch(() => '');
    throw new Error(`Models did not populate within timeout. Options seen: [${lastTexts.join(' | ')}]. Message: ${msg}`);
  }

  // Save and close
  const saveBtn = page.getByRole('button', { name: /^save$/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();
  await expect(page.getByRole('heading', { name: /settings/i })).toBeHidden({ timeout: 5000 });
}

export async function operateQuickSettings(page: Page, opts: { mode?: 'ensure-open' | 'ensure-closed' | 'open' | 'close', model?: string | RegExp, reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high', verbosity?: 'low' | 'medium' | 'high', summary?: 'auto' | 'detailed' | 'null', closeAfter?: boolean } = {}) {
  const { mode = 'ensure-open', model, reasoningEffort, verbosity, summary, closeAfter = false } = opts;

  const toggle = page.locator('button[aria-controls="quick-settings-body"]');
  await expect(toggle).toBeVisible();
  const body = page.locator('#quick-settings-body');

  const isOpen = async () => (await toggle.getAttribute('aria-expanded')) === 'true' || (await body.isVisible().catch(() => false));

  // Open/ensure-open
  if (mode === 'open' || mode === 'ensure-open') {
    if (!(await isOpen())) {
      await toggle.click();
      await expect(body).toBeVisible();
    }
  } else if (mode === 'ensure-closed' || mode === 'close') {
    if (await isOpen()) {
      await toggle.click();
      await expect(body).toBeHidden();
    }
    if (mode !== 'ensure-closed') return; // close only
  }

  // If we reach here, panel is open
  const within = body;
  // Locate model select within body
  let modelSelect = within.locator('#current-model-select');
  if (!(await modelSelect.isVisible().catch(() => false))) {
    modelSelect = within.getByRole('combobox', { name: /api model|current model|model/i });
  }

  // If a model is requested or we need to ensure population, wait for options
  const needModel = !!model;
  if (needModel) {
    await expect(modelSelect).toBeVisible();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const options = modelSelect.locator('option:not([disabled])');
      const count = await options.count();
      if (count > 0) {
        const texts = await Promise.all(Array.from({ length: count }, (_, i) => options.nth(i).textContent()));
        if (texts.some(t => (t || '').trim() && !/no models loaded|no models/i.test(t || ''))) break;
      }
      await page.waitForTimeout(200);
    }
    await expect(modelSelect).toBeVisible();

    // Select model by label/value
    const options = modelSelect.locator('option');
    const count = await options.count();
    let selectedValue: string | null = null;
    const prefer = model instanceof RegExp ? model : new RegExp(String(model), 'i');
    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const label = ((await opt.textContent()) || '').trim();
      const value = (await opt.getAttribute('value')) || '';
      if (prefer.test(label) || prefer.test(value)) { selectedValue = value || label; break; }
    }
    if (!selectedValue) {
      // fallback to gpt-5-nano, then gpt-5*
      for (let i = 0; i < count && !selectedValue; i++) {
        const opt = options.nth(i);
        const label = ((await opt.textContent()) || '').trim();
        const value = (await opt.getAttribute('value')) || '';
        if (/gpt-5-nano/i.test(label) || /gpt-5-nano/i.test(value)) { selectedValue = value || label; break; }
      }
      for (let i = 0; i < count && !selectedValue; i++) {
        const opt = options.nth(i);
        const label = ((await opt.textContent()) || '').trim();
        const value = (await opt.getAttribute('value')) || '';
        if (/gpt-5/i.test(label) || /gpt-5/i.test(value)) { selectedValue = value || label; break; }
      }
    }
    if (!selectedValue) {
      const labels = await Promise.all(Array.from({ length: count }, (_, i) => options.nth(i).textContent()));
      throw new Error(`Could not find a suitable model. Available: ${labels.map(t => (t||'').trim()).join(' | ')}`);
    }
    await modelSelect.selectOption(selectedValue);
  }

  // Reasoning controls (best-effort)
  const setIf = async (sel: string, val: string | undefined) => {
    if (!val) return;
    const el = within.locator(sel);
    if (await el.isVisible().catch(() => false)) {
      await el.selectOption(val);
    }
  };
  await setIf('#reasoning-effort', reasoningEffort as any);
  await setIf('#verbosity', verbosity as any);
  await setIf('#summary', summary as any);

  if (closeAfter) {
    if (await isOpen()) {
      await toggle.click();
      await expect(body).toBeHidden();
    }
  }
}

export async function selectReasoningModelInQuickSettings(page: Page) {
  // Open Quick Settings panel
  // Delegate to generalized helper to avoid double-toggling
  await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i, closeAfter: false });

  // After ensuring open, continue legacy selection flow (no-op if already selected)

  // Prefer role-based combobox, fallback to id
  let modelSelect = page.getByRole('combobox', { name: /api model|current model/i });
  if (!(await modelSelect.isVisible().catch(() => false))) {
    modelSelect = page.locator('#current-model-select');
  }
  await expect(modelSelect).toBeVisible();

  // Wait for options to be populated
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const options = modelSelect.locator('option:not([disabled])');
    const count = await options.count();
    if (count > 0) {
      const texts = await Promise.all(Array.from({ length: count }, (_, i) => options.nth(i).textContent()));
      if (texts.some(t => (t || '').trim() && !/no models/i.test(t || ''))) break;
    }
    await page.waitForTimeout(200);
  }

  const options = modelSelect.locator('option');
  const count = await options.count();
  let selectedValue: string | null = null;
  for (let i = 0; i < count; i++) {
    const opt = options.nth(i);
    const label = ((await opt.textContent()) || '').trim();
    const value = await opt.getAttribute('value');
    if (/gpt-5-nano/i.test(label) || /gpt-5-nano/i.test(value || '')) {
      selectedValue = value || label;
      break;
    }
  }
  if (!selectedValue) {
    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const label = ((await opt.textContent()) || '').trim();
      const value = await opt.getAttribute('value');
      if (/gpt-5/i.test(label) || /gpt-5/i.test(value || '')) {
        selectedValue = value || label;
        break;
      }
    }
  }
  if (!selectedValue) {
    const labels = await Promise.all(Array.from({ length: count }, (_, i) => options.nth(i).textContent()));
    throw new Error(`Could not find a reasoning model in Quick Settings. Available: ${labels.map(t => (t||'').trim()).join(' | ')}`);
  }
  await modelSelect.selectOption(selectedValue);
}
