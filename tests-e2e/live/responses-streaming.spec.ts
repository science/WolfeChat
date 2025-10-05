import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, selectReasoningModelInQuickSettings } from './helpers';
import { debugInfo, debugWarn } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Responses API streaming', () => {
  test.setTimeout(45000);

  test('streams tokens via streaming Responses API', async ({ page }) => {
    const DEBUG_LVL = Number(process.env.DEBUG || '0');
    
    // Set up console and network logging if debug level >= 2
    if (DEBUG_LVL >= 2) {
      page.on('console', msg => {
        const text = msg.text();
        if (/\[TEST\]|\[DIAG\]|\[SSE\]/.test(text) || msg.type() === 'error') {
          debugInfo(`[BROWSER-${msg.type()}] ${text}`);
        }
      });
      page.on('pageerror', err => debugWarn('[BROWSER-PAGEERROR]', { error: err.message }));
      page.on('request', req => { 
        if (req.url().includes('api.openai.com')) {
          debugInfo('[NET-REQ]', { method: req.method(), url: req.url() });
        }
      });
      page.on('response', res => { 
        if (res.url().includes('api.openai.com')) {
          debugInfo('[NET-RES]', { status: res.status(), url: res.url() });
        }
      });
    }

    await page.goto(APP_URL);
    
    // Propagate debug level into the page if needed
    if (DEBUG_LVL) {
      await page.evaluate(lvl => { 
        window.__DEBUG = lvl; 
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
        const debug = window.__DEBUG || 0;
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

    // Debug output only if DEBUG >= 2
    if (DEBUG_LVL >= 2) {
      debugInfo('[TEST] Streaming API test succeeded');
      debugInfo('[TEST] Events count:', { eventsCount: result.eventsCount });
      debugInfo('[TEST] Final text length:', { textLength: result.finalText?.length || 0 });
      if (DEBUG_LVL >= 3) {
        debugInfo('[TEST] Final text:', { finalText: result.finalText });
      }
    }
  });
});