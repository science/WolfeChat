import { test, expect } from '@playwright/test';
import { bootstrapLiveAPI, sendMessage, waitForAssistantDone } from './helpers';
import { debugInfo, debugErr } from '../debug-utils';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Live API: Title Generation Async Timing', () => {
  test.setTimeout(60000);

  test('title generation should not block main message response', async ({ page }) => {
    await page.goto(APP_URL);

    await bootstrapLiveAPI(page);

    const newChatBtn = page.getByRole('button', { name: /new chat|new conversation|add conversation/i }).first();
    if (await newChatBtn.isVisible().catch(() => false)) {
      await newChatBtn.click();
      await page.waitForTimeout(500);
    }

    const requests: Array<{ type: 'title' | 'message', timestamp: number, url: string }> = [];
    const responses: Array<{ type: 'title' | 'message', timestamp: number, duration: number }> = [];
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[TIMING-')) {
        consoleLogs.push(text);
        debugInfo('[BROWSER CONSOLE]', text);
      }
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/v1/responses') || url.includes('/v1/chat/completions')) {
        const postData = request.postData();
        if (postData) {
          try {
            const body = JSON.parse(postData);
            if (body.input) {
              const hasSystemRole = body.input.some((m: any) => {
                if (m.role === 'system' && m.content) {
                  if (Array.isArray(m.content)) {
                    return m.content.some((c: any) =>
                      c.type === 'input_text' &&
                      c.text &&
                      c.text.includes('generate a short, clear chat title')
                    );
                  } else if (typeof m.content === 'string') {
                    return m.content.includes('generate a short, clear chat title');
                  }
                }
                return false;
              });
              if (hasSystemRole) {
                debugInfo('[TIMING] Title request sent at:', Date.now());
                requests.push({ type: 'title', timestamp: Date.now(), url });
              } else {
                debugInfo('[TIMING] Message request sent at:', Date.now());
                requests.push({ type: 'message', timestamp: Date.now(), url });
              }
            }
          } catch (e) {
          }
        }
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/responses') || url.includes('/v1/chat/completions')) {
        const request = response.request();
        const postData = request.postData();
        if (postData) {
          try {
            const body = JSON.parse(postData);
            if (body.input) {
              const hasSystemRole = body.input.some((m: any) => {
                if (m.role === 'system' && m.content) {
                  if (Array.isArray(m.content)) {
                    return m.content.some((c: any) =>
                      c.type === 'input_text' &&
                      c.text &&
                      c.text.includes('generate a short, clear chat title')
                    );
                  } else if (typeof m.content === 'string') {
                    return m.content.includes('generate a short, clear chat title');
                  }
                }
                return false;
              });
              const matchingRequest = requests.find(r => r.type === (hasSystemRole ? 'title' : 'message') && r.url === url);
              if (matchingRequest) {
                const duration = Date.now() - matchingRequest.timestamp;
                debugInfo(`[TIMING] ${hasSystemRole ? 'Title' : 'Message'} response completed at:`, Date.now(), `(duration: ${duration}ms)`);
                responses.push({
                  type: hasSystemRole ? 'title' : 'message',
                  timestamp: Date.now(),
                  duration
                });
              }
            }
          } catch (e) {
          }
        }
      }
    });

    const testMessage = 'Tell me a brief fact about the ocean.';

    await sendMessage(page, testMessage, { submitMethod: 'ctrl-enter' });

    await waitForAssistantDone(page, { timeout: 45000 });

    await page.waitForTimeout(3000);

    debugInfo('[TIMING] All requests:', requests);
    debugInfo('[TIMING] All responses:', responses);

    const titleRequest = requests.find(r => r.type === 'title');
    const messageRequest = requests.find(r => r.type === 'message');
    const titleResponse = responses.find(r => r.type === 'title');
    const messageResponse = responses.find(r => r.type === 'message');

    if (!titleRequest || !messageRequest) {
      throw new Error(`Missing request data: title=${!!titleRequest}, message=${!!messageRequest}`);
    }

    if (!titleResponse || !messageResponse) {
      throw new Error(`Missing response data: title=${!!titleResponse}, message=${!!messageResponse}`);
    }

    const titleRequestTime = titleRequest.timestamp;
    const messageRequestTime = messageRequest.timestamp;
    const titleCompleteTime = titleResponse.timestamp;
    const messageCompleteTime = messageResponse.timestamp;

    debugInfo('[TIMING] Title request sent at:', titleRequestTime);
    debugInfo('[TIMING] Message request sent at:', messageRequestTime);
    debugInfo('[TIMING] Title response completed at:', titleCompleteTime);
    debugInfo('[TIMING] Message response completed at:', messageCompleteTime);

    const titleSentBeforeMessage = titleRequestTime < messageRequestTime;
    const titleCompletedBeforeMessage = titleCompleteTime < messageCompleteTime;
    const requestTimeDiff = Math.abs(titleRequestTime - messageRequestTime);
    const responseTimeDiff = Math.abs(titleCompleteTime - messageCompleteTime);

    debugInfo('[TIMING] Title request sent before message?', titleSentBeforeMessage);
    debugInfo('[TIMING] Request time difference (ms):', requestTimeDiff);
    debugInfo('[TIMING] Title completed before message?', titleCompletedBeforeMessage);
    debugInfo('[TIMING] Response time difference (ms):', responseTimeDiff);

    if (!titleSentBeforeMessage) {
      debugErr('[TIMING] ISSUE CONFIRMED: Title request sent AFTER message request!');
      debugErr('[TIMING] Title request came after message by:', requestTimeDiff, 'ms');
      debugErr('[TIMING] This means title generation is NOT async with the main message');

      if (requestTimeDiff < 100) {
        debugInfo('[TIMING] However, time difference is small (<100ms), so async behavior is partially working');
      }
    } else {
      debugInfo('[TIMING] SUCCESS: Title request properly async - sent before/with message request');
      debugInfo('[TIMING] Title sent before message by:', requestTimeDiff, 'ms');
    }

    expect(titleSentBeforeMessage).toBe(true);
  });
});