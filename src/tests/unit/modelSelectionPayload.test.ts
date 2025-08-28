/**
 * Non-API UI test:
 * - Simulates selecting models via the bound store
 * - Triggers the normal send flow (routeMessage)
 * - Intercepts fetch to capture the OpenAI request payload without sending
 * - Verifies that the payload's `model` matches the selected model
 *
 * This test assumes the API model store has already been populated.
 * If models are not present in the cache, it fails with a special error.
 */

import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';
import { modelsStore } from '../../stores/modelStore.js';
import { selectedModel, chosenConversationId } from '../../stores/stores.js';
import { newChat, routeMessage } from '../../managers/conversationManager.js';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type Captured = {
  url: string;
  headers: Record<string, string>;
  payload: any;
} | null;

async function captureNextPayload(run: () => Promise<void> | void): Promise<Captured> {
  const originalFetch = window.fetch?.bind(window);
  let captured: Captured = null;

  function shouldCapture(input: RequestInfo | URL): boolean {
    try {
      const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
      return /\/v1\/(responses|chat\/completions)/.test(url);
    } catch {
      return true;
    }
  }

  (window as any).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (shouldCapture(input)) {
      try {
        let url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const body = init?.body && typeof init.body === 'string' ? init.body : '';
        const payload = body ? JSON.parse(body) : null;
        captured = { url, headers, payload };
      } catch {
        // Best-effort capture
      }
    }
    // Prevent any real network activity in this non-API test
    return Promise.reject(new Error('Intercepted fetch (non-API test): prevented network call'));
  }) as any;

  try {
    await Promise.resolve(run());
  } catch {
    // The call site may surface our interception error; ignore it for this test
  }

  // Allow any queued microtasks in the send flow to run and trigger fetch
  await sleep(0);

  // Restore fetch before returning
  (window as any).fetch = originalFetch;
  return captured;
}

registerTest({
  id: 'ui-model-selection-payload-capture',
  name: 'Model selection drives request payload.model',
  tags: ['ui', 'non-api'],
  timeoutMs: 15000,
  fn: async (assert) => {
    // Ensure models have been loaded previously
    const models = get(modelsStore);
    if (!models || models.length === 0) {
      throw new Error('Model cache is empty. Please load models first (e.g., via Settings -> Reload or run an API test) before running non-API tests.');
    }

    // Ensure there is an active conversation
    await Promise.resolve(newChat());
    await sleep(0);
    const convId = get(chosenConversationId);

    // Remember original selection to restore later
    const originalSelection = get(selectedModel);

    // Case 1: gpt-4.1
    selectedModel.set('gpt-4.1');
    const cap41 = await captureNextPayload(() => routeMessage('Test with gpt-4.1', convId));
    assert.that(!!cap41, 'Captured a request payload for gpt-4.1 selection');
    if (cap41 && cap41.payload) {
      const modelField = cap41.payload?.model;
      assert.that(
        typeof modelField === 'string',
        `Payload has a model field (found: ${String(modelField)})`
      );
      assert.that(
        modelField === 'gpt-4.1',
        `Selected model 'gpt-4.1' is used in payload.model (actual: ${String(modelField)})`
      );
    } else {
      assert.that(false, 'No payload captured for gpt-4.1 (the send flow may have changed)');
    }

    // Case 2: gpt-5
    selectedModel.set('gpt-5');
    const cap5 = await captureNextPayload(() => routeMessage('Test with gpt-5', convId));
    assert.that(!!cap5, 'Captured a request payload for gpt-5 selection');
    if (cap5 && cap5.payload) {
      const modelField = cap5.payload?.model;
      assert.that(
        typeof modelField === 'string',
        `Payload has a model field (found: ${String(modelField)})`
      );
      assert.that(
        modelField === 'gpt-5',
        `Selected model 'gpt-5' is used in payload.model (actual: ${String(modelField)})`
      );
    } else {
      assert.that(false, 'No payload captured for gpt-5 (the send flow may have changed)');
    }

    // Restore original selection
    selectedModel.set(originalSelection);
  },
});
