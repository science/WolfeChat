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

    // Execute the test directly using the API call
    const result = await page.evaluate(async () => {
      try {
        // Inline the testResponsesAPI logic directly
        const win = window as any;
        const apiKey = win.get(win.stores.openaiApiKey);
        const selectedModel = win.get(win.stores.selectedModel);

        if (!apiKey) {
          console.error('No API key configured');
          return { success: false, error: 'No API key configured' };
        }

        const prompt = "Say 'double bubble bath' five times fast.";
        const model = selectedModel;

        // Call createResponseViaResponsesAPI directly
        const data = await win.createResponseViaResponsesAPI(prompt, model);
        const outputText =
          data?.output_text ??
          data?.output?.[0]?.content?.map((c: any) => c?.text).join('') ??
          data?.response?.output_text ??
          JSON.stringify(data);

        console.log('Responses API result:', data);
        console.log('Responses API output_text:', outputText);
        return { success: true, raw: data, outputText, model };
      } catch (e) {
        console.error('Responses API error:', e);
        return { success: false, error: e };
      }
    });
    
    // Debug the result first
    debugInfo('[TEST] Response result:', result);

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