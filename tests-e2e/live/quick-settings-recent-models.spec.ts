import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage, waitForStreamComplete } from './helpers';

test.describe('Live: Quick Settings model dropdown recent models functionality', () => {
  test.setTimeout(120_000);

  test('initial state has no recent models, all models in main list', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') console.log(`[BROWSER-${msg.type()}] ${t}`);
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
    }

    await page.goto('/');
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    // Clear any existing recent models to start fresh
    await page.evaluate(() => {
      localStorage.removeItem('recent_models');
    });

    await bootstrapLiveAPI(page);

    // Open Quick Settings
    await operateQuickSettings(page, { mode: 'ensure-open' });

    const modelSelect = page.locator('#current-model-select');
    await expect(modelSelect).toBeVisible();

    // Verify no recent models optgroup exists initially (it shouldn't render if empty)
    const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
    const hasRecentSection = await recentOptgroup.isVisible().catch(() => false);
    expect(hasRecentSection).toBe(false);

    // Check if we have an "All models" optgroup or just direct options
    const allModelsOptgroup = modelSelect.locator('optgroup[label="All models"]');
    const hasAllModelsGroup = await allModelsOptgroup.isVisible().catch(() => false);
    
    let availableOptions;
    let optionCount;
    
    if (hasAllModelsGroup) {
      // Models are grouped under "All models"
      await expect(allModelsOptgroup).toBeVisible();
      availableOptions = allModelsOptgroup.locator('option');
    } else {
      // Models might be directly in the select (no optgroups when no recent models)
      availableOptions = modelSelect.locator('option');
    }
    
    optionCount = await availableOptions.count();
    expect(optionCount).toBeGreaterThan(0); // Should have some models

    if (DEBUG_LVL >= 2) {
      const optionTexts = [];
      for (let i = 0; i < Math.min(optionCount, 10); i++) {
        const text = await availableOptions.nth(i).textContent();
        optionTexts.push(text);
      }
      console.log('[TEST] Available models:', optionTexts);
    }

    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });

  test('sending message with selected model adds it to recent models section', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') console.log(`[BROWSER-${msg.type()}] ${t}`);
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
    }

    await page.goto('/');
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    // Clear any existing recent models to start fresh
    await page.evaluate(() => {
      localStorage.removeItem('recent_models');
    });

    await bootstrapLiveAPI(page);

    // Select gpt-3.5-turbo in Quick Settings for non-reasoning test
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-3\.5-turbo/i });

    // Get the currently selected model
    const modelSelect = page.locator('#current-model-select');
    const selectedModel = await modelSelect.inputValue();
    if (DEBUG_LVL >= 2) console.log('[TEST] Selected model for test:', selectedModel);

    await operateQuickSettings(page, { mode: 'ensure-closed' });

    // Send a message to trigger the model being added to recent models
    await sendMessage(page, 'Test message to add model to recent list', {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    // Wait for the response to complete
    await waitForStreamComplete(page, { timeout: 60_000 });

    // Debug: Check localStorage for recent models
    if (DEBUG_LVL >= 2) {
      const recentModelsLS = await page.evaluate(() => localStorage.getItem('recent_models'));
      console.log('[TEST] Recent models in localStorage:', recentModelsLS);
    }

    // Open Quick Settings again to verify recent models section
    await operateQuickSettings(page, { mode: 'ensure-open' });

    await expect(modelSelect).toBeVisible();

    // Debug: Check if recent models store is populated
    if (DEBUG_LVL >= 2) {
      const recentModelsState = await page.evaluate(() => {
        const win = window as any;
        // Access the recentModelsStore if available
        return win.__recentModelsStoreValue || 'not available';
      });
      console.log('[TEST] Recent models store state:', recentModelsState);
    }

    // Give the reactive stores time to update
    await page.waitForTimeout(1000);

    // Verify recent models optgroup now exists and contains the used model
    const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
    const recentExists = await recentOptgroup.isVisible().catch(() => false);
    
    if (DEBUG_LVL >= 2) {
      console.log('[TEST] Recent models optgroup visible:', recentExists);
      
      // Debug: Check all optgroups and their options
      const allOptgroups = modelSelect.locator('optgroup');
      const optgroupCount = await allOptgroups.count();
      console.log('[TEST] Total optgroups:', optgroupCount);
      
      for (let i = 0; i < optgroupCount; i++) {
        const optgroup = allOptgroups.nth(i);
        const label = await optgroup.getAttribute('label');
        const visible = await optgroup.isVisible();
        const options = optgroup.locator('option');
        const optionCount = await options.count();
        console.log(`[TEST] Optgroup ${i}: label="${label}", visible=${visible}, options=${optionCount}`);
        
        if (optionCount > 0) {
          for (let j = 0; j < Math.min(optionCount, 3); j++) {
            const optionText = await options.nth(j).textContent();
            console.log(`[TEST]   Option ${j}: "${optionText}"`);
          }
        }
      }
      
      // Also check direct select options
      const directOptions = modelSelect.locator('option');
      const directCount = await directOptions.count();
      console.log('[TEST] Direct options in select:', directCount);
    }

    // Since optgroups might not be "visible" in Playwright's sense but still functional,
    // let's verify the functionality by checking the options exist
    const recentOptions = recentOptgroup.locator('option');
    const recentCount = await recentOptions.count();
    expect(recentCount).toBeGreaterThanOrEqual(1);

    // Check if our selected model is in the recent section
    const recentTexts = [];
    for (let i = 0; i < recentCount; i++) {
      const text = await recentOptions.nth(i).textContent();
      recentTexts.push(text);
    }

    expect(recentTexts).toContain(selectedModel);

    if (DEBUG_LVL >= 2) {
      console.log('[TEST] Recent models after sending message:', recentTexts);
    }

    // Verify the model is no longer in the "All models" section (or appears in both if app allows duplicates)
    const allModelsOptgroup = modelSelect.locator('optgroup[label="All models"]');
    const allModelsOptions = allModelsOptgroup.locator('option');
    const allModelsCount = await allModelsOptions.count();
    
    const allModelsTexts = [];
    for (let i = 0; i < allModelsCount; i++) {
      const text = await allModelsOptions.nth(i).textContent();
      allModelsTexts.push(text);
    }

    // According to QuickSettings.svelte, models should NOT appear in both sections
    expect(allModelsTexts).not.toContain(selectedModel);

    if (DEBUG_LVL >= 2) {
      console.log('[TEST] Remaining models in "All models" section:', allModelsTexts.slice(0, 5));
      console.log('[TEST] ✅ Recent models functionality is working correctly!');
    }

    await operateQuickSettings(page, { mode: 'ensure-closed' });
  });

  test('switching models and sending messages builds recent models list', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0') || 0;
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const t = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(t) || msg.type() === 'error') console.log(`[BROWSER-${msg.type()}] ${t}`);
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
    }

    await page.goto('/');
    if (DEBUG_LVL) await page.evaluate(lvl => { (window as any).__DEBUG_E2E = lvl; }, DEBUG_LVL);

    // Clear any existing recent models to start fresh
    await page.evaluate(() => {
      localStorage.removeItem('recent_models');
    });

    await bootstrapLiveAPI(page);

    const modelSelect = page.locator('#current-model-select');
    const usedModels: string[] = [];

    // Helper to send message with current model and track it
    const sendWithCurrentModel = async (messageText: string) => {
      await operateQuickSettings(page, { mode: 'ensure-open' });
      const currentModel = await modelSelect.inputValue();
      await operateQuickSettings(page, { mode: 'ensure-closed' });
      
      await sendMessage(page, messageText, {
        submitMethod: 'ctrl-enter',
        clearFirst: true,
        waitForEmpty: true
      });
      
      await waitForStreamComplete(page, { timeout: 60_000 });
      
      if (!usedModels.includes(currentModel)) {
        usedModels.push(currentModel);
      }
      
      if (DEBUG_LVL >= 2) console.log('[TEST] Used model:', currentModel);
      return currentModel;
    };

    // Select gpt-3.5-turbo first and send message
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-3\.5-turbo/i });
    await operateQuickSettings(page, { mode: 'ensure-closed' });
    
    // First message with gpt-3.5-turbo
    const firstModel = await sendWithCurrentModel('First test message with gpt-3.5-turbo');

    // Switch to gpt-5-nano for reasoning test
    await operateQuickSettings(page, { mode: 'ensure-open', model: /gpt-5-nano/i });
    
    // Check if gpt-5-nano is available and different from first model
    const currentModel = await modelSelect.inputValue();
    const foundDifferentModel = currentModel !== firstModel && /gpt-5-nano/i.test(currentModel);
    
    if (DEBUG_LVL >= 2) {
      console.log('[TEST] Switched to model:', currentModel);
      console.log('[TEST] Is different from first model:', foundDifferentModel);
    }
    
    await operateQuickSettings(page, { mode: 'ensure-closed' });

    if (foundDifferentModel) {
      // Send message with gpt-5-nano
      const secondModel = await sendWithCurrentModel('Second test message with gpt-5-nano');
      
      // Verify we have both models in recent list (gpt-3.5-turbo and gpt-5-nano)
      await operateQuickSettings(page, { mode: 'ensure-open' });
      
      const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
      
      const recentOptions = recentOptgroup.locator('option');
      const recentCount = await recentOptions.count();
      expect(recentCount).toBeGreaterThanOrEqual(1);
      
      const recentTexts = [];
      for (let i = 0; i < recentCount; i++) {
        const text = await recentOptions.nth(i).textContent();
        recentTexts.push(text);
      }
      
      // Most recently used model (gpt-5-nano) should be first
      expect(recentTexts[0]).toBe(secondModel);
      
      if (recentCount >= 2) {
        expect(recentTexts).toContain(firstModel);
        expect(recentTexts[1]).toBe(firstModel);
      }
      
      if (DEBUG_LVL >= 2) {
        console.log('[TEST] Final recent models list:', recentTexts);
        console.log('[TEST] Expected order: [gpt-5-nano, gpt-3.5-turbo]');
      }
      
      await operateQuickSettings(page, { mode: 'ensure-closed' });
    } else {
      console.log('[TEST] gpt-5-nano not available or same as first model, skipping two-model test');
      
      // Still verify the first model appears in recent list
      await operateQuickSettings(page, { mode: 'ensure-open' });
      
      const recentOptgroup = modelSelect.locator('optgroup[label="Recently used"]');
      
      const recentOptions = recentOptgroup.locator('option');
      const recentCount = await recentOptions.count();
      expect(recentCount).toBeGreaterThanOrEqual(1);
      
      const recentTexts = [];
      for (let i = 0; i < recentCount; i++) {
        const text = await recentOptions.nth(i).textContent();
        recentTexts.push(text);
      }
      
      expect(recentTexts).toContain(firstModel);
      
      await operateQuickSettings(page, { mode: 'ensure-closed' });
    }
  });
});