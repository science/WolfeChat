# Unit Tests

This directory contains unit tests that can run in a Node.js environment with JSDOM for basic DOM simulation.

## Characteristics
- Run in Node.js with JSDOM
- Do not require a real browser
- Do not require network connectivity
- Test pure logic, utility functions, and simple component behavior
- Fast execution time

## Running Tests
```bash
# Run all unit tests
npm test
# or
node run-tests.mjs --suite unit

# Run tests with specific name pattern
node run-tests.mjs --suite unit --name keyboard

# Run tests with specific tag
node run-tests.mjs --suite unit --tag keyboard
```

## Test Files
- `chatScrollState.test.ts` - ScrollMemory utility tests
- `chatStreamingScroll.test.ts` - Streaming scroll behavior tests
- `codeRendererStreaming.test.ts` - Code renderer with streaming updates
- `ctrlEnterSend.test.ts` - Keyboard shortcut handling
- `keyboardSettings.test.ts` - Keyboard behavior settings
- `modelSelectionPayload.test.ts` - Model selection and payload generation
- `reasoningPayload.test.ts` - Reasoning model payload construction
- `responsesConversionAndPayload.test.ts` - Response API payload conversion

## Writing New Unit Tests
Unit tests should:
- Focus on testing logic and functions in isolation
- Mock external dependencies
- Not rely on full Svelte component mounting
- Use the test harness from `../testHarness.ts`

Example:
```typescript
import { registerTest } from '../testHarness.js';

registerTest({
  id: 'my-unit-test',
  name: 'My feature works correctly',
  tags: ['unit', 'feature'],
  fn: async (assert) => {
    const result = myFunction(input);
    assert.that(result === expected, 'Function returns expected value');
  }
});
```