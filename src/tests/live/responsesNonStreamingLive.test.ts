import { registerTest } from '../testHarness.js';
import { get } from 'svelte/store';
import { apiKey } from '../../stores/stores.js';
import { testResponsesAPI } from '../../utils/debugUtils.js';

registerTest({
  id: 'live-responses-nonstream',
  name: 'Live API: Responses API returns text (non-streaming)',
  tags: ['live', 'api', 'responses', 'network', 'smoke'],
  timeoutMs: 45000,
  fn: async (assert) => {
    const key = get(apiKey);
    assert.that(!!key, 'API key is configured');
    if (!key) return;

    // Force a sane model independent of persisted localStorage
    const { selectedModel } = await import('../../stores/stores.js');
    const { getReasoningModel } = await import('../testModel.js');
    const prevModel = get(selectedModel as any);
    try {
      localStorage.removeItem('selectedModel');
      (selectedModel as any).set(getReasoningModel());

      const result = await testResponsesAPI();
      assert.that(!!result, 'Received a result object');
      assert.that(!!result?.success, 'Non-streaming API call succeeded');
      assert.that(!!(result?.outputText ?? '').trim(), 'Output text is non-empty');
    } catch (e) {
      assert.that(false, `Non-streaming API test error: ${e?.message ?? e}`);
    } finally {
      // Restore prior model selection to avoid test bleed
      if (prevModel != null) (selectedModel as any).set(prevModel);
    }
  }
});
