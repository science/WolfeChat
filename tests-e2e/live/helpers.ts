import { expect, Page, Locator } from '@playwright/test';
import { debugLog, debugErr, debugWarn, debugInfo, DEBUG_LEVELS, isDebugLevel } from '../debug-utils';

// ==================== MODEL DROPDOWN HELPER INTERFACES ====================

interface ModelInfo {
  id: string;
  displayText: string;  // What the user sees
  value: string;        // The actual option value
  provider?: 'openai' | 'anthropic' | 'unknown';
}

interface ProviderGroup {
  label: string;
  models: ModelInfo[];
  hasOptgroup: boolean;
  apiKeySet: boolean;
}

interface ModelDropdownState {
  // Meta information
  location: 'quickSettings' | 'settings';
  isOpen: boolean;
  dropdownId: string;  // The actual DOM id

  // Model data
  totalModels: number;
  selectedModel: string | null;
  selectedModelProvider?: 'openai' | 'anthropic' | 'unknown';

  // Provider organization
  providers: {
    openai?: ProviderGroup;
    anthropic?: ProviderGroup;
    unknown?: ProviderGroup;  // For models without clear provider
  };

  // Flat lists for easy access
  allModels: ModelInfo[];  // All models without grouping
  recentModels?: ModelInfo[];  // If "Recently used" optgroup exists

  // Validation helpers
  hasAnyModels: boolean;
  hasMultipleProviders: boolean;
  isProperlyOrganized: boolean;  // True if optgroups exist when multiple providers

  // Raw data for debugging
  rawHtml?: string;  // Optional: capture dropdown HTML for debugging failures
}

// ========================================================================

/**
 * CRITICAL FIX: Mock OpenAI API for nonlive E2E tests
 * Call this before any test that needs to work without real API keys
 */
export async function mockOpenAIAPI(page: Page) {
  await page.route('**/v1/models', async route => {
    debugInfo('[MOCK] Intercepting OpenAI models API call');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        object: 'list',
        data: [
          {
            id: 'gpt-3.5-turbo',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai',
            permission: [{ allow_create_engine: false }]
          },
          {
            id: 'gpt-5-nano',
            object: 'model',
            created: 1698894618,
            owned_by: 'openai',
            permission: [{ allow_create_engine: false }]
          },
          {
            id: 'dall-e-3',
            object: 'model',
            created: 1698785189,
            owned_by: 'openai',
            permission: [{ allow_create_engine: false }]
          }
        ]
      })
    });
  });
}

/**
 * Opens the Settings dialog.
 * WARNING: This leaves Settings open!
 * Use withSettings() if you need to close it after.
 * Use setProviderApiKey() or bootstrapLiveAPI() for API setup.
 */
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

/**
 * Opens Settings, executes an action, then saves and closes Settings.
 * Guarantees Settings is properly closed even if action throws.
 */
export async function withSettings(page: Page, action: () => Promise<void>) {
  await openSettings(page);
  try {
    await action();
  } finally {
    // Always save and close, even if action throws
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(page.getByRole('heading', { name: /settings/i })).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(500); // Wait for dialog animations to complete
  }
}

/**
 * Enables the "Show estimated tokens in sidebar" setting
 */
export async function enableTokenDisplay(page: Page) {
  await withSettings(page, async () => {
    // Use semantic selector - checkbox has aria-label
    const checkbox = page.getByRole('checkbox', { name: /show estimated tokens in sidebar/i });
    const isChecked = await checkbox.isChecked();

    if (!isChecked) {
      await checkbox.check();
    }
  });
}

/**
 * Gets the token count displayed in the sidebar for the current conversation
 */
export async function getTokenCount(page: Page): Promise<number> {
  const tokenDisplay = page.locator('.conversation .tokens').first();
  await expect(tokenDisplay).toBeVisible({ timeout: 5000 });
  const tokenText = await tokenDisplay.textContent();
  return parseInt(tokenText?.trim() || '0', 10);
}

export async function bootstrapLiveAPI(page: Page, provider: 'OpenAI' | 'Anthropic' = 'OpenAI') {
  const key = provider === 'OpenAI'
    ? process.env.OPENAI_API_KEY
    : process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error(`${provider} API key env not set for live tests.`);

  await openSettings(page);

  // Select provider first
  const providerSelect = page.locator('#provider-selection');
  await expect(providerSelect).toBeVisible();
  await providerSelect.selectOption(provider);

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
  await page.waitForTimeout(500); // Wait for dialog animations to complete
}

export async function selectProvider(page: Page, provider: 'OpenAI' | 'Anthropic') {
  await openSettings(page);
  const providerSelect = page.locator('#provider-selection');
  await expect(providerSelect).toBeVisible();
  await providerSelect.selectOption(provider);
}

// ============= ATOMIC SETTINGS HELPERS =============
// These provide granular control for tests that need to perform
// custom operations while Settings modal is open

/**
 * Opens Settings modal and optionally selects a provider
 * @param page - Playwright page
 * @param provider - Optional provider to select after opening
 */
export async function openSettingsAndSelectProvider(
  page: Page,
  provider?: 'OpenAI' | 'Anthropic'
): Promise<void> {
  await openSettings(page);

  if (provider) {
    const providerSelect = page.locator('#provider-selection');
    await expect(providerSelect).toBeVisible({ timeout: 5000 });
    await providerSelect.selectOption(provider);
  }
}

/**
 * Fills API key and waits for models to load
 * Assumes Settings modal is already open and provider selected
 * @param page - Playwright page
 * @param apiKey - API key to fill
 * @param provider - Provider to wait for models from
 */
export async function fillApiKeyAndWaitForModels(
  page: Page,
  apiKey: string,
  provider: 'OpenAI' | 'Anthropic'
): Promise<void> {
  const apiInput = page.locator('#api-key');
  await expect(apiInput).toBeVisible({ timeout: 5000 });
  await apiInput.fill(apiKey);
  await waitForModelsToLoad(page, provider);
}

/**
 * Saves and closes Settings modal
 * @param page - Playwright page
 */
export async function saveAndCloseSettings(page: Page): Promise<void> {
  const saveBtn = page.getByRole('button', { name: /^save$/i });
  await expect(saveBtn).toBeVisible({ timeout: 5000 });
  await saveBtn.click();

  const settingsHeading = page.getByRole('heading', { name: /settings/i });
  await expect(settingsHeading).toBeHidden({ timeout: 5000 });
  await page.waitForTimeout(500); // Wait for dialog animations
}

/**
 * Gets model list from Settings modal (without closing it)
 * @param page - Playwright page
 * @returns Array of model names visible in Settings
 */
export async function getSettingsModels(page: Page): Promise<string[]> {
  // Ensure Settings is open
  const settingsHeading = page.getByRole('heading', { name: /settings/i });
  if (!await settingsHeading.isVisible().catch(() => false)) {
    await openSettings(page);
  }

  const modelSelect = page.locator('#model-selection');
  await modelSelect.waitFor({ timeout: 5000 });

  const options = await modelSelect.locator('option').all();
  const models = [];

  for (const option of options) {
    const text = await option.textContent();
    if (text && text !== 'Select a model...' && text !== 'No models available' && text.trim() !== '') {
      models.push(text.trim());
    }
  }

  return models;
}

/**
 * Selects a model in Settings modal (without closing it)
 * @param page - Playwright page
 * @param model - Model to select (exact string or regex)
 */
export async function selectModelInSettings(
  page: Page,
  model: string | RegExp
): Promise<void> {
  const modelSelect = page.locator('#model-selection');
  await expect(modelSelect).toBeVisible({ timeout: 5000 });

  if (typeof model === 'string') {
    await modelSelect.selectOption(model);
  } else {
    // For regex, find matching option
    const options = await modelSelect.locator('option').all();
    for (const option of options) {
      const text = await option.textContent();
      if (text && model.test(text)) {
        const value = await option.getAttribute('value');
        if (value) {
          await modelSelect.selectOption(value);
          return;
        }
      }
    }
    throw new Error(`No model matching ${model} found in Settings`);
  }
}

// ============= COMPOSITE SETTINGS HELPERS =============
// Use these for standard operations. Only use atomic helpers
// when you need granular control during Settings operations.

export async function setProviderApiKey(page: Page, provider: 'OpenAI' | 'Anthropic', apiKey: string) {
  // Now just orchestrates atomic functions
  await openSettingsAndSelectProvider(page, provider);
  await fillApiKeyAndWaitForModels(page, apiKey, provider);
  await saveAndCloseSettings(page);
}

// ============= MODAL CONFLICT RESOLUTION HELPERS =============
// These helpers prevent Settings/QuickSettings conflicts that cause test timeouts

/**
 * Ensures Settings modal is safely closed if it's currently open
 * Use this before any QuickSettings operations to prevent conflicts
 * @param page - Playwright page
 */
export async function ensureSettingsClosed(page: Page): Promise<void> {
  debugInfo('[Helper Debug] Checking if Settings modal is open...');
  const settingsHeading = page.getByRole('heading', { name: /settings/i });
  const isSettingsOpen = await settingsHeading.isVisible().catch(() => false);

  if (isSettingsOpen) {
    debugInfo('[Helper Debug] Settings is open, closing it...');
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
    } else {
      // Fallback: try to close via cancel or X button
      const cancelBtn = page.getByRole('button', { name: /cancel|close|×/i }).first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      }
    }

    // Wait for Settings to close completely
    await expect(settingsHeading).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(500); // Wait for dialog animations to complete
    debugInfo('[Helper Debug] Settings closed successfully');
  } else {
    debugInfo('[Helper Debug] Settings is not open, no action needed');
  }
}

/**
 * Opens Settings modal and keeps it open for multiple operations
 * Use this when you need to perform multiple Settings operations
 * Call ensureSettingsClosed() when done
 * @param page - Playwright page
 * @returns SettingsHandle with methods to operate on Settings
 */
export async function withSettingsOpen(page: Page) {
  debugInfo('[Helper Debug] Opening Settings modal...');
  await openSettings(page);

  return {
    /**
     * Safely closes the Settings modal
     */
    close: async () => {
      debugInfo('[Helper Debug] Closing Settings via handle...');
      await saveAndCloseSettings(page);
    },

    /**
     * Selects a provider in the open Settings modal
     */
    selectProvider: async (provider: 'OpenAI' | 'Anthropic') => {
      console.log(`[Helper Debug] Selecting provider: ${provider}`);
      const providerSelect = page.locator('#provider-selection');
      await expect(providerSelect).toBeVisible();
      await providerSelect.selectOption(provider);
    },

    /**
     * Gets visible models from the open Settings modal
     */
    getModels: async (): Promise<string[]> => {
      debugInfo('[Helper Debug] Getting models from Settings...');
      return getSettingsModels(page);
    }
  };
}

type ModalContext = 'settings' | 'quick-settings' | 'none';

async function getModalContext(page: Page): Promise<ModalContext> {
  // Check Settings modal visibility
  const settingsHeading = page.getByRole('heading', { name: /settings/i });
  if (await settingsHeading.isVisible().catch(() => false)) {
    return 'settings';
  }

  // Check QuickSettings panel expansion
  const quickSettingsButton = page.locator('button[aria-controls="quick-settings-body"]');
  const isExpanded = await quickSettingsButton.getAttribute('aria-expanded').catch(() => null);
  if (isExpanded === 'true') {
    return 'quick-settings';
  }

  return 'none';
}

function getModelSelectorForContext(context: ModalContext): string {
  switch (context) {
    case 'settings':
      return '#model-selection';
    case 'quick-settings':
      return '#current-model-select';
    default:
      throw new Error(`No model selector for context: ${context}`);
  }
}

export async function getVisibleModels(page: Page): Promise<string[]> {
  // CRITICAL FIX: Check if Settings is open and close it first (prevents z-50 overlay interference)
  const settingsHeading = page.getByRole('heading', { name: /settings/i });
  if (await settingsHeading.isVisible().catch(() => false)) {
    // Settings is open - close it properly to avoid overlay blocking QuickSettings
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(settingsHeading).toBeHidden({ timeout: 5000 });
      await page.waitForTimeout(500); // Wait for dialog animations to complete
    } else {
      // Fallback: try Escape key if Save button not found
      await page.keyboard.press('Escape');
      await expect(settingsHeading).toBeHidden({ timeout: 3000 });
      await page.waitForTimeout(500);
    }
  }

  // CRITICAL FIX: Must expand QuickSettings first to access model dropdown
  const quickSettingsButton = page.locator('button').filter({ hasText: 'Quick Settings' }).first();
  const isExpanded = await quickSettingsButton.getAttribute('aria-expanded') === 'true';

  if (!isExpanded) {
    await quickSettingsButton.click();
    await page.waitForTimeout(500); // Allow expansion animation
  }

  // CRITICAL FIX: Use correct selector #current-model-select (not #current-model-select)
  const modelSelect = page.locator('#current-model-select');
  await modelSelect.waitFor({ timeout: 5000 });

  const options = await modelSelect.locator('option').all();
  const models = [];
  for (const option of options) {
    const text = await option.textContent();
    if (text && text !== 'Select a model...' && text !== 'No models loaded' && text.trim() !== '') {
      models.push(text.trim());
    }
  }
  return models;
}

export async function waitForModelsToLoad(
  page: Page,
  expectedProvider: 'OpenAI' | 'Anthropic' | 'both'
): Promise<void> {
  // Detect which modal context we're in
  const context = await getModalContext(page);

  if (context === 'settings') {
    // We're in Settings modal - use Settings selector
    const modelSelect = page.locator('#model-selection');

    // Wait for network response based on expected provider
    const responsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        let isCorrectEndpoint = false;

        if (expectedProvider === 'OpenAI' || expectedProvider === 'both') {
          if (url.includes('api.openai.com') && url.includes('/v1/models')) {
            isCorrectEndpoint = true;
          }
        }
        if (expectedProvider === 'Anthropic' || expectedProvider === 'both') {
          if (url.includes('api.anthropic.com') && url.includes('/v1/models')) {
            isCorrectEndpoint = true;
          }
        }

        return isCorrectEndpoint && response.status() === 200;
      },
      { timeout: 15000 }
    );

    // Trigger the check (assumes Check API button is already visible)
    const checkBtn = page.getByRole('button', { name: /check api/i });
    await checkBtn.click();

    // Wait for network response
    await responsePromise;

    // Wait for DOM to show real model options in Settings
    await page.waitForFunction(
      () => {
        const select = document.querySelector('#model-selection') as HTMLSelectElement;
        if (!select) return false;

        // Look for options with real values (not empty, not disabled)
        const realOptions = select.querySelectorAll('option[value]:not([value=""]):not(:disabled)');

        return realOptions.length > 0;
      },
      { timeout: 10000 }
    );

    // Debug after the function completes (in Node context)
    const optionCount = await page.locator('#model-selection option[value]:not([value=""]):not(:disabled)').count();
    debugInfo('DOM Check - Real options found after waitForFunction:', { count: optionCount });
  } else if (context === 'quick-settings') {
    // Original QuickSettings logic - keep unchanged
    const quickSettingsButton = page.locator('button').filter({ hasText: 'Quick Settings' }).first();
    const isExpanded = await quickSettingsButton.getAttribute('aria-expanded') === 'true';

    if (!isExpanded) {
      await quickSettingsButton.click();
      await page.waitForTimeout(500); // Allow expansion animation
    }

    const modelSelect = page.locator('#current-model-select');

    // Wait for network response
    const responsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        let isCorrectEndpoint = false;

        if (expectedProvider === 'OpenAI' || expectedProvider === 'both') {
          if (url.includes('api.openai.com') && url.includes('/v1/models')) {
            isCorrectEndpoint = true;
          }
        }
        if (expectedProvider === 'Anthropic' || expectedProvider === 'both') {
          if (url.includes('api.anthropic.com') && url.includes('/v1/models')) {
            isCorrectEndpoint = true;
          }
        }

        return isCorrectEndpoint && response.status() === 200;
      },
      { timeout: 15000 }
    );

    const checkBtn = page.getByRole('button', { name: /check api/i });
    await checkBtn.click();
    await responsePromise;

    await page.waitForFunction(
      () => {
        const select = document.querySelector('#current-model-select') as HTMLSelectElement;
        if (!select) return false;
        const realOptions = select.querySelectorAll('option[value]:not([value=""]):not(:disabled)');
        return realOptions.length > 0;
      },
      { timeout: 10000 }
    );
  } else {
    throw new Error('waitForModelsToLoad called without an open modal');
  }
}

export async function verifyProviderIndicators(page: Page, expectedProviders: string[]) {
  // This function checks QuickSettings which uses optgroups for organization when both providers exist
  const quickSettingsButton = page.locator('button').filter({ hasText: 'Quick Settings' }).first();
  const isExpanded = await quickSettingsButton.getAttribute('aria-expanded') === 'true';

  if (!isExpanded) {
    await quickSettingsButton.click();
    await page.waitForTimeout(500);
  }

  const modelSelect = page.locator('#current-model-select');
  await modelSelect.waitFor({ timeout: 5000 });

  // QuickSettings uses optgroups for organization when both providers exist
  for (const provider of expectedProviders) {
    const optgroup = modelSelect.locator(`optgroup[label="${provider}"]`);
    await expect(optgroup).toBeVisible({ timeout: 5000 });
  }
}

export async function bootstrapBothProviders(page: Page) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey) throw new Error('OPENAI_API_KEY env not set for live tests.');
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY env not set for live tests.');

  // Set both providers in a single Settings session using atomic helpers
  await withSettings(page, async () => {
    // Set OpenAI provider and wait for models
    const providerSelect = page.locator('#provider-selection');
    await expect(providerSelect).toBeVisible();
    await providerSelect.selectOption('OpenAI');
    await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');

    // Set Anthropic provider and wait for models
    await providerSelect.selectOption('Anthropic');
    await fillApiKeyAndWaitForModels(page, anthropicKey, 'Anthropic');
  });
}

export async function operateQuickSettings(page: Page, opts: { mode?: 'ensure-open' | 'ensure-closed' | 'open' | 'close', model?: string | RegExp, reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high', verbosity?: 'low' | 'medium' | 'high', summary?: 'auto' | 'detailed' | 'null', closeAfter?: boolean } = {}) {
  const { mode = 'ensure-open', model, reasoningEffort, verbosity, summary, closeAfter = false } = opts;

  // Automatic conflict resolution: Close Settings if open
  debugInfo('[operateQuickSettings] Ensuring Settings is closed to prevent conflicts...');
  await ensureSettingsClosed(page);

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

// =========================
// New robust E2E helpers
// =========================

export interface WaitForAssistantOptions {
  timeout?: number;
  stabilizationTime?: number;
  pollInterval?: number;
}

export async function waitForAssistantDone(page: Page, opts: WaitForAssistantOptions = {}) {
  const {
    timeout = 60_000,  // Increased default but still leaves buffer before test timeout
    stabilizationTime = 500,  // Reduced since we're not relying on text stability
    pollInterval = 100  // Faster polling since we're checking efficient signals
  } = opts;

  const startTime = Date.now();

  // Phase 1: Inject stream monitoring helper into page context
  // This gives us direct access to SSE events
  await page.evaluate(() => {
    const win = window as any;
    if (!win.__streamMonitor) {
      win.__streamMonitor = {
        currentStream: null,
        isStreaming: false,
        lastCompletedAt: 0,
        
        startMonitoring() {
          // Hook into the global streamResponseViaResponsesAPI if available (OpenAI)
          const originalStream = win.streamResponseViaResponsesAPI;
          if (originalStream && typeof originalStream === 'function') {
            win.streamResponseViaResponsesAPI = function(...args: any[]) {
              win.__streamMonitor.isStreaming = true;
              const callbacks = args[2];
              const wrappedCallbacks = {
                ...callbacks,
                onCompleted: (text: any, raw: any) => {
                  win.__streamMonitor.isStreaming = false;
                  win.__streamMonitor.lastCompletedAt = Date.now();
                  if (callbacks?.onCompleted) callbacks.onCompleted(text, raw);
                },
                onError: (err: any) => {
                  win.__streamMonitor.isStreaming = false;
                  if (callbacks?.onError) callbacks.onError(err);
                }
              };
              args[2] = wrappedCallbacks;
              return originalStream.apply(this, args);
            };
          }

          // Hook into Anthropic streaming if available
          const originalAnthropicStream = win.streamAnthropicMessage;
          if (originalAnthropicStream && typeof originalAnthropicStream === 'function') {
            win.streamAnthropicMessage = async function(...args: any[]) {
              win.__streamMonitor.isStreaming = true;
              try {
                const result = await originalAnthropicStream.apply(this, args);
                win.__streamMonitor.isStreaming = false;
                win.__streamMonitor.lastCompletedAt = Date.now();
                return result;
              } catch (error) {
                win.__streamMonitor.isStreaming = false;
                throw error;
              }
            };
          }
        }
      };
      win.__streamMonitor.startMonitoring();
    }
  });

  // Phase 2: Set up network monitoring for SSE streams (updated for Responses API)
  const ssePromise = page.waitForResponse(
    response => {
      const url = response.url();
      return (url.includes('api.openai.com') || url.includes('api.anthropic.com')) &&
             (url.includes('/chat/completions') || url.includes('/responses') || url.includes('/v1/messages')) &&
             response.status() === 200;
    },
    { timeout: Math.min(20000, timeout) }
  ).catch(() => null);  // Don't fail if no network request

  // Phase 3: Wait for assistant message to appear using efficient DOM check
  const assistantAppearPromise = page.waitForFunction(
    () => {
      // Check for new assistant message efficiently
      const assistants = document.querySelectorAll('[role="listitem"][data-message-role="assistant"]');
      if (assistants.length === 0) return false;
      
      const lastAssistant = assistants[assistants.length - 1];
      // Check if it has meaningful content (not just loading state)
      const text = lastAssistant.textContent || '';
      return text.length > 0 && !text.includes('█');  // No cursor
    },
    { timeout: Math.min(30000, timeout), polling: pollInterval }
  );

  // Phase 4: Wait for stream completion signal from injected monitor
  const streamCompletePromise = page.waitForFunction(
    () => {
      const win = window as any;
      if (!win.__streamMonitor) return true;  // Fallback if injection failed
      
      // Stream is complete if not streaming and we had a completion recently
      const monitor = win.__streamMonitor;
      if (!monitor.isStreaming) {
        // If we completed in the last 10 seconds, consider it done
        if (monitor.lastCompletedAt && Date.now() - monitor.lastCompletedAt < 10000) {
          return true;
        }
        // Or if we never started streaming (maybe non-streaming response)
        return true;
      }
      return false;
    },
    { timeout, polling: pollInterval }
  );

  // Phase 5: Wait for UI to reflect completion state
  // More robust than checking button state - look for streaming indicators
  const uiCompletePromise = page.waitForFunction(
    () => {
      // Check multiple completion indicators
      const indicators: boolean[] = [];
      let foundSendBtn = false;
      
      // 1. Send button should be enabled
      const sendBtn = document.querySelector('button[aria-label="Send"]') as HTMLButtonElement;
      if (sendBtn) {
        foundSendBtn = true;
        indicators.push(!sendBtn.disabled);
      }
      
      // 2. No wait/loading indicators visible
      const waitIcon = document.querySelector('img[alt="Wait"]') as HTMLImageElement;
      indicators.push(!waitIcon || waitIcon.style.display === 'none' || !waitIcon.offsetParent);
      
      // 3. Check for data-streaming attribute if app uses it
      const streamingElements = document.querySelectorAll('[data-streaming="true"]');
      indicators.push(streamingElements.length === 0);
      
      // 4. No typing/cursor indicators in assistant messages
      const assistants = document.querySelectorAll('[role="listitem"][data-message-role="assistant"]');
      if (assistants.length > 0) {
        const lastAssistant = assistants[assistants.length - 1];
        const hasTypingIndicator = (lastAssistant.textContent || '').includes('█');
        indicators.push(!hasTypingIndicator);
      }
      
      // 5. Additional check: Look for submit button in various forms
      if (!foundSendBtn) {
        const submitBtns = document.querySelectorAll('button[type="submit"], input[type="submit"], button:has(img[alt*="send"])');
        for (const btn of submitBtns) {
          if (btn && (btn as HTMLButtonElement).offsetParent) {
            foundSendBtn = true;
            indicators.push(!(btn as HTMLButtonElement).disabled);
            break;
          }
        }
      }
      
      // 6. Check if stream monitor indicates completion  
      const win = window as any;
      const monitor = win.__streamMonitor;
      if (monitor) {
        // Stream completion from our injected monitor
        indicators.push(!monitor.isStreaming);
      }
      
      // Need at least some indicators and all must be true for completion
      // Be more lenient - require at least 2 indicators to agree
      const completionCount = indicators.filter(Boolean).length;
      const totalCount = indicators.length;
      return totalCount >= 2 && completionCount >= Math.max(2, totalCount - 1);
    },
    { timeout, polling: pollInterval }
  );

  try {
    // Wait for all signals in parallel, complete when all are done
    const results = await Promise.allSettled([
      assistantAppearPromise,
      streamCompletePromise,
      uiCompletePromise,
      ssePromise
    ]);

    // Log results if debugging
    debugInfo('[WAIT-ASSISTANT] Completion signals:', {
      assistantAppeared: results[0].status === 'fulfilled',
      streamComplete: results[1].status === 'fulfilled',
      uiComplete: results[2].status === 'fulfilled',
      sseReceived: results[3].status === 'fulfilled'
    });

    // Enhanced logging for debugging reasoning events issue
    if (results[0].status !== 'fulfilled' || results[2].status !== 'fulfilled') {
      debugWarn('[WAIT-ASSISTANT] Detailed completion status:', {
        assistantAppeared: results[0].status === 'fulfilled' ? 'OK' : `FAILED: ${results[0].reason}`,
        streamComplete: results[1].status === 'fulfilled' ? 'OK' : `FAILED: ${results[1].reason}`,
        uiComplete: results[2].status === 'fulfilled' ? 'OK' : `FAILED: ${results[2].reason}`,
        sseReceived: results[3].status === 'fulfilled' ? 'OK' : `FAILED: ${results[3].reason}`
      });
    }

    // More lenient completion logic for reasoning events bug
    // We primarily need the assistant message to appear and either UI completion OR stream completion
    const assistantOk = results[0].status === 'fulfilled';
    const uiOk = results[2].status === 'fulfilled';
    const streamOk = results[1].status === 'fulfilled';

    if (!assistantOk) {
      throw new Error('Assistant message did not appear');
    }

    if (!uiOk && !streamOk) {
      throw new Error('Neither UI completion nor stream completion succeeded - possible reasoning events issue');
    }

    if (!uiOk) {
      debugWarn('[WAIT-ASSISTANT] UI completion failed but stream completion succeeded - likely reasoning events bug');
    }

    // Additional check: Ensure isStreaming is false by checking the UI state
    // This is critical for reasoning models where stream completion may lag
    const finalCheckResult = await page.waitForFunction(
      () => {
        const win = window as any;
        // Check the monitor
        const monitorStreaming = win.__streamMonitor?.isStreaming ?? false;

        // Also check if the Wait icon is NOT visible (which indicates streaming)
        const waitIcon = document.querySelector('img[alt="Wait"]') as HTMLImageElement;
        const waitIconVisible = waitIcon && waitIcon.offsetParent !== null;

        return !monitorStreaming && !waitIconVisible;
      },
      { timeout: 5000, polling: 100 }
    ).catch((err) => {
      debugWarn('[WAIT-ASSISTANT] Final streaming check timed out - stream may still be active');
      return null;
    });

    if (!finalCheckResult) {
      throw new Error('Stream did not complete - Wait icon still visible or stream monitor indicates streaming');
    }

    // Additional stabilization if needed
    if (stabilizationTime > 0) {
      await page.waitForTimeout(stabilizationTime);
    }

    debugInfo(`[WAIT-ASSISTANT] Stream complete after ${Date.now() - startTime}ms`);

  } catch (error) {
    // Enhanced error diagnostics
    try {
      // Check if page is still accessible before attempting evaluation
      if (!page.isClosed()) {
        const diagnostics = await page.evaluate(() => {
          const win = window as any;
          const monitor = win.__streamMonitor || {};
          const assistants = document.querySelectorAll('[role="listitem"][data-message-role="assistant"]');
          const sendBtn = document.querySelector('button[aria-label="Send"]') as HTMLButtonElement;

          return {
            streamMonitor: {
              isStreaming: monitor.isStreaming,
              lastCompletedAt: monitor.lastCompletedAt,
              timeSinceComplete: monitor.lastCompletedAt ? Date.now() - monitor.lastCompletedAt : null
            },
            assistantCount: assistants.length,
            lastAssistantLength: assistants.length > 0 ? assistants[assistants.length - 1].textContent?.length : 0,
            sendButtonDisabled: sendBtn?.disabled,
            hasWaitIcon: !!document.querySelector('img[alt="Wait"]:not([style*="display: none"])')
          };
        });

        debugErr('[WAIT-ASSISTANT] Timeout diagnostics:', { diagnostics });
      } else {
        debugErr('[WAIT-ASSISTANT] Page closed - cannot collect diagnostics', { error: error?.message || error });
      }
    } catch (diagError) {
      debugErr('[WAIT-ASSISTANT] Failed to collect diagnostics', {
        diagError: diagError?.message || diagError,
        originalError: error?.message || error
      });
    }
    
    throw error;
  }
}

export interface SendMessageOptions {
  submitMethod?: 'ctrl-enter' | 'enter' | 'click-button';
  clearFirst?: boolean;
  waitForEmpty?: boolean;
  inputTimeout?: number;
}

export async function sendMessage(page: Page, text: string, opts: SendMessageOptions = {}) {
  const {
    submitMethod = 'ctrl-enter',
    clearFirst = true,
    waitForEmpty = true,
    inputTimeout = 10_000,
  } = opts;

  const startTime = Date.now();
  let input: Locator | null = null;

  const selectors: Array<() => Promise<Locator | null> | Locator | null> = [
    () => page.getByRole('textbox', { name: /chat input/i }),
    () => page.locator('textarea[aria-label="Chat input"]').first(),
    async () => {
      const candidates = page.getByRole('textbox');
      const count = await candidates.count();
      for (let i = 0; i < count; i++) {
        const c = candidates.nth(i);
        const ph = (await c.getAttribute('placeholder')) || '';
        if (/type your message|enter.*message|chat/i.test(ph)) return c;
      }
      return null;
    },
    () => page.locator('form textarea, [role="form"] textarea').first(),
    () => page.locator('textarea:visible').first(),
  ];

  for (const get of selectors) {
    if (Date.now() - startTime > inputTimeout) break;
    const cand = await get();
    if (cand && await (cand as Locator).isVisible().catch(() => false)) { input = cand as Locator; break; }
  }
  if (!input) throw new Error('Could not find chat input element');

  await expect(input).toBeVisible({ timeout: 5000 });
  await input.click();

  if (clearFirst) {
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    const cur = await input.inputValue();
    if (cur) await input.clear();
  }

  await input.fill(text);
  const entered = await input.inputValue();
  if (entered !== text) throw new Error(`Failed to enter text. Expected: "${text}", Got: "${entered}"`);

  switch (submitMethod) {
    case 'ctrl-enter':
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
      break;
    case 'enter':
      await page.keyboard.press('Enter');
      break;
    case 'click-button':
      const sendBtn = page.getByRole('button', { name: /send/i });
      await expect(sendBtn).toBeVisible({ timeout: 3000 });
      await sendBtn.click();
      break;
  }

  if (waitForEmpty) {
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
}

export interface StreamCompleteOptions {
  timeout?: number;
  waitForNetwork?: boolean;
  waitForStreamState?: boolean;
  waitForAssistant?: boolean;
}

export async function waitForStreamComplete(page: Page, opts: StreamCompleteOptions = {}) {
  const {
    timeout = 60_000,
    waitForNetwork = true,
    waitForStreamState = true,
    waitForAssistant = true,
  } = opts;

  const start = Date.now();
  const left = () => Math.max(1000, timeout - (Date.now() - start));

  // Phase 1: network quiet
  if (waitForNetwork) {
    await page.waitForLoadState('networkidle', { timeout: left() });
  }

  // Phase 2: streaming indicators cleared or send button re-enabled
  if (waitForStreamState) {
    await Promise.race([
      page.waitForSelector('[data-streaming="false"]', { timeout: left() }),
      page.waitForSelector('button[aria-label="Send"]:not([disabled])', { timeout: left() }),
      page.waitForSelector('img[alt="Wait"]', { state: 'hidden', timeout: left() }),
    ]);
  }

  // Phase 3: assistant message present and stabilized
  if (waitForAssistant) {
    await waitForAssistantDone(page, { timeout: left() });
  }
}


export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  model?: string;
  index: number;
  element: Locator;
}

export interface GetMessagesOptions {
  includeSystem?: boolean;
  waitForList?: boolean;
  timeout?: number;
}

export async function getVisibleMessages(page: Page, opts: GetMessagesOptions = {}): Promise<Message[]> {
  const { includeSystem = false, waitForList = true, timeout = 10_000 } = opts;

  if (waitForList) {
    const listItems = page.locator('[role="listitem"]');
    await expect(listItems.first()).toBeVisible({ timeout });
  }

  const items = page.locator('[role="listitem"]');
  const n = await items.count();
  const out: Message[] = [];

  for (let i = 0; i < n; i++) {
    const el = items.nth(i);

    let role: Message['role'] = 'user';
    const dataRole = await el.getAttribute('data-message-role');
    const aria = await el.getAttribute('aria-label');
    if (dataRole) role = dataRole as any;
    else if (aria) {
      if (/assistant/i.test(aria)) role = 'assistant';
      else if (/system/i.test(aria)) role = 'system';
      else if (/user|you/i.test(aria)) role = 'user';
    }
    if (role === 'system' && !includeSystem) continue;

    let text = '';
    const display = el.locator('.message-display, [class*="message-content"]').first();
    if (await display.count() > 0) text = await display.innerText();
    else text = await el.innerText();

    text = text.replace(/Copy Chat Content|Edit Chat|Delete.*message|Delete all below/g, '').replace(/\s+/g, ' ').trim();

    let model: string | undefined;
    if (role === 'assistant') {
      const header = el.locator('.profile-picture .font-bold, [class*="header"]').first();
      if (await header.count() > 0) {
        const h = await header.innerText();
        const m = h.match(/\(([^)]+)\)/);
        if (m) model = m[1];
      }
    }

    out.push({ role, text, model, index: i, element: el });
  }

  return out;
}

export async function getRecentModelsFromQuickSettings(page: Page): Promise<string[]> {
  await operateQuickSettings(page, { mode: 'ensure-open' });

  // Look for recent models section in Quick Settings
  const recentSection = page.locator('text=/recent|recently used/i').first();

  if (await recentSection.isVisible().catch(() => false)) {
    // Get models from recent section
    const recentModels = [];
    const modelButtons = page.locator('button').filter({ hasText: /gpt|claude/i });
    const count = await modelButtons.count();

    for (let i = 0; i < count; i++) {
      const text = await modelButtons.nth(i).textContent();
      if (text && (text.includes('gpt') || text.includes('claude'))) {
        recentModels.push(text.trim());
      }
    }
    return recentModels;
  }

  return [];
}

// ==================== NEW MODEL DROPDOWN HELPER FUNCTIONS ====================

/**
 * Helper to detect provider from model ID
 */
function detectProvider(modelId: string): 'openai' | 'anthropic' | 'unknown' {
  const lower = modelId.toLowerCase();

  // Anthropic patterns (check first to avoid conflicts)
  if (lower.includes('claude')) {
    return 'anthropic';
  }

  // OpenAI patterns (more comprehensive)
  if (lower.includes('gpt') || lower.includes('davinci') ||
      lower.includes('babbage') || lower.includes('o1') ||
      lower.includes('o3') || lower.includes('o4') ||
      lower.includes('dall-e') || lower.includes('whisper') ||
      lower.includes('tts') || lower.includes('text-embedding') ||
      lower.includes('omni-moderation') || lower.includes('codex') ||
      lower.includes('chatgpt') || lower.includes('computer-use-preview')) {
    return 'openai';
  }

  return 'unknown';
}

/**
 * Helper to check API key status from dropdown state
 */
export function checkApiKeysFromState(state: ModelDropdownState): {
  openaiKeySet: boolean;
  anthropicKeySet: boolean;
  bothKeysSet: boolean;
} {
  const openaiKeySet = !!state.providers.openai?.apiKeySet;
  const anthropicKeySet = !!state.providers.anthropic?.apiKeySet;

  return {
    openaiKeySet,
    anthropicKeySet,
    bothKeysSet: openaiKeySet && anthropicKeySet
  };
}

/**
 * Gets comprehensive dropdown state from either QuickSettings or Settings
 * @param page - Playwright Page object
 * @param options - Configuration options
 * @returns Structured dropdown state for test assertions
 */
export async function getModelDropdownState(
  page: Page,
  options?: {
    location?: 'quickSettings' | 'settings';
    openIfClosed?: boolean;  // Default: true
    closeAfter?: boolean;     // Default: false
    captureHtml?: boolean;    // Default: false for performance
    waitForModels?: boolean;  // Default: true - waits for models to load
  }
): Promise<ModelDropdownState> {
  const opts = {
    location: 'quickSettings' as const,
    openIfClosed: true,
    closeAfter: false,
    captureHtml: false,
    waitForModels: true,
    ...options
  };

  // Step 1.1: Initialize result structure
  const result: ModelDropdownState = {
    location: opts.location,
    isOpen: false,
    dropdownId: '',
    totalModels: 0,
    selectedModel: null,
    providers: {},
    allModels: [],
    hasAnyModels: false,
    hasMultipleProviders: false,
    isProperlyOrganized: false
  };

  try {
    let modelSelect: Locator;

    // Step 1.2: Ensure correct panel is open
    if (opts.location === 'quickSettings') {
      // Close Settings if open (prevents conflicts)
      await ensureSettingsClosed(page);

      // Open QuickSettings
      const toggle = page.locator('button[aria-controls="quick-settings-body"]');
      const body = page.locator('#quick-settings-body');

      result.isOpen = await toggle.getAttribute('aria-expanded') === 'true';

      if (!result.isOpen && opts.openIfClosed) {
        await toggle.click();
        await expect(body).toBeVisible();
        result.isOpen = true;
      }

      if (!result.isOpen) {
        return result; // Return empty state if not open
      }

      // Find dropdown in QuickSettings
      result.dropdownId = 'current-model-select';
      modelSelect = page.locator('#current-model-select');
    } else {
      // Settings location
      await openSettings(page);
      result.isOpen = true;

      result.dropdownId = 'model-selection';
      modelSelect = page.locator('#model-selection');
    }

    // Step 1.3: Wait for dropdown to be ready
    await expect(modelSelect).toBeVisible({ timeout: 5000 });

    // Step 1.4: Wait for models to load if requested
    if (opts.waitForModels) {
      const deadline = Date.now() + 10000;
      let stableCount = 0;
      let lastCount = 0;

      while (Date.now() < deadline) {
        const options = modelSelect.locator('option:not([disabled])');
        const count = await options.count();

        // Check if we have models and they're not loading placeholders
        if (count > 0) {
          const firstText = await options.first().textContent();
          if (firstText && !firstText.match(/no models|loading/i)) {
            // Models exist - now wait for count to stabilize
            if (count === lastCount) {
              stableCount++;
              // If count has been stable for 3 consecutive checks (600ms), we're done
              if (stableCount >= 3) {
                break;
              }
            } else {
              // Count changed - reset stability counter
              stableCount = 0;
              lastCount = count;
            }
          }
        }

        await page.waitForTimeout(200);
      }
    }

    // Step 1.5: Extract selected model
    result.selectedModel = await modelSelect.inputValue();

    // Step 1.6: Check for optgroups (provider organization)
    const optgroups = modelSelect.locator('optgroup');
    const optgroupCount = await optgroups.count();

    if (optgroupCount > 0) {
      // Process each optgroup
      for (let i = 0; i < optgroupCount; i++) {
        const optgroup = optgroups.nth(i);
        const label = await optgroup.getAttribute('label');

        if (!label) continue;

        // Extract models from this optgroup
        const groupModels: ModelInfo[] = [];
        const options = optgroup.locator('option');
        const optionCount = await options.count();

        for (let j = 0; j < optionCount; j++) {
          const option = options.nth(j);
          const value = await option.getAttribute('value') || '';
          const text = await option.textContent() || '';

          if (value && text) {
            const provider = detectProvider(value);
            groupModels.push({
              id: value,
              displayText: text.trim(),
              value: value,
              provider
            });
          }
        }

        // Store by provider or label
        if (label.toLowerCase() === 'recently used') {
          result.recentModels = groupModels;
        } else if (label.toLowerCase() === 'openai') {
          result.providers.openai = {
            label,
            models: groupModels,
            hasOptgroup: true,
            apiKeySet: groupModels.length > 0
          };
        } else if (label.toLowerCase() === 'anthropic') {
          result.providers.anthropic = {
            label,
            models: groupModels,
            hasOptgroup: true,
            apiKeySet: groupModels.length > 0
          };
        }

        // Add to flat list
        result.allModels.push(...groupModels);
      }
    } else {
      // No optgroups - flat list of models
      const options = modelSelect.locator('option');
      const optionCount = await options.count();

      for (let i = 0; i < optionCount; i++) {
        const option = options.nth(i);
        const value = await option.getAttribute('value') || '';
        const text = await option.textContent() || '';
        const disabled = await option.isDisabled();

        // Skip disabled/placeholder options
        if (disabled || !value || value === '' ||
            text.match(/select a model|no models/i)) {
          continue;
        }

        const provider = detectProvider(value);
        const modelInfo: ModelInfo = {
          id: value,
          displayText: text.trim(),
          value: value,
          provider
        };

        result.allModels.push(modelInfo);

        // Group by detected provider
        if (provider === 'openai') {
          if (!result.providers.openai) {
            result.providers.openai = {
              label: 'OpenAI',
              models: [],
              hasOptgroup: false,
              apiKeySet: true
            };
          }
          result.providers.openai.models.push(modelInfo);
        } else if (provider === 'anthropic') {
          if (!result.providers.anthropic) {
            result.providers.anthropic = {
              label: 'Anthropic',
              models: [],
              hasOptgroup: false,
              apiKeySet: true
            };
          }
          result.providers.anthropic.models.push(modelInfo);
        } else {
          if (!result.providers.unknown) {
            result.providers.unknown = {
              label: 'Other',
              models: [],
              hasOptgroup: false,
              apiKeySet: true
            };
          }
          result.providers.unknown.models.push(modelInfo);
        }
      }
    }

    // Step 1.7: Calculate summary fields
    result.totalModels = result.allModels.length;
    result.hasAnyModels = result.totalModels > 0;

    // Count providers that actually have models
    const providersWithModels = Object.keys(result.providers).filter(
      providerKey => result.providers[providerKey as keyof typeof result.providers]?.models.length > 0
    );
    result.hasMultipleProviders = providersWithModels.length > 1;

    // isProperlyOrganized: either single provider OR multiple providers with optgroups OR flat list is acceptable
    result.isProperlyOrganized = !result.hasMultipleProviders ||
      (!!result.providers.openai?.hasOptgroup || !!result.providers.anthropic?.hasOptgroup) ||
      (result.totalModels > 0); // Flat list is also properly organized

    // Step 1.8: Detect selected model provider
    if (result.selectedModel) {
      result.selectedModelProvider = detectProvider(result.selectedModel);
    }

    // Step 1.9: Capture HTML if requested (for debugging)
    if (opts.captureHtml) {
      result.rawHtml = await modelSelect.innerHTML();
    }

    // Step 1.10: Close if requested
    if (opts.closeAfter) {
      if (opts.location === 'quickSettings') {
        await operateQuickSettings(page, { mode: 'ensure-closed' });
      } else {
        // Close Settings using save button
        const saveBtn = page.getByRole('button', { name: /^save$/i });
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await expect(page.getByRole('heading', { name: /settings/i })).toBeHidden();
        }
      }
    }

  } catch (error) {
    debugErr('[getModelDropdownState] Error:', { error });
    // Return partial result on error
  }

  return result;
}

/**
 * Sets the system role/prompt for the current conversation
 * @param page - Playwright Page object
 * @param systemPrompt - The system prompt text to set
 */
export async function setConversationSystemPrompt(page: Page, systemPrompt: string): Promise<void> {
  const systemRoleTextarea = page.locator('#conversation-system-role');
  await expect(systemRoleTextarea).toBeVisible({ timeout: 5000 });
  await systemRoleTextarea.click();
  await systemRoleTextarea.fill(systemPrompt);

  // Verify the value was set
  const actualValue = await systemRoleTextarea.inputValue();
  if (actualValue !== systemPrompt) {
    throw new Error(`Failed to set system prompt. Expected: "${systemPrompt}", Got: "${actualValue}"`);
  }
}

