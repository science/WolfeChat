import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Responses API non-streaming', () => {
  test.setTimeout(45000);

  test('returns text via non-streaming Responses API', async ({ page }) => {
    const hasKey = !!process.env.OPENAI_API_KEY;
    test.skip(!hasKey, 'OPENAI_API_KEY env not set for live tests');

    await page.goto(APP_URL);
    
    // Bootstrap API key and wait for models to load
    await bootstrapLiveAPI(page);
    
    // Select a reasoning model
    await selectReasoningModelInQuickSettings(page);

    // Inject and run the test using the actual testResponsesAPI function
    await page.addScriptTag({ type: 'module', content: `
      import { testResponsesAPI } from '/src/utils/debugUtils.ts';
      
      window.__testResponsesAPI = async function() {
        try {
          const result = await testResponsesAPI();
          console.log('[TEST] testResponsesAPI result:', result);
          return result;
        } catch (e) {
          console.error('[TEST] testResponsesAPI error:', e);
          return { success: false, error: String(e) };
        }
      };
    `});
    
    // Wait for function to be available
    await page.waitForFunction(() => typeof (window as any).__testResponsesAPI === 'function');
    
    // Execute the test
    const result = await page.evaluate(async () => {
      return await (window as any).__testResponsesAPI();
    });
    
    // Assert results
    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(result.outputText).toBeTruthy();
    expect(result.outputText.trim()).not.toBe('');

    // Optional debug output gated by DEBUG_E2E>=2
    const debugLevel = Number(process.env.DEBUG_E2E || '0');
    if (debugLevel >= 2) {
      console.log('[TEST] Non-streaming API test succeeded');
      console.log('[TEST] Output text:', typeof result.outputText === 'string' ? result.outputText : JSON.stringify(result.outputText));
    }
  });
});