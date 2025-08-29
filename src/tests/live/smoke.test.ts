/**
 * src/tests/live/smoke.test.ts
 * Smoke tests that verify basic API functionality
 */

import { test } from '../testHarness.js';
import { testResponsesAPI, testResponsesStreamingAPI } from '../../utils/debugUtils.js';

test({
  id: 'responses-api-nonstream',
  name: 'Responses API - Non-Streaming returns text',
  tags: ['smoke', 'responses', 'live'],
  timeoutMs: 30000,
  fn: async (assert) => {
    const result = await testResponsesAPI();
    assert.that(result != null, 'Result should be returned');
    assert.that(result?.success === true, 'Result.success should be true');
    assert.that(typeof result?.model === 'string' && (result?.model?.length ?? 0) > 0, 'Model id should be a non-empty string');
    assert.that(typeof result?.outputText === 'string', 'Output text should be a string');
    assert.that((result?.outputText ?? '').trim().length > 0, 'Output text should be non-empty');
    // Optional weak heuristic assertions
    assert.that((result?.outputText ?? '').length >= 5, 'Output text length should be at least 5 chars');
  },
});

test({
  id: 'responses-api-streaming',
  name: 'Responses API - Streaming yields events and final text',
  tags: ['smoke', 'responses', 'stream', 'live'],
  timeoutMs: 45000,
  fn: async (assert) => {
    const result = await testResponsesStreamingAPI();
    assert.that(result != null, 'Result should be returned');
    assert.that(result?.success === true, 'Result.success should be true');
    assert.that(typeof result?.model === 'string' && (result?.model?.length ?? 0) > 0, 'Model id should be a non-empty string');
    assert.that(typeof result?.eventsCount === 'number' && result?.eventsCount > 0, 'Should receive at least one streaming event');
    assert.that(typeof result?.finalText === 'string', 'Final text should be a string');
    assert.that((result?.finalText ?? '').trim().length > 0, 'Final text should be non-empty');
    // Optional weak heuristic: events > 3
    assert.that((result?.eventsCount ?? 0) >= 3, 'Should receive at least 3 streaming events');
  },
});