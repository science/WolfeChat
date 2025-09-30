import { registerTest } from '../testHarness.js';
import { conversations, selectedModel } from '../../stores/stores.js';
import { get } from 'svelte/store';
import { sendRegularMessage, sendVisionMessage, sendDalleMessage } from '../../services/openaiService.js';
import { displayAudioMessage } from '../../managers/conversationManager.js';

// Helper to reset conversation store
function resetConversations() {
  conversations.set([
    {
      id: 'conv-test',
      history: [],
      conversationTokens: 0,
      assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
      title: ''
    }
  ]);
}

// Stub streaming by monkey-patching streamResponseViaResponsesAPI to synchronously call callbacks
import * as svc from '../../services/openaiService.js';

async function withMockedStreamResponse(fn: () => Promise<void>) {
  // Use a wrapper that leverages the real function signature by temporarily stubbing fetch to deliver SSE-like chunks is complex.
  // Instead, call the service entrypoints but bypass network by swapping the internal function via object property define (configurable).
  // We cannot reassign the exported function due to ESM readonly bindings.
  // Instead, we intercept fetch used inside streamResponseViaResponsesAPI to simulate SSE events minimally.
  const realFetch = globalThis.fetch;
  // Simulate a ReadableStream that yields two SSE blocks then DONE
  function makeStream() {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('event: response.output_text.delta\n'),
      encoder.encode('data: {"delta": {"text": "Hello "}}\n\n'),
      encoder.encode('event: response.output_text.delta\n'),
      encoder.encode('data: {"delta": {"text": "World"}}\n\n'),
      encoder.encode('data: [DONE]\n\n')
    ];
    let i = 0;
    return new ReadableStream({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(chunks[i++]);
        } else {
          controller.close();
        }
      }
    });
  }
  // @ts-ignore
  globalThis.fetch = async () => ({ ok: true, body: makeStream() });
  try { await fn(); } finally { globalThis.fetch = realFetch; }

}

// Vision path also uses streamResponseViaResponsesAPI; same mock works.

// DALL·E path hits network; we will mock fetch
const realFetch = globalThis.fetch;

function mockFetchOnce(json: any) {
  // @ts-ignore
  globalThis.fetch = async (_url: string, _opts?: any) => ({ ok: true, json: async () => json });
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

function setModel(id: string) {
  selectedModel.set(id);
}

function getLastAssistant() {
  const conv = get(conversations)[0];
  const hist = conv.history;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].role === 'assistant') return hist[i] as any;
  }
  return null;
}

// Tests

registerTest({
  id: 'unit-regular-model-label',
  name: 'sendRegularMessage attaches model to assistant messages (delta and final)',
  fn: async (t) => {
  resetConversations();
  setModel('gpt-3.5-turbo');

  await withMockedStreamResponse(async () => {
    await sendRegularMessage([{ role: 'user', content: 'Hi' }], 'conv-test', { model: get(selectedModel) });
  });

  const conv = get(conversations)[0];
  t.that(conv.history.length >= 1, 'history has assistant messages');
  const last = getLastAssistant();
  t.that(last?.model === 'gpt-3.5-turbo', 'assistant message stores selected model');
}}
);

registerTest({
  id: 'unit-vision-model-label',
  name: 'sendVisionMessage attaches model to assistant messages',
  fn: async (t) => {
  resetConversations();
  setModel('gpt-3.5-turbo');

  await withMockedStreamResponse(async () => {
    await sendVisionMessage([{ role: 'user', content: 'See this' }], ['data:image/png;base64,AAA'], 0, { model: get(selectedModel) });
  });

  const last = getLastAssistant();
  t.that(last?.model === 'gpt-3.5-turbo', 'vision assistant message stores selected model');
}}
);

registerTest({
  id: 'unit-dalle-model-label',
  name: 'sendDalleMessage attaches model to image assistant message',
  fn: async (t) => {
  resetConversations();
  setModel('gpt-image-1');

  mockFetchOnce({ data: [{ url: 'https://example.com/img.png' }] });
  try {
    await sendDalleMessage([{ role: 'user', content: 'make an image' }], 0);
  } finally {
    restoreFetch();
  }

  const last = getLastAssistant();
  t.that(last?.type === 'image', 'image message type set');
  t.that(last?.model === 'gpt-image-1', 'image message stores selected model');
}}
);

// Audio message test

registerTest({
  id: 'unit-audio-model-label',
  name: 'displayAudioMessage attaches model to audio assistant message',
  fn: async (t) => {
  resetConversations();
  setModel('gpt-3.5-turbo');

  displayAudioMessage('blob:https://audio');

  const last = getLastAssistant();
  t.that(last?.isAudio === true, 'audio message marked as audio');
  t.that(last?.model === 'gpt-3.5-turbo', 'audio message stores selected model');
}
});
