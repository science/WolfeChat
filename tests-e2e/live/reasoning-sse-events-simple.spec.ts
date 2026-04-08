import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, operateQuickSettings, sendMessage } from './helpers';
import { debugInfo, debugErr, debugWarn } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Simple SSE Event Capture for gpt-5-nano', () => {
  test.setTimeout(60_000);

  test('Capture exact SSE events for gpt-5-nano reasoning model', async ({ page }) => {
    debugInfo('[TEST] Starting simple SSE event capture for gpt-5-nano');

    // Capture ALL SSE events directly
    const sseEvents: string[] = [];
    let responseId: string | null = null;

    // Intercept the actual network response
    page.on('response', async (response) => {
      if (response.url().includes('api.openai.com/v1/responses') && response.status() === 200) {
        try {
          const responseText = await response.text();
          debugInfo('[TEST] Got SSE response, length:', { length: responseText.length });

          // Parse SSE blocks
          const blocks = responseText.split('\n\n').filter(b => b.trim());
          for (const block of blocks) {
            const lines = block.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.slice(5).trim();
              }
            }

            if (dataStr && dataStr !== '[DONE]') {
              try {
                const data = JSON.parse(dataStr);
                sseEvents.push(eventType);

                // Extract response ID if present
                if (data.response_id && !responseId) {
                  responseId = data.response_id;
                  debugInfo('[TEST] Response ID:', { responseId });
                }

                debugInfo(`[TEST] SSE Event: ${eventType}`);

                // Log first few chars of data for debugging
                if (eventType.includes('reasoning')) {
                  debugInfo(`[TEST]   Data preview:`, { preview: JSON.stringify(data).substring(0, 200) });
                }
              } catch (e) {
                debugErr('[TEST] Failed to parse SSE data:', { error: e });
              }
            }
          }
        } catch (e) {
          debugErr('[TEST] Failed to capture SSE response:', { error: e });
        }
      }
    });

    // Also capture client-side debug logs and extract event types
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('sse_event_resolved')) {
        // Try to extract the resolved event type from the debug log
        // Format: [DEBUG-SSEPARSER] sse_event_resolved {seq: X, convId: Y, respId: Z, data: {resolvedType: "EVENT_TYPE"}}
        const match = text.match(/resolvedType:\s*["']([^"']+)["']/);
        if (match) {
          const eventType = match[1];
          sseEvents.push(eventType);
          debugInfo(`[CAPTURED] SSE Event Type: ${eventType}`);
        } else {
          // Try to parse the JSON object
          const jsonMatch = text.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[0]);
              if (data.data?.resolvedType) {
                sseEvents.push(data.data.resolvedType);
                debugInfo(`[CAPTURED] SSE Event Type: ${data.data.resolvedType}`);
              }
            } catch {}
          }
        }
      }
    });

    await page.goto(APP_URL);

    // Enable debug logging
    await page.evaluate(() => {
      (window as any).__DEBUG = 2;
    });
    debugInfo('[TEST] Debug logging enabled');

    await bootstrapLiveAPI(page);

    // Use EXACT configuration from failing test case
    // This is conv3 configuration that shows the bug
    await operateQuickSettings(page, {
      mode: 'ensure-open',
      model: /gpt-5-nano/i,
      reasoningEffort: 'minimal',
      verbosity: 'low',
      summary: 'detailed',
      closeAfter: true
    });

    // Verify settings are correct
    await operateQuickSettings(page, { mode: 'ensure-open' });
    const model = await page.locator('#current-model-select').inputValue();
    const effort = await page.locator('#reasoning-effort').inputValue();
    const verbosity = await page.locator('#verbosity').inputValue();
    const summary = await page.locator('#summary').inputValue();

    debugInfo('[TEST] Settings confirmed:');
    debugInfo(`  Model: ${model}`);
    debugInfo(`  Reasoning Effort: ${effort}`);
    debugInfo(`  Verbosity: ${verbosity}`);
    debugInfo(`  Summary: ${summary}`);

    await operateQuickSettings(page, { mode: 'ensure-open', closeAfter: true });

    // Clear SSE events array
    sseEvents.length = 0;

    // Send EXACT message from failing test
    const message = 'Explain the Monte Hall 3 door problem';
    debugInfo(`[TEST] Sending message:`, { message });

    await sendMessage(page, message, {
      submitMethod: 'ctrl-enter',
      clearFirst: true,
      waitForEmpty: true
    });

    // Wait for response to complete
    await page.waitForTimeout(10_000); // Give it 10 seconds to receive events

    // Analyze captured events
    debugInfo('\n[TEST] === SSE EVENT ANALYSIS ===');
    debugInfo(`[TEST] Total SSE events captured: ${sseEvents.length}`);

    // Group events by type
    const eventCounts: { [key: string]: number } = {};
    sseEvents.forEach(event => {
      eventCounts[event] = (eventCounts[event] || 0) + 1;
    });

    debugInfo('[TEST] Event type counts:');
    Object.entries(eventCounts).forEach(([type, count]) => {
      debugInfo(`  ${type}: ${count}`);
    });

    // Check for reasoning events
    const reasoningEvents = sseEvents.filter(e => e.includes('reasoning'));
    debugInfo(`\n[TEST] Reasoning events: ${reasoningEvents.length}`);
    if (reasoningEvents.length > 0) {
      debugInfo('[TEST] Reasoning event types found:');
      const uniqueReasoningEvents = [...new Set(reasoningEvents)];
      uniqueReasoningEvents.forEach(e => debugInfo(`  - ${e}`));
    } else {
      debugErr('[TEST] ❌ NO reasoning events found!');
    }

    // Check for output text events
    const outputTextEvents = sseEvents.filter(e => e.includes('output_text'));
    debugInfo(`\n[TEST] Output text events: ${outputTextEvents.length}`);
    if (outputTextEvents.length > 0) {
      debugInfo('[TEST] Output text event types found:');
      const uniqueOutputEvents = [...new Set(outputTextEvents)];
      uniqueOutputEvents.forEach(e => debugInfo(`  - ${e}`));
    }

    // Check reasoning window in DOM
    await page.waitForTimeout(2000); // Give DOM time to update

    const reasoningWindow = page.locator('[role="region"][aria-label*="Reasoning"], details:has-text("Reasoning")');
    const isVisible = await reasoningWindow.isVisible().catch(() => false);

    if (isVisible) {
      const windowText = await reasoningWindow.innerText().catch(() => '');
      const messageMatch = windowText.match(/(\d+)\s+messages?/);
      const messageCount = messageMatch ? parseInt(messageMatch[1]) : -1;

      debugInfo('\n[TEST] === DOM STATE ===');
      debugInfo(`[TEST] Reasoning window visible: true`);
      debugInfo(`[TEST] Reasoning window shows: ${messageCount} messages`);

      if (messageCount === 0 && reasoningEvents.length === 0) {
        debugInfo('[TEST] ✅ CONFIRMED: No reasoning events from API, window correctly shows 0 messages');
      } else if (messageCount === 0 && reasoningEvents.length > 0) {
        debugErr('[TEST] 🐛 BUG: Reasoning events received but window shows 0 messages');
      } else if (messageCount > 0 && reasoningEvents.length > 0) {
        debugInfo('[TEST] ✅ Working correctly: Reasoning events received and displayed');
      }
    } else {
      debugInfo('\n[TEST] Reasoning window not visible');
    }

    // Final verdict
    debugInfo('\n[TEST] === FINAL VERDICT ===');
    if (reasoningEvents.length === 0) {
      debugInfo('[TEST] The API is NOT sending reasoning events for this configuration');
      debugInfo('[TEST] It appears to be sending output_text events instead');
    } else {
      debugInfo('[TEST] The API IS sending reasoning events');
      debugInfo('[TEST] The bug must be in the client-side handling');
    }
  });
});