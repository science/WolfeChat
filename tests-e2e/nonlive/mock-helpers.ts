/**
 * Shared mock helpers for nonlive E2E tests.
 *
 * These replace `bootstrapLiveAPI()` by seeding localStorage directly,
 * avoiding the need for real API keys or network calls.
 */

import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ==================== MODEL LISTS ====================

// Models must include `provider` field — this is how the app distinguishes
// OpenAI vs Anthropic models in QuickSettings and Settings dropdowns.
// The app adds this field when processing API responses (Settings.svelte:292).

export const OPENAI_MODELS = [
  { id: 'gpt-4.1-nano', object: 'model', created: 1677610602, owned_by: 'openai', provider: 'openai' },
  { id: 'gpt-4.1', object: 'model', created: 1677610602, owned_by: 'openai', provider: 'openai' },
  { id: 'gpt-4o', object: 'model', created: 1677610602, owned_by: 'openai', provider: 'openai' },
  { id: 'gpt-5-nano', object: 'model', created: 1698894618, owned_by: 'openai', provider: 'openai' },
  { id: 'gpt-5.4-nano', object: 'model', created: 1698894618, owned_by: 'openai', provider: 'openai' },
  { id: 'gpt-5.1', object: 'model', created: 1698894618, owned_by: 'openai', provider: 'openai' },
  { id: 'dall-e-3', object: 'model', created: 1698785189, owned_by: 'openai', provider: 'openai' },
];

export const ANTHROPIC_MODELS = [
  { id: 'claude-3-haiku-20240307', object: 'model', created: 1698894618, owned_by: 'anthropic', provider: 'anthropic' },
  { id: 'claude-sonnet-4-5-20250929', object: 'model', created: 1698894618, owned_by: 'anthropic', provider: 'anthropic' },
  { id: 'claude-opus-4-5-20250918', object: 'model', created: 1698894618, owned_by: 'anthropic', provider: 'anthropic' },
];

// ==================== APP STATE SEEDING ====================

export interface SeedAppStateOptions {
  /** Provider to configure. Default: 'OpenAI' */
  provider?: 'OpenAI' | 'Anthropic' | 'both';
  /** Model to select initially. Default: 'gpt-4.1-nano' */
  selectedModel?: string;
  /** Extra models to add beyond defaults */
  extraModels?: Array<{ id: string; object?: string; created?: number; owned_by?: string }>;
  /** Skip model seeding (for tests that test model loading itself) */
  skipModels?: boolean;
}

/**
 * Seeds localStorage with app state, replacing bootstrapLiveAPI().
 *
 * Must be called BEFORE page.goto('/') since it uses addInitScript.
 * Usage:
 *   await seedAppState(page);
 *   await page.goto('/');
 */
export async function seedAppState(page: Page, options: SeedAppStateOptions = {}) {
  const {
    provider = 'OpenAI',
    selectedModel = 'gpt-4.1-nano',
    extraModels = [],
    skipModels = false,
  } = options;

  let models: typeof OPENAI_MODELS = [];
  if (!skipModels) {
    if (provider === 'OpenAI' || provider === 'both') {
      models = [...models, ...OPENAI_MODELS];
    }
    if (provider === 'Anthropic' || provider === 'both') {
      models = [...models, ...ANTHROPIC_MODELS];
    }
    models = [...models, ...extraModels.map(m => ({
      id: m.id,
      object: m.object || 'model',
      created: m.created || 1698894618,
      owned_by: m.owned_by || 'openai',
    }))];
  }

  const activeProvider = provider === 'both' ? 'OpenAI' : provider;

  await page.addInitScript(({ models, selectedModel, activeProvider, provider }) => {
    // OpenAI API key (always set a fake one so the app doesn't show "no key" state)
    if (activeProvider === 'OpenAI' || provider === 'both') {
      localStorage.setItem('api_key', JSON.stringify('sk-test-mock-key-00000000'));
      localStorage.setItem('openai_api_key', JSON.stringify('sk-test-mock-key-00000000'));
    }
    if (activeProvider === 'Anthropic' || provider === 'both') {
      localStorage.setItem('anthropic_api_key', JSON.stringify('sk-ant-test-mock-key-00000000'));
    }
    if (provider === 'both') {
      localStorage.setItem('api_key', JSON.stringify('sk-test-mock-key-00000000'));
      localStorage.setItem('anthropic_api_key', JSON.stringify('sk-ant-test-mock-key-00000000'));
    }

    localStorage.setItem('selectedProvider', activeProvider);
    localStorage.setItem('models', JSON.stringify(models));
    localStorage.setItem('selectedModel', selectedModel);
  }, { models, selectedModel, activeProvider, provider });
}

// ==================== SSE BUILDERS ====================

/**
 * Build an SSE body from text chunks (response.output_text.delta events).
 */
export function buildSSE(chunks: string[]): string {
  const lines: string[] = [];
  for (const chunk of chunks) {
    lines.push('event: response.output_text.delta');
    lines.push('data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: { text: chunk } }));
    lines.push('');
  }
  lines.push('event: response.completed');
  lines.push('data: {"type":"response.completed"}');
  lines.push('');
  lines.push('data: [DONE]');
  lines.push('');
  return lines.join('\n');
}

/**
 * Build an SSE body with reasoning events followed by text.
 */
export function buildReasoningSSE(reasoningText: string, responseText: string): string {
  const lines: string[] = [];

  // Reasoning events
  lines.push('event: response.reasoning.delta');
  lines.push('data: ' + JSON.stringify({ type: 'response.reasoning.delta', delta: { text: reasoningText } }));
  lines.push('');

  // Text events
  lines.push('event: response.output_text.delta');
  lines.push('data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: { text: responseText } }));
  lines.push('');

  lines.push('event: response.completed');
  lines.push('data: {"type":"response.completed"}');
  lines.push('');
  lines.push('data: [DONE]');
  lines.push('');
  return lines.join('\n');
}

// ==================== RESPONSE MOCKING ====================

export interface MockResponsesOptions {
  /** Default text for streaming responses. Default: 'Hello! I am a mock assistant.' */
  streamText?: string;
  /** Default text for non-streaming (title gen) responses. Default: 'Mock Title' */
  titleText?: string;
  /** Custom stream handler (overrides streamText) */
  streamHandler?: (route: any, request: any) => Promise<void>;
  /** Custom non-stream handler (overrides titleText) */
  nonstreamHandler?: (route: any, request: any) => Promise<void>;
}

/**
 * Intercepts /v1/responses with configurable mock responses.
 *
 * Handles both streaming (chat) and non-streaming (title gen) requests.
 */
export async function mockResponsesEndpoint(page: Page, options: MockResponsesOptions = {}) {
  const {
    streamText = 'Hello! I am a mock assistant.',
    titleText = 'Mock Title',
  } = options;

  await page.route('**/v1/responses', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();

    let payload: any = null;
    try { payload = req.postDataJSON(); } catch {}

    const isStream = payload?.stream === true;

    if (isStream) {
      if (options.streamHandler) {
        return options.streamHandler(route, req);
      }
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        },
        body: buildSSE([streamText]),
      });
    }

    // Non-streaming (title generation)
    if (options.nonstreamHandler) {
      return options.nonstreamHandler(route, req);
    }
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ output_text: titleText }),
    });
  });
}

/**
 * Mocks the /v1/models endpoint to return OpenAI models.
 */
export async function mockModelsEndpoint(page: Page, options: { models?: typeof OPENAI_MODELS } = {}) {
  const models = options.models || OPENAI_MODELS;
  await page.route('**/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        object: 'list',
        data: models,
      }),
    });
  });
}

// ==================== STREAM IDLE WAITER ====================
//
// Lightweight DOM-only wait used in replay-mode specs. `waitForAssistantDone`
// in live/helpers.ts has a 20s internal `page.waitForResponse` call — in
// replay mode our `route.fulfill` fires before `waitForResponse` is even
// registered, so it always times out and adds ~20s per message. This helper
// observes the SAME signals (assistant message text, wait-icon presence)
// without going through the network layer.

export async function waitForStreamIdle(page: Page, expectedCount: number, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState: unknown = null;
  while (Date.now() < deadline) {
    const state = await page.evaluate((minCount) => {
      const assistants = document.querySelectorAll('[role="listitem"][data-message-role="assistant"]');
      const count = assistants.length;
      const last = count > 0 ? assistants[count - 1] : null;
      const text = last ? (last.textContent || '').trim() : '';
      // The send button swaps the "Send" icon for a "Wait" icon while streaming.
      // The button itself is only disabled when input is empty AND not streaming,
      // so `disabled` is not a streaming indicator — the icon swap is.
      const waitIcon = document.querySelector('button[aria-label="Send"] img[alt="Wait"]');
      return {
        count,
        hasMin: count >= minCount,
        textLen: text.length,
        hasCursor: text.includes('█'),
        streaming: !!waitIcon,
      };
    }, expectedCount);
    lastState = state;
    if (state.hasMin && state.textLen > 0 && !state.hasCursor && !state.streaming) {
      return;
    }
    await page.waitForTimeout(75);
  }
  throw new Error(`Timed out waiting for stream idle (expected >= ${expectedCount} assistants). last=${JSON.stringify(lastState)}`);
}

// ==================== FIXTURE RECORD / REPLAY ====================
//
// Playwright's built-in routeFromHAR was empirically verified to drop
// `text/event-stream` response bodies during recording (Phase 0 smoke,
// 2026-04-18). This module provides a minimal plain-text fixture harness
// specifically for SSE + JSON replay that works with the app's fetch()-based
// stream parser.
//
// Fixture files live under tests-e2e/fixtures/ and are plain bodies. A tiny
// sidecar `.meta.json` records the mimeType so the replayer can reconstruct
// the fulfill headers without human intervention.

export const FIXTURES_DIR = path.join(
  // __dirname is not defined in ESM; derive from mock-helpers.ts location.
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'fixtures'
);

interface FixtureMeta {
  url: string;
  method: string;
  mimeType: string;
  recordedAt: string;
  bytes: number;
  promptPreview?: string;
}

function fixtureBodyPath(name: string): string {
  return path.join(FIXTURES_DIR, `${name}.body`);
}
function fixtureMetaPath(name: string): string {
  return path.join(FIXTURES_DIR, `${name}.meta.json`);
}

/**
 * Attach a recorder that saves the FIRST matching response body for the
 * given URL pattern to `tests-e2e/fixtures/<name>.body` plus metadata.
 *
 * Use this in a RECORD=1 branch inside a spec that's otherwise hitting the
 * live API. Subsequent (unset-RECORD) runs read the fixture via
 * `fulfillFromFixture`.
 *
 * Records only ONE body per call — the first matching POST 200 response.
 * Pass `matchBody` to skip requests whose POST payload doesn't match
 * (e.g. to skip title-generation requests and capture only the main stream).
 */
export async function recordResponseToFixture(page: Page, opts: {
  name: string;
  urlSubstring: string;
  /** Optional: only record responses whose request body (as string) contains this substring. */
  matchBody?: string;
  /** Optional: capture a short prompt preview in the meta for human reference. */
  promptPreview?: string;
}) {
  const { name, urlSubstring, matchBody, promptPreview } = opts;
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  let captured = false;
  page.on('response', async (response) => {
    if (captured) return;
    const req = response.request();
    if (!response.url().includes(urlSubstring)) return;
    if (req.method() !== 'POST') return;
    if (response.status() !== 200) return;
    if (matchBody) {
      const postData = req.postData() || '';
      if (!postData.includes(matchBody)) return;
    }

    try {
      const body = await response.text();
      const mime = (response.headers()['content-type'] || 'application/octet-stream').trim();
      const meta: FixtureMeta = {
        url: response.url(),
        method: req.method(),
        mimeType: mime,
        recordedAt: new Date().toISOString(),
        bytes: body.length,
        promptPreview,
      };
      fs.writeFileSync(fixtureBodyPath(name), body, 'utf-8');
      fs.writeFileSync(fixtureMetaPath(name), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
      captured = true;
      // eslint-disable-next-line no-console
      console.log(`[fixture] recorded ${name} (${body.length} bytes, ${mime})`);
    } catch (err) {
      // Non-fatal — the test may still succeed, we just won't have a fixture.
      // eslint-disable-next-line no-console
      console.warn(`[fixture] failed to record ${name}:`, err);
    }
  });
}

/**
 * Install a `page.route` handler that fulfills the FIRST matching request
 * with the recorded fixture body + mimeType. Subsequent matching requests
 * within the same test fall through to whatever else is routed (this is how
 * title-gen and main-message mocks coexist — each is its own fixture).
 *
 * Pair with `recordResponseToFixture` when RECORD=1 is set.
 */
export async function fulfillFromFixture(page: Page, opts: {
  name: string;
  urlSubstring: string;
  /** Optional: only intercept requests whose POST body contains this substring. */
  matchBody?: string;
}) {
  const { name, urlSubstring, matchBody } = opts;
  const bodyPath = fixtureBodyPath(name);
  const metaPath = fixtureMetaPath(name);
  if (!fs.existsSync(bodyPath) || !fs.existsSync(metaPath)) {
    throw new Error(
      `Fixture "${name}" not found at ${bodyPath}. Run the spec with RECORD=1 against the live project to generate it.`
    );
  }
  const body = fs.readFileSync(bodyPath, 'utf-8');
  const meta: FixtureMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  let fulfilled = false;
  // Use a function matcher so we can filter by full URL regardless of glob
  // quirks, and check the POST body without re-parsing inside the route.
  await page.route(
    (url) => url.href.includes(urlSubstring),
    async (route) => {
      if (fulfilled) return route.fallback();
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      if (matchBody) {
        const postData = req.postData() || '';
        if (!postData.includes(matchBody)) return route.fallback();
      }
      fulfilled = true;
      const headers: Record<string, string> = {
        'content-type': meta.mimeType,
      };
      if (meta.mimeType.includes('event-stream')) {
        headers['cache-control'] = 'no-cache';
        headers['connection'] = 'keep-alive';
      }
      await route.fulfill({ status: 200, headers, body });
    }
  );
}

/**
 * Convenience: `RECORD=1 → record`, otherwise `→ replay`. Thin wrapper
 * that picks the right mode based on env var so specs stay small.
 */
export async function fixtureRecordOrReplay(page: Page, opts: {
  name: string;
  urlSubstring: string;
  matchBody?: string;
  promptPreview?: string;
}): Promise<'record' | 'replay'> {
  if (process.env.RECORD) {
    await recordResponseToFixture(page, opts);
    return 'record';
  }
  await fulfillFromFixture(page, opts);
  return 'replay';
}

/**
 * Multi-fixture variant: record or replay an ORDERED sequence of responses to
 * the same URL pattern. Use when a single test sends multiple messages and
 * each needs its own fixture (e.g. "consecutive messages" reasoning test).
 *
 * Recording: the i-th matching 200 POST lands in fixtures[i].
 * Replay: the i-th matching request gets fulfilled from fixtures[i].
 * After all fixtures are consumed, subsequent requests fall back to whatever
 * other routes are registered (or the network, if none).
 */
export async function fixturesRecordOrReplaySeq(page: Page, opts: {
  names: string[];
  urlSubstring: string;
  matchBody?: string;
  promptPreview?: string;
}): Promise<'record' | 'replay'> {
  const { names, urlSubstring, matchBody, promptPreview } = opts;
  if (process.env.RECORD) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    let idx = 0;
    // Use route.fetch() rather than page.on('response') because Chromium GCs
    // response bodies aggressively when a new request arrives, causing
    // `response.text()` to fail with "No data found for resource" on the
    // second-and-later SSE stream in a test. route.fetch() reads the full
    // body synchronously server-side before the browser even sees the
    // response, which is race-free.
    await page.route(
      (url) => url.href.includes(urlSubstring),
      async (route) => {
        const req = route.request();
        if (req.method() !== 'POST') return route.fallback();
        if (matchBody) {
          const postData = req.postData() || '';
          if (!postData.includes(matchBody)) return route.fallback();
        }
        if (idx >= names.length) return route.fallback();
        const name = names[idx];
        idx++;
        try {
          const response = await route.fetch();
          const body = await response.text();
          const mime = (response.headers()['content-type'] || 'application/octet-stream').trim();
          const meta: FixtureMeta = {
            url: req.url(),
            method: req.method(),
            mimeType: mime,
            recordedAt: new Date().toISOString(),
            bytes: body.length,
            promptPreview: promptPreview ? `${promptPreview} (#${idx})` : undefined,
          };
          fs.writeFileSync(fixtureBodyPath(name), body, 'utf-8');
          fs.writeFileSync(fixtureMetaPath(name), JSON.stringify(meta, null, 2) + '\n', 'utf-8');
          // eslint-disable-next-line no-console
          console.log(`[fixture] recorded ${name} (${body.length} bytes, ${mime})`);
          await route.fulfill({ response });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[fixture] failed to record ${name}:`, err);
          return route.fallback();
        }
      }
    );
    return 'record';
  }

  // Replay: single route handler that dispenses fixtures in order.
  const queue: { body: string; mime: string }[] = names.map((n) => {
    if (!fs.existsSync(fixtureBodyPath(n)) || !fs.existsSync(fixtureMetaPath(n))) {
      throw new Error(
        `Fixture "${n}" missing. Run with RECORD=1 against --project=record to regenerate.`
      );
    }
    const m: FixtureMeta = JSON.parse(fs.readFileSync(fixtureMetaPath(n), 'utf-8'));
    return { body: fs.readFileSync(fixtureBodyPath(n), 'utf-8'), mime: m.mimeType };
  });

  await page.route(
    (url) => url.href.includes(urlSubstring),
    async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      if (matchBody) {
        const postData = req.postData() || '';
        if (!postData.includes(matchBody)) return route.fallback();
      }
      const next = queue.shift();
      if (!next) return route.fallback();
      const headers: Record<string, string> = { 'content-type': next.mime };
      if (next.mime.includes('event-stream')) {
        headers['cache-control'] = 'no-cache';
        headers['connection'] = 'keep-alive';
      }
      await route.fulfill({ status: 200, headers, body: next.body });
    }
  );
  return 'replay';
}
