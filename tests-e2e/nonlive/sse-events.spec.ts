// Moved to live suite at tests-e2e/live/sse-events-live.spec.ts
// This file intentionally left as a stub to avoid accidental execution of nonlive version.
import { test, expect } from '@playwright/test';

// This suite verifies the SSE testing utility by mocking the Responses API stream in the browser

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

function buildReasoningAndOutputSequence() {
  return `event: response.reasoning_summary_part.added\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_summary_part.added', delta: 'Sum ' })}\n\n` +
         `event: response.reasoning_summary_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_summary_text.delta', delta: 'mary' })}\n\n` +
         `event: response.reasoning_summary_text.done\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_summary_text.done', text: 'Summary' })}\n\n` +
         `event: response.reasoning_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_text.delta', delta: 'Cog ' })}\n\n` +
         `event: response.reasoning_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_text.delta', delta: 'work' })}\n\n` +
         `event: response.reasoning_text.done\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_text.done', text: 'Cog work' })}\n\n` +
         `event: response.output_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: { text: 'Hello' } })}\n\n` +
         `event: response.output_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: { text: ' world' } })}\n\n` +
         `event: response.completed\n` +
         `data: ${JSON.stringify({ type: 'response.completed' })}`;
}

// Helper to inject mocks and the TestSSEEvents into the page and run a single streaming call
async function runStreamWithMock(page: import('@playwright/test').Page, sseBlocks: string) {
  await page.addInitScript({ content: `
    (function(){
      const originalFetch = window.fetch.bind(window);
      const urlMatch = /\\/v1\\/responses$/;
      const enc = new TextEncoder();
      function streamFromBlocks(blocks) {
        return new ReadableStream({
          start(controller) {
            const parts = blocks.split('\\n\\n');
            let i = 0;
            function push() {
              if (i >= parts.length) { controller.close(); return; }
              const chunk = parts[i++];
              if (chunk.trim().length) controller.enqueue(enc.encode(chunk + '\\n\\n'));
              setTimeout(push, 5);
            }
            push();
          }
        });
      }
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        if ((init?.method || 'GET') === 'POST' && urlMatch.test(url)) {
          const stream = streamFromBlocks(${JSON.stringify(sseBlocks)});
          return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' }}));
        }
        return originalFetch(input, init);
      };
    })();
  `});

  await page.goto(APP_URL);

  // Expose helpers by injecting module code fetched from the app bundle path
  // We import the helper directly inside the page via ESM dynamic import
  await page.addScriptTag({ type: 'module', content: `
    import { bindToCallbacks } from '/src/tests/helpers/TestSSEEvents.ts';
    import { streamResponseViaResponsesAPI } from '/src/services/openaiService.ts';
    window.__runStream = async function() {
      const { callbacks, bus } = bindToCallbacks();
      const pAll = bus.waitForAllDone(5000);
      const pOut = bus.waitForOutputCompleted(5000);
      // Use prompt override; model inferred in service
      streamResponseViaResponsesAPI('hello world', undefined, callbacks).catch(console.error);
      return Promise.all([pOut, pAll]).then(([out]) => out);
    };
  `});

  const result = await page.evaluate(async () => {
    return await (window as any).__runStream();
  });
  return result as { finalText: string, raw?: any };
}

// Case 1: Reasoning + output + response.completed
test('SSE utility detects reasoning done and output completion (response.completed)', async ({ page }) => {
  const blocks = buildReasoningAndOutputSequence();
  const out = await runStreamWithMock(page, blocks);
  expect(out.finalText).toBe('Hello world');
});

// Case 2: Output only ending with [DONE]
function buildOutputDoneSequence() {
  return `event: response.output_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: { text: 'A' } })}\n\n` +
         `event: response.output_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: { text: 'B' } })}\n\n` +
         `data: [DONE]`;
}

test('SSE utility detects output completion with [DONE]', async ({ page }) => {
  const blocks = buildOutputDoneSequence();
  const out = await runStreamWithMock(page, blocks);
  expect(out.finalText).toBe('AB');
});

// Case 3: Reasoning.done without prior deltas
function buildReasoningDoneNoDelta() {
  return `event: response.reasoning_text.done\n` +
         `data: ${JSON.stringify({ type: 'response.reasoning_text.done', text: 'Direct' })}\n\n` +
         `event: response.completed\n` +
         `data: ${JSON.stringify({ type: 'response.completed' })}`;
}

test('SSE utility handles reasoning.done without deltas', async ({ page }) => {
  const blocks = buildReasoningDoneNoDelta();
  const out = await runStreamWithMock(page, blocks);
  expect(out.finalText).toBe('');
});

// Case 4: Error mid-stream
function buildErrorSequence() {
  return `event: response.output_text.delta\n` +
         `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: { text: 'Partial' } })}\n\n` +
         `event: error\n` +
         `data: ${JSON.stringify({ type: 'error', message: 'boom' })}`;
}

test('SSE utility exposes error events', async ({ page }) => {
  await page.addInitScript({ content: `
    (function(){
      const originalFetch = window.fetch.bind(window);
      const urlMatch = /\\/v1\\/responses$/;
      const enc = new TextEncoder();
      const blocks = ${JSON.stringify(buildErrorSequence())};
      function streamFromBlocks(blocks) {
        return new ReadableStream({
          start(controller) {
            const parts = blocks.split('\\n\\n');
            let i = 0;
            function push() {
              if (i >= parts.length) { controller.close(); return; }
              const chunk = parts[i++];
              if (chunk.trim().length) controller.enqueue(enc.encode(chunk + '\\n\\n'));
              setTimeout(push, 5);
            }
            push();
          }
        });
      }
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        if ((init?.method || 'GET') === 'POST' && urlMatch.test(url)) {
          const stream = streamFromBlocks(blocks);
          return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' }}));
        }
        return originalFetch(input, init);
      };
    })();
  `});

  await page.goto(APP_URL);

  await page.addScriptTag({ type: 'module', content: `
    import { bindToCallbacks } from '/src/tests/helpers/TestSSEEvents.ts';
    import { streamResponseViaResponsesAPI } from '/src/services/openaiService.ts';
    window.__runStreamError = async function() {
      const { callbacks, bus } = bindToCallbacks();
      const pErr = bus.waitForError(3000);
      streamResponseViaResponsesAPI('hello world', undefined, callbacks).catch(()=>{});
      return await pErr;
    };
  `});

  const err = await page.evaluate(async () => await (window as any).__runStreamError());
  expect(err).toBeTruthy();
});
