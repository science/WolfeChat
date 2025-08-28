/**
 * src/tests/smokeTests.ts
 * Register two smoke tests (non-stream and streaming) that rely on existing debugUtils functions.
 */

import { registerTest, runAllTests, formatSuiteResultsText } from './testHarness.js';
import type { SuiteResult } from './testHarness.js';
import { testResponsesAPI, testResponsesStreamingAPI } from '../utils/debugUtils.js';

let registered = false;

function registerSmokeTests() {
  if (registered) return;
  registered = true;

  registerTest({
    id: 'responses-api-nonstream',
    name: 'Responses API - Non-Streaming returns text',
    tags: ['smoke', 'responses'],
    timeoutMs: 30000,
    fn: async (assert) => {
      const result = await testResponsesAPI();
      assert.that(result != null, 'Result should be returned');
      assert.that(result?.success === true, 'Result.success should be true');
      assert.that(typeof result?.model === 'string' && result?.model.length > 0, 'Model id should be a non-empty string');
      assert.that(typeof result?.outputText === 'string', 'Output text should be a string');
      assert.that((result?.outputText ?? '').trim().length > 0, 'Output text should be non-empty');
      // Optional weak heuristic assertions
      assert.that((result?.outputText ?? '').length >= 5, 'Output text length should be at least 5 chars');
    },
  });

  registerTest({
    id: 'responses-api-streaming',
    name: 'Responses API - Streaming yields events and final text',
    tags: ['smoke', 'responses', 'stream'],
    timeoutMs: 45000,
    fn: async (assert) => {
      const result = await testResponsesStreamingAPI();
      assert.that(result != null, 'Result should be returned');
      assert.that(result?.success === true, 'Result.success should be true');
      assert.that(typeof result?.model === 'string' && result?.model.length > 0, 'Model id should be a non-empty string');
      assert.that(typeof result?.eventsCount === 'number' && result?.eventsCount > 0, 'Should receive at least one streaming event');
      assert.that(typeof result?.finalText === 'string', 'Final text should be a string');
      assert.that((result?.finalText ?? '').trim().length > 0, 'Final text should be non-empty');
      // Optional weak heuristic: events > 3
      assert.that((result?.eventsCount ?? 0) >= 3, 'Should receive at least 3 streaming events');
    },
  });
}

export async function runSmokeTestSuite(): Promise<SuiteResult> {
  registerSmokeTests();
  return runAllTests({
    filter: (t) => (t.tags ?? []).includes('smoke'),
  });
}

export { formatSuiteResultsText };
