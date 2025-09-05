import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Responses API streaming', () => {
  test.setTimeout(45000);

  test('streams tokens via streaming Responses API', async ({ page }) => {
    const hasKey = !!process.env.OPENAI_API_KEY;
    test.skip(!hasKey, 'OPENAI_API_KEY env not set for live tests');

    const DEBUG_LVL = Number(process.env.DEBUG_E2E || '0');
    
    // Set up console and network logging if debug level >= 2
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const text = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(text) || msg.type() === 'error') {
          console.log(`[BROWSER-${msg.type()}] ${text}`);
        }
      });
      page.on('pageerror', err => console.log('[BROWSER-PAGEERROR]', err.message));
      page.on('request', req => { 
        if (req.url().includes('api.openai.com')) {
          console.log('[NET-REQ]', req.method(), req.url());
        }
      });
      page.on('response', res => { 
        if (res.url().includes('api.openai.com')) {
          console.log('[NET-RES]', res.status(), res.url());
        }
      });
    }

    await page.goto(APP_URL);
    
    // Propagate debug level into the page if needed
    if (DEBUG_LVL) {
      await page.evaluate(lvl => { 
        window.__DEBUG_E2E = lvl; 
      }, DEBUG_LVL);
    }
    
    // Bootstrap API key and wait for models to load
    await bootstrapLiveAPI(page);
    
    // Select a reasoning model
    await selectReasoningModelInQuickSettings(page);

    // Inject and run the test using the actual testResponsesStreamingAPI function
    await page.addScriptTag({ type: 'module', content: `
      import { testResponsesStreamingAPI } from '/src/utils/debugUtils.ts';
      
      window.__testResponsesStreamingAPI = async function() {
        const debug = window.__DEBUG_E2E || 0;
        try {
          if (debug >= 2) console.log('[TEST] Starting streaming API test');
          const result = await testResponsesStreamingAPI();
          if (debug >= 2) console.log('[TEST] testResponsesStreamingAPI result:', result);
          return result;
        } catch (e) {
          if (debug >= 2) console.error('[TEST] testResponsesStreamingAPI error:', e);
          return { success: false, error: String(e) };
        }
      };
    `});
    
    // Wait for function to be available
    await page.waitForFunction(() => typeof (window as any).__testResponsesStreamingAPI === 'function');
    
    // Execute the test
    const result = await page.evaluate(async () => {
      return await (window as any).__testResponsesStreamingAPI();
    });
    
    // Assert results
    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(result.eventsCount).toBeGreaterThan(0);
    expect(result.finalText).toBeTruthy();
    expect(result.finalText.trim()).not.toBe('');

    // Debug output only if DEBUG_E2E >= 2
    if (DEBUG_LVL >= 2) {
      console.log('[TEST] Streaming API test succeeded');
      console.log('[TEST] Events count:', result.eventsCount);
      console.log('[TEST] Final text length:', result.finalText?.length || 0);
      if (DEBUG_LVL >= 3) {
        console.log('[TEST] Final text:', result.finalText);
      }
    }
  });
});