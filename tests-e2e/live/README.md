# Playwright Live Suite
Browser tests that call real external APIs; requires OPENAI_API_KEY.

## Running Live Tests

```bash
# Run all live tests
npx playwright test tests-e2e/live

# Run specific test with debugging
DEBUG_E2E=2 npx playwright test tests-e2e/live/specific-test.spec.ts --headed
```

## Test Helpers

### Stream Completion Handlers

**Always use the provided helpers instead of creating custom locators for stream events:**

#### `waitForAssistantDone(page, opts)`
Primary handler for waiting for streaming responses to complete. Monitors multiple completion signals:
- Network SSE responses from OpenAI Responses API
- Assistant message appearance in DOM  
- Stream completion via injected monitor
- UI state indicators (send button enabled, no loading icons)

```javascript
import { waitForAssistantDone } from './helpers';

// Wait for streaming response to complete
await waitForAssistantDone(page, { 
  timeout: 30000,           // Max wait time (default: 60s)
  stabilizationTime: 500,   // Buffer after completion (default: 500ms)
  pollInterval: 100         // Check frequency (default: 100ms)
});
```

#### `waitForStreamComplete(page, opts)`
Alternative granular approach with configurable phases:
- Network idle detection
- Streaming state indicators  
- UI completion signals
- Delegates to `waitForAssistantDone` for final verification

### Message Handling

#### `sendMessage(page, text, opts)`
Robust message sending with multiple input detection strategies:

```javascript
await sendMessage(page, "Hello world", {
  submitMethod: 'ctrl-enter',  // 'ctrl-enter' | 'enter' | 'click-button'
  clearFirst: true,           // Clear existing text first
  waitForEmpty: true,         // Wait for input to clear after send
  inputTimeout: 10000         // Timeout for finding input element
});
```

#### `getVisibleMessages(page, opts)`
Extract conversation messages with role detection:

```javascript
const messages = await getVisibleMessages(page, {
  includeSystem: false,  // Include system messages
  waitForList: true,     // Wait for message list to appear
  timeout: 10000        // Timeout for initial list
});
// Returns: { role, text, model?, index, element }[]
```

### Settings Helpers

#### `bootstrapLiveAPI(page)`
Set up OpenAI API key and wait for models to populate in Settings.

#### `operateQuickSettings(page, opts)`
Comprehensive Quick Settings panel management:

```javascript
await operateQuickSettings(page, {
  mode: 'ensure-open',           // 'ensure-open' | 'ensure-closed' | 'open' | 'close'
  model: /gpt-5-nano/i,         // Model selection (string or RegExp)
  reasoningEffort: 'medium',     // 'minimal' | 'low' | 'medium' | 'high'
  verbosity: 'medium',          // 'low' | 'medium' | 'high'  
  summary: 'auto',              // 'auto' | 'detailed' | 'null'
  closeAfter: false             // Close panel after changes
});
```

### Settings Management Helpers

#### Composite Helpers (Recommended)
Use these for standard Settings operations:

##### `setProviderApiKey(page, provider, apiKey)`
Sets up a provider with API key and closes Settings when done:
```javascript
await setProviderApiKey(page, 'OpenAI', openaiKey);
// Settings is now closed, models are loaded
```

##### `bootstrapBothProviders(page)`
Sets up both OpenAI and Anthropic providers:
```javascript
await bootstrapBothProviders(page);
// Both providers configured, Settings closed
```

#### Atomic Helpers (Advanced)
⚠️ **Only use when you need granular control during Settings operations**

These helpers provide fine-grained control over Settings modal state:

##### `openSettingsAndSelectProvider(page, provider?)`
Opens Settings and optionally selects a provider:
```javascript
await openSettingsAndSelectProvider(page, 'OpenAI');
// Settings is now open with OpenAI selected
```

##### `fillApiKeyAndWaitForModels(page, apiKey, provider)`
Fills API key and waits for models (Settings must be open):
```javascript
await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');
// Models loaded, Settings still open
```

##### `getSettingsModels(page)`
Gets model list from Settings without closing:
```javascript
const models = await getSettingsModels(page);
// Returns array of model names, Settings remains open
```

##### `selectModelInSettings(page, model)`
Selects a model in Settings (without closing):
```javascript
await selectModelInSettings(page, 'gpt-3.5-turbo');
// Model selected, Settings still open
```

##### `saveAndCloseSettings(page)`
Saves and closes Settings modal:
```javascript
await saveAndCloseSettings(page);
// Settings is now closed
```

#### When to Use Atomic Helpers

Use atomic helpers only when you need to:
- Perform multiple operations while Settings is open
- Test Settings UI behavior between operations
- Verify state changes without closing/reopening Settings

**Example: Testing model persistence across provider switches**
```javascript
// Need Settings to stay open during provider switching
await openSettingsAndSelectProvider(page, 'OpenAI');
await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');

// Select a model
await selectModelInSettings(page, 'gpt-3.5-turbo');

// Switch providers without closing
const providerSelect = page.locator('#provider-selection');
await providerSelect.selectOption('Anthropic');
await fillApiKeyAndWaitForModels(page, anthropicKey, 'Anthropic');

// Verify model selection behavior
const models = await getSettingsModels(page);
// ... assertions ...

// Finally close Settings
await saveAndCloseSettings(page);
```

For standard API setup, always prefer composite helpers:
```javascript
// ✅ PREFERRED - Simple and reliable
await setProviderApiKey(page, 'OpenAI', openaiKey);

// ❌ AVOID - Unnecessarily complex for simple setup
await openSettingsAndSelectProvider(page, 'OpenAI');
await fillApiKeyAndWaitForModels(page, openaiKey, 'OpenAI');
await saveAndCloseSettings(page);
```

## Best Practices

### ❌ Don't Create Brittle Locators
```javascript
// AVOID - fragile and unreliable
await page.waitForSelector('button[disabled]', { state: 'hidden' });
await page.waitForSelector('.streaming-indicator', { state: 'hidden' });
await page.locator('#provider-selection').selectOption('OpenAI'); // Use setProviderApiKey() instead
await page.locator('#api-key').fill(key); // Use setProviderApiKey() instead
```

### ✅ Use Provided Helpers
```javascript
// PREFERRED - robust multi-signal completion detection
await waitForAssistantDone(page);
await setProviderApiKey(page, 'OpenAI', openaiKey);
await operateQuickSettings(page, { model: /gpt-3\.5-turbo/i });
```

### ⚠️ Critical Model Selection Patterns
```javascript
// ❌ WRONG - matches TTS models like "gpt-audio"
model: /gpt/i

// ✅ CORRECT - specific chat model
model: /gpt-3\.5-turbo/i

// ✅ CORRECT - reasoning model
model: /gpt-5-nano/i

// ✅ CORRECT - Claude model
model: /claude-3\.5-sonnet/i
```

### Standard Test Models
- **Non-reasoning tests**: `gpt-3.5-turbo` - Fast, reliable, cost-effective
- **Reasoning tests**: `gpt-5-nano` - Supports reasoning features with minimal cost

### Error Handling
All helpers provide detailed diagnostics on timeout. Enable debugging:
```bash
DEBUG_E2E=2 npx playwright test tests-e2e/live/your-test.spec.ts
```

## Network Test Debug Infrastructure

WolfeChat includes a comprehensive network debugging system for analyzing SSE streams, API interactions, and internal event flow. This is essential for debugging reasoning window bugs, stream completion issues, and API response processing.

### Debug Levels

The E2E test suite supports two separate debug logging systems:

#### E2E Test Runner Logging (`DEBUG_E2E`)

Controls logging from the **test runner** code (Node.js context) using `tests-e2e/debug-utils.ts`:

```bash
# No debugging (default)
npx playwright test tests-e2e/live/your-test.spec.ts

# Level 1: Basic test output
DEBUG_E2E=1 npx playwright test tests-e2e/live/your-test.spec.ts

# Level 2: Network and layer debugging (RECOMMENDED)
DEBUG_E2E=2 npx playwright test tests-e2e/live/your-test.spec.ts

# Level 3: Verbose SSE event tracing
DEBUG_E2E=3 npx playwright test tests-e2e/live/your-test.spec.ts
```

The `DEBUG_E2E` variable controls the `debugLog()` utility from `tests-e2e/debug-utils.ts`:
- `DEBUG_E2E=0` (or unset): No output
- `DEBUG_E2E=1`: Only errors (ERR level)
- `DEBUG_E2E=2`: Errors and warnings (ERR + WARN)
- `DEBUG_E2E=3`: All output (ERR + WARN + INFO)

#### Browser Application Logging (`VITE_E2E_TEST`)

Controls logging from the **browser application** code using `src/lib/logger.ts`:

```bash
# Enable browser debug logs during E2E tests
VITE_E2E_TEST=true npx playwright test tests-e2e/live/your-test.spec.ts

# Combine both debug systems (MOST COMPREHENSIVE)
DEBUG_E2E=2 VITE_E2E_TEST=true npx playwright test tests-e2e/live/your-test.spec.ts
```

The browser logger (`src/lib/logger.ts`) provides:
- `log.debug()` - Only logged when `VITE_E2E_TEST=true` or in dev mode
- `log.info()` - Only logged when `VITE_E2E_TEST=true` or in dev mode
- `log.warn()` - Always logged
- `log.error()` - Always logged

**Key Difference:**
- `DEBUG_E2E`: Controls test helper/runner output in terminal
- `VITE_E2E_TEST`: Enables debug logs inside the browser application

**Best Practice for Debugging:**
```bash
# Full visibility - see both test runner and browser logs
DEBUG_E2E=2 VITE_E2E_TEST=true npx playwright test tests-e2e/live/your-test.spec.ts --headed
```

### Debug Infrastructure Components

#### Layer-Based Event Tracking

When `DEBUG_E2E=2`, the app automatically enables layer-based debugging that tracks data flow through:

- **sseParser**: Raw SSE events from OpenAI Responses API
- **messageAssembly**: Message creation and content accumulation
- **storeUpdates**: Svelte store state changes
- **reasoning**: Reasoning window and panel lifecycle
- **reactivity**: DOM updates and reactivity chains

#### Enabling Debug Logging in Tests

```typescript
await page.evaluate(() => {
  // Enable comprehensive debugging
  (window as any).__DEBUG_E2E = 2;
});
```

#### Debug Data Access

```typescript
// Get comprehensive debug data
const debugData = await page.evaluate(() => {
  const win = window as any;
  return win.getDebugData ? win.getDebugData() : null;
});

if (debugData) {
  console.log('SSE Parser events:', debugData.layers.sseParser.length);
  console.log('Reasoning events:', debugData.layers.reasoning.length);
  console.log('Timeline events:', debugData.timeline.length);
}
```

#### Reset Debug Data Between Tests

```typescript
await page.evaluate(() => {
  const win = window as any;
  if (typeof win.resetDebugData === 'function') {
    win.resetDebugData();
  }
});
```

### SSE Event Debugging

#### Raw SSE Response Capture

```typescript
// Capture SSE responses from OpenAI API
const sseEvents = [];
page.on('response', async (response) => {
  if (response.url().includes('api.openai.com/v1/responses') && response.status() === 200) {
    const responseText = await response.text();

    // Parse SSE blocks
    const blocks = responseText.split('\n\n').filter(b => b.trim());
    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr = line.slice(5).trim();
        }
      }

      if (dataStr && dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          sseEvents.push({ type: eventType, data });
        } catch {}
      }
    }
  }
});
```

#### Console Log Analysis

Debug events appear in browser console with specific prefixes:

```
[DEBUG-SSEPARSER] sse_event_resolved {seq: 1, convId: "abc", respId: "def", data: {...}}
[DEBUG-REASONING] window_creation_completed {seq: 5, convId: "abc", windowId: "xyz"}
[DEBUG-REASONING] panel_creation_completed {seq: 8, respId: "def", panelId: "panel123"}
```

### Common Debug Patterns

#### Investigating Reasoning Window "0 Messages" Bug

```typescript
test('debug reasoning window', async ({ page }) => {
  // Enable debugging
  await page.evaluate(() => { (window as any).__DEBUG_E2E = 2; });

  // Perform test actions...
  await sendMessage(page, 'Test message');
  await waitForStreamComplete(page);

  // Check reasoning window state
  const windowText = await page.locator('[role="region"][aria-label*="Reasoning"]').innerText();
  const messageMatch = windowText.match(/(\d+)\s+messages?/);
  const messageCount = messageMatch ? parseInt(messageMatch[1]) : -1;

  if (messageCount === 0) {
    // Analyze debug data
    const debugData = await page.evaluate(() => window.getDebugData());

    console.log('Window creations:', debugData.layers.reasoning.filter(e =>
      e.event === 'window_creation_completed').length);
    console.log('Panel creations:', debugData.layers.reasoning.filter(e =>
      e.event === 'panel_creation_completed').length);
    console.log('SSE reasoning events:', debugData.layers.sseParser.filter(e =>
      e.data?.resolvedType?.includes('reasoning')).length);
  }
});
```

#### Analyzing Stream Completion Issues

```typescript
test('debug stream completion', async ({ page }) => {
  await page.evaluate(() => { (window as any).__DEBUG_E2E = 2; });

  // Send message
  await sendMessage(page, 'Test');

  // Analyze completion signals
  const debugData = await page.evaluate(() => window.getDebugData());

  // Check for completion events
  const completionEvents = debugData.timeline.filter(e =>
    e.event.includes('completed') || e.event.includes('done'));

  console.log('Completion events timeline:');
  completionEvents.forEach(e => {
    console.log(`  ${e.sequenceId}: [${e.layer}] ${e.event}`);
  });
});
```

#### API Response ID Correlation

```typescript
// Track response IDs across layers
const responseIds = new Set();
debugData.timeline.forEach(event => {
  if (event.responseId) {
    responseIds.add(event.responseId);
  }
});

console.log('Response IDs found:', Array.from(responseIds));

// Find mismatched IDs
const windows = debugData.layers.reasoning.filter(e => e.event === 'window_creation_completed');
const panels = debugData.layers.reasoning.filter(e => e.event === 'panel_creation_completed');

windows.forEach(w => {
  const matchingPanels = panels.filter(p => p.responseId === w.data.windowId);
  if (matchingPanels.length === 0) {
    console.log('Window without matching panels:', w.data.windowId);
  }
});
```

### Debug Output Analysis

When debugging is enabled, look for these patterns:

**Healthy Stream Processing:**
```
[DEBUG-SSEPARSER] sse_event_resolved {resolvedType: "response.created"}
[DEBUG-SSEPARSER] sse_event_resolved {resolvedType: "response.reasoning_text.delta"}
[DEBUG-REASONING] window_creation_completed {windowId: "resp_123"}
[DEBUG-REASONING] panel_creation_completed {panelId: "panel_456", responseId: "resp_123"}
```

**Common Problems:**
```
# Window created but no panels (reasoning bug):
[DEBUG-REASONING] window_creation_completed {windowId: "resp_123"}
# Missing: panel_creation_completed events

# ID mismatch:
[DEBUG-REASONING] window_creation_completed {windowId: "resp_123"}
[DEBUG-REASONING] panel_creation_completed {responseId: "resp_456"}  # Different ID!
```

### Performance Considerations

- Debug mode adds overhead - only enable during test development
- `DEBUG_E2E=3` is very verbose and should be used sparingly
- Debug data accumulates during test runs - use `resetDebugData()` between tests for isolation
- Console logs are captured by Playwright test output - review logs after test failures

### Best Practices

1. **Always enable `DEBUG_E2E=2` when developing new tests**
2. **Use `resetDebugData()` between test cases** for clean state
3. **Check debug output patterns** when tests fail unexpectedly
4. **Correlate response IDs** across layers to identify data flow issues
5. **Filter debug events by conversation ID** when testing multiple conversations
