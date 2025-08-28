import type { Test } from '../testHarness.js';
import type { Assert } from '../testHarness.js';
import { buildResponsesPayload, supportsReasoning } from '../../services/openaiService.js';
import { reasoningEffort, verbosity, summary } from '../../stores/reasoningSettings.js';

function makeInput() {
  return [
    {
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello' }]
    }
  ];
}

const tests: Test[] = [
  {
    id: 'reasoning-included',
    name: 'Includes reasoning and verbosity for reasoning-capable models',
    fn: async (assert: Assert) => {
      reasoningEffort.set('high');
      verbosity.set('low');
      summary.set('auto');

      const payload = buildResponsesPayload('gpt-5', makeInput(), false);
      assert.that(!!supportsReasoning('gpt-5'), 'gpt-5 is reasoning-capable');
      assert.that(!!payload.text && payload.text.verbosity === 'low', 'text.verbosity set for reasoning model');
      assert.that(!!payload.reasoning && payload.reasoning.effort === 'high', 'reasoning.effort set for reasoning model');
      assert.that(payload.reasoning.summary === 'auto', 'reasoning.summary set for reasoning model');
    }
  },
  {
    id: 'reasoning-excluded',
    name: 'Excludes reasoning and verbosity for non-reasoning models',
    fn: async (assert: Assert) => {
      reasoningEffort.set('medium');
      verbosity.set('high');
      summary.set('detailed');

      const payload = buildResponsesPayload('gpt-4.1', makeInput(), false);
      assert.that(!supportsReasoning('gpt-4.1'), 'gpt-4.1 is not reasoning-capable by rule');
      assert.that(!('text' in payload), 'text not present for non-reasoning model');
      assert.that(!('reasoning' in payload), 'reasoning not present for non-reasoning model');
    }
  },
  {
    id: 'summary-null-handled',
    name: 'Summary "null" selection maps to null in payload',
    fn: async (assert: Assert) => {
      summary.set('null');
      const payload = buildResponsesPayload('o4', makeInput(), false);
      assert.that(payload.reasoning && payload.reasoning.summary === null, 'reasoning.summary is null');
    }
  }
];

export default tests;
