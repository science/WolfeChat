import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';
import { apiKey } from '../../stores/stores.js';
import { testResponsesStreamingAPI } from '../../utils/debugUtils.js';

registerTest({
  id: 'live-responses-stream',
  name: 'Live API: Responses API streams tokens',
  tags: ['live', 'api', 'responses', 'network', 'smoke'],
  timeoutMs: 60000,
  fn: async (assert) => {
    const key = get(apiKey);
    assert.that(!!key, 'API key is configured');
    if (!key) return;

    const { selectedModel } = await import('../../stores/stores.js');
    const { getReasoningModel } = await import('../testModel.js');
    const prevModel = get(selectedModel as any);

    try {
      localStorage.removeItem('selectedModel');
      (selectedModel as any).set(getReasoningModel());

      const result = await testResponsesStreamingAPI();
      assert.that(!!result, 'Received a result object');
      assert.that(!!result?.success, 'Streaming API call succeeded');
      assert.that((result?.eventsCount ?? 0) > 0, 'Observed at least one streaming event');
      assert.that(!!(result?.finalText ?? '').trim(), 'Final streamed text is non-empty');
    } catch (e) {
      assert.that(false, `Streaming API test error: ${e?.message ?? e}`);
    } finally {
      if (prevModel != null) (selectedModel as any).set(prevModel);
    }
  }
});
