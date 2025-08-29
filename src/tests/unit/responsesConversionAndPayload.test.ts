import { registerTest } from '../testHarness.js';
import { buildResponsesPayload, buildResponsesInputFromMessages } from '../../services/openaiService.js';

// Define a local mirror of the internal message type we expect post-refactor
interface ChatMessage { role: 'system'|'user'|'assistant'; content: any }

function makeMsg(role: ChatMessage['role'], content: any): ChatMessage { return { role, content }; }

registerTest({
  id: 'nonapi-responses-conversion-payload',
  name: 'Responses conversion handles edge cases and builds valid payload',
  tags: ['non-api','responses','conversion'],
  timeoutMs: 5000,
  fn: async t => {
    // 1) Plain string content
    const msgs1: ChatMessage[] = [
      makeMsg('system','You are a helpful assistant.'),
      makeMsg('user','Say hi')
    ];
    const input1 = buildResponsesInputFromMessages(msgs1 as any);
    t.that(Array.isArray(input1), 'Input is array for messages');
    t.that(input1.length === 2, 'Two input turns');
    t.that(Array.isArray(input1[0].content), 'Each input turn has content array');
    t.that(input1[0].content[0].type === 'input_text' || input1[0].content[0].type === 'output_text', 'System mapped to text');

    // 2) Array-of-text and image objects mixed
    const msgs2: ChatMessage[] = [
      makeMsg('user', [
        { type: 'input_text', text: 'Describe this image' },
        { type: 'image_url', image_url: { url: 'https://example.com/x.png' } }
      ])
    ];
    const input2 = buildResponsesInputFromMessages(msgs2 as any);
    t.that(input2.length === 1, 'Single turn remains single');
    const c2 = input2[0].content;
    t.that(c2.some((p:any)=>p.type==='input_text'), 'Has input_text');
    t.that(c2.some((p:any)=>p.type==='input_image'), 'Has input_image');

    // 3) Non-string content coerces to string
    const msgs3: ChatMessage[] = [ makeMsg('user', { foo: 'bar', n: 2 }) ];
    const input3 = buildResponsesInputFromMessages(msgs3 as any);
    t.that(typeof input3[0].content[0].text === 'string', 'Object content coerced to string');

    // 4) Payload building includes model and stream flag
    const payload = buildResponsesPayload('gpt-5', input1, true);
    t.that(payload.model === 'gpt-5', 'Payload.model set');
    t.that(payload.stream === true, 'Payload.stream set');
    t.that(Array.isArray(payload.input), 'Payload.input is array');

    // 5) Reasoning extras added for reasoning models
    const payloadR = buildResponsesPayload('gpt-5', input1, false);
    t.that(!!payloadR.reasoning || !!payloadR.text, 'Reasoning/text extras exist for reasoning-capable model');
  }
});
