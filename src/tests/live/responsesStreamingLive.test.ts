import { registerTest } from '../testHarness';
import { get } from 'svelte/store';
import { apiKey } from '../../stores/stores';
import { testResponsesStreamingAPI } from '../../utils/debugUtils';

registerTest({
  id: 'live-responses-stream',
  name: 'Live API: Responses API streams tokens',
  tags: ['live', 'api', 'responses', 'network', 'smoke'],
  timeoutMs: 60000,
  fn: async (assert) => {
    const key = get(apiKey);
    assert.that(!!key, 'API key is configured');
    if (!key) return;

    try {
      const result = await testResponsesStreamingAPI();
      assert.that(!!result, 'Received a result object');
      assert.that(!!result?.success, 'Streaming API call succeeded');
      assert.that((result?.eventsCount ?? 0) > 0, 'Observed at least one streaming event');
      assert.that(!!(result?.finalText ?? '').trim(), 'Final streamed text is non-empty');
    } catch (e) {
      assert.that(false, `Streaming API test error: ${e?.message ?? e}`);
    }
  }
});
