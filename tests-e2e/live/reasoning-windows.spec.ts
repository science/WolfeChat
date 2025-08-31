import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';

async function sendPrompt(page: import('@playwright/test').Page, text: string) {
  const textarea = page.getByRole('textbox', { name: /chat input/i });
  await expect(textarea).toBeVisible();
  await textarea.fill(text);
  const sendBtn = page.getByRole('button', { name: /send/i });
  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click();
  } else {
    await textarea.press('Enter');
  }
}

function reasoningRegion(page: import('@playwright/test').Page) {
  const byRole = page.getByRole('region', { name: /reasoning/i });
  const byAria = page.locator('details[role="region"][aria-label="Reasoning"]');
  const bySummaryParent = page.locator('summary', { hasText: 'Reasoning' }).locator('..');
  const byText = page.locator('details:has-text("Reasoning")');
  let combined = byRole.or(byAria);
  combined = combined.or(bySummaryParent);
  combined = combined.or(byText);
  return combined;
}

function panelsIn(details: import('@playwright/test').Locator) {
  const semanticPanels = details.locator('[role="article"][aria-label="Reasoning panel"]');
  const classPanels = details.locator('div.rounded.border.border-gray-500');
  return semanticPanels.or(classPanels);
}

function panelPre(panel: import('@playwright/test').Locator) {
  return panel.locator('pre');
}

function panelStatus(panel: import('@playwright/test').Locator) {
  return panel.locator('.text-xs');
}

// Fully live smoke: user selects reasoning model and sends a prompt; window appears and streams to done.
 test('Reasoning (live): window renders and panel reaches done', async ({ page }) => {
   test.setTimeout(120000);
   await page.goto('/');
 
   // Ensure API key and models are available
   await bootstrapLiveAPI(page);
 
   // Select a reasoning-capable model like gpt-5-nano
   await selectReasoningModelInQuickSettings(page);
 
   // Send a short prompt
   await sendPrompt(page, 'Explain the Monty Hall problem briefly.');
 
   // Reasoning region should appear (give generous live timeouts)
   const details = reasoningRegion(page);
   await expect(details).toBeVisible({ timeout: 30000 });
 
   // At least one panel should appear
   const panels = panelsIn(details);
   const firstPanel = panels.first();
   await expect(firstPanel).toBeVisible({ timeout: 30000 });
 
   // Status should progress to done eventually
   const status = panelStatus(firstPanel);
   await expect(status).toContainText(/in progress|done/i, { timeout: 30000 });
   await expect(status).toContainText(/done/i, { timeout: 60000 });
 
   // Optional: text present
   const pre = panelPre(firstPanel);
   await expect(pre).toBeVisible({ timeout: 30000 });
 });
 
 // Live: auto-minimize after assistant content appears
 test('Reasoning (live): auto-minimizes after assistant starts replying', async ({ page }) => {
   test.setTimeout(120000);
   await page.goto('/');
   await bootstrapLiveAPI(page);
   await selectReasoningModelInQuickSettings(page);
 
   await sendPrompt(page, 'List three creative uses for a paperclip and think step-by-step.');
 
   const details = reasoningRegion(page);
   await expect(details).toBeVisible({ timeout: 30000 });
 
  // Wait for assistant message to begin streaming (robust selectors)
  // Try multiple patterns to detect assistant content starting
  const assistantCandidates = [
    page.getByRole('article', { name: /assistant|assistant message/i }).first(),
    page.locator('[data-role="assistant"], [data-message-role="assistant"], .assistant').first(),
    page.locator('main, [role="main"]').locator(':text-is("Assistant")').first(),
    page.locator('[aria-live="polite"], [aria-live="assertive"], [data-stream="assistant"]').first(),
    page.locator('div, article, section').filter({ hasText: /assistant/i }).first(),
  ];
  let assistantFound = false;
  const deadlineAssistant = Date.now() + 60000;
  while (Date.now() < deadlineAssistant && !assistantFound) {
    for (const cand of assistantCandidates) {
      if (await cand.isVisible().catch(() => false)) {
        assistantFound = true;
        break;
      }
    }
    if (!assistantFound) await page.waitForTimeout(200);
  }
  expect(assistantFound).toBeTruthy();

 
   // After assistant begins, the Reasoning details should be collapsed (no [open]) or summary aria-expanded=false
   const summary = details.locator('summary');
   const collapsed = async () => {
     const hasOpen = await details.getAttribute('open');
     const ariaExpanded = await summary.getAttribute('aria-expanded');
     return (!hasOpen || hasOpen === null) || ariaExpanded === 'false';
   };
 
   const deadline = Date.now() + 30000;
   while (Date.now() < deadline) {
     if (await collapsed()) break;
     await page.waitForTimeout(200);
   }
   expect(await collapsed()).toBeTruthy();
 });
 
 // Live: longer prompt, ensure panel text becomes non-empty and reaches done
 test('Reasoning (live): longer prompt streams content and reaches done', async ({ page }) => {
   test.setTimeout(150000);
   await page.goto('/');
   await bootstrapLiveAPI(page);
   await selectReasoningModelInQuickSettings(page);
 
   await sendPrompt(page, 'Plan a simple 3-day itinerary for visiting Kyoto with constraints: low budget, avoid crowds, include cultural experiences. Think step-by-step.');
 
   const details = reasoningRegion(page);
   await expect(details).toBeVisible({ timeout: 40000 });
   const panels = panelsIn(details);
   const firstPanel = panels.first();
   await expect(firstPanel).toBeVisible({ timeout: 40000 });
 
   const pre = panelPre(firstPanel);
  await expect(pre).toBeVisible({ timeout: 40000 });
  // Ensure some non-empty text appears in the panel
  await expect(pre).toHaveText(/\S+/, { timeout: 60000 });

 
   const status = panelStatus(firstPanel);
   await expect(status).toContainText(/done/i, { timeout: 75000 });
 });
 
 // Live: send two messages; window reopens, completes, and auto-minimizes for each
 test('Reasoning (live): consecutive messages reopen and minimize correctly', async ({ page }) => {
   test.setTimeout(180000);
   await page.goto('/');
   await bootstrapLiveAPI(page);
   await selectReasoningModelInQuickSettings(page);
 
   const ensureDoneAndMinimized = async () => {
     const details = reasoningRegion(page);
     await expect(details).toBeVisible({ timeout: 30000 });
     const panels = panelsIn(details);
     const firstPanel = panels.first();
     await expect(firstPanel).toBeVisible({ timeout: 30000 });
     const status = panelStatus(firstPanel);
     await expect(status).toContainText(/done/i, { timeout: 75000 });
 
     const summary = details.locator('summary');
     const deadline = Date.now() + 30000;
     while (Date.now() < deadline) {
       const hasOpen = await details.getAttribute('open');
       const ariaExpanded = await summary.getAttribute('aria-expanded');
       if ((!hasOpen || hasOpen === null) || ariaExpanded === 'false') break;
       await page.waitForTimeout(200);
     }
     const hasOpen = await details.getAttribute('open');
     const ariaExpanded = await summary.getAttribute('aria-expanded');
     expect((!hasOpen || hasOpen === null) || ariaExpanded === 'false').toBeTruthy();
   };
 
   await sendPrompt(page, 'Briefly explain dynamic programming to a beginner.');
   await ensureDoneAndMinimized();
 
   await sendPrompt(page, 'Now give a short Python example that uses dynamic programming for Fibonacci.');
   await ensureDoneAndMinimized();
 });

