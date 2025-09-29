import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Responses API non-streaming', () => {
  test.setTimeout(45000);

  test('returns text via non-streaming Responses API', async ({ page }) => {
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
          try { if ((window as any).__DEBUG_E2E >= 2) console.log('[TEST] testResponsesAPI result:', result); } catch {}
          return result;
        } catch (e) {
          try { if ((window as any).__DEBUG_E2E >= 1) console.error('[TEST] testResponsesAPI error:', e); } catch {}
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
    debugInfo('[TEST] Non-streaming API test succeeded');
    debugInfo('[TEST] Output text:', { outputText: typeof result.outputText === 'string' ? result.outputText : result.outputText });
  });
});