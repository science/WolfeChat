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
await selectModelInSettings(page, 'gpt-4');
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
await selectModelInSettings(page, 'gpt-4');

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
