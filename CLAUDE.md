# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with hot reload (http://localhost:5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run Svelte TypeScript checking

### Testing

#### Test Organization
Tests are automatically discovered based on folder structure:
- `src/tests/unit/` - Unit tests with JSDOM environment
- `src/tests/live/` - Tests requiring OpenAI API
- `tests-e2e/nonlive/` - Playwright browser tests without external APIs
- `tests-e2e/live/` - Fast Playwright E2E tests with live APIs (parallel execution, "daily driver" tests)
- `tests-e2e/live-regression/` - Slow Playwright E2E tests for full production regression (serial execution, single worker)

#### Running Tests
```bash
# Unit tests (default)
npm run test                      # or: node run-tests.mjs

# Fast E2E tests (parallel, for daily development)
npm run test:browser-live         # or: npx playwright test --project=live
npm run test:browser              # or: npx playwright test --project=nonlive

# Full production regression (slow, serialized)
npm run test:regression           # or: npx playwright test --project=live-regression

# All tests (unit + all E2E projects)
npm run test:all                  # runs unit tests + all Playwright projects

# Specific test file
npx playwright test tests-e2e/live/specific-test.spec.ts
```

**Test Suite Purpose:**
- **live**: Fast feedback during development (parallel execution, ~3-5 minutes)
- **live-regression**: Comprehensive validation before releases (serial execution, ~10+ minutes, includes Anthropic tests)
- **nonlive**: Browser tests without external API dependencies

## Architecture

### Core Structure
WolfeChat is a Svelte-based ChatGPT UI that uses the OpenAI Responses API for streaming completions. The app is organized into:

- **Frontend Components** (`src/lib/`, `src/renderers/`)
  - `App.svelte` - Main application component with chat interface
  - `Sidebar.svelte` - Conversation list and management
  - `QuickSettings.svelte` - Per-conversation model/settings override
  - `ReasoningInline.svelte` / `ReasoningCollapsible.svelte` - Reasoning display for o1 models

- **State Management** (`src/stores/`)
  - `stores.ts` - Core application state (conversations, selected model)
  - `conversationQuickSettingsStore.ts` - Per-conversation settings overrides
  - `reasoningStore.ts` - Reasoning windows for o1 model responses
  - `keyboardSettings.ts` - Enter key behavior configuration

- **Business Logic** (`src/managers/`, `src/services/`)
  - `conversationManager.ts` - Message history, deletion, conversation operations
  - `openaiService.ts` - OpenAI API integration using Responses API (SSE streaming)
  - `imageManager.ts` - Image upload and vision message handling

### Key Architectural Decisions

1. **Responses API over ChatCompletions** - Uses OpenAI's newer Responses API for SSE streaming, enabling reasoning window support and better streaming control

2. **Per-Conversation Settings** - Quick Settings allow model/parameter overrides per conversation without changing global defaults

3. **Reasoning Windows** - Special handling for o1 model reasoning, displayed inline but not sent back as context

4. **Message Management** - Support for deleting individual messages or "delete all below" to fork conversations

5. **Browser Storage** - Conversations stored in browser localStorage, no backend persistence

6. **Multi-Provider Support** - Supports both OpenAI and Anthropic APIs with automatic provider routing based on model selection

### Code Reuse and DRY Principles

**Before implementing new functionality, always analyze existing code for reusable infrastructure.** Duplicating code paths leads to:
- Inconsistent behavior (e.g., one path handles edge cases, another doesn't)
- Regression bugs when fixes are applied to one path but not others
- Maintenance burden from multiple implementations of the same logic

#### Key Infrastructure to Reuse

**OpenAI API Calls:**
- `buildResponsesPayload()` in `openaiService.ts` - Handles reasoning model parameters correctly (max_completion_tokens vs max_tokens)
- `buildResponsesInputFromMessages()` - Converts messages to Responses API format
- Use the Responses API endpoint (`/v1/responses`), not the legacy ChatCompletions API

**Anthropic API Calls:**
- `createAnthropicClient()` in `anthropicClientFactory.ts` - Creates properly configured SDK client
- `getMaxOutputTokens()` in `anthropicModelConfig.ts` - Model-specific token limits
- `addThinkingConfigurationWithBudget()` in `anthropicReasoning.ts` - Extended thinking support
- Use SDK streaming (`client.messages.stream()`) instead of raw fetch

**Example Anti-Pattern (Avoid):**
```typescript
// BAD: Duplicated API call with hardcoded parameters
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  body: JSON.stringify({
    model,
    messages,
    max_tokens: 500,  // Won't work with reasoning models!
    stream: true
  })
});
```

**Example Correct Pattern:**
```typescript
// GOOD: Reuse existing infrastructure
import { buildResponsesPayload } from '../services/openaiService.js';

const payload = buildResponsesPayload(model, input, streaming, options);
const response = await fetch('https://api.openai.com/v1/responses', {
  body: JSON.stringify({ ...payload, stream: true })
});
```

#### When Adding New Features

1. **Search for existing implementations** - Before writing API calls, search the codebase for similar functionality
2. **Extract and reuse** - If existing code is embedded in a larger function, extract the reusable parts into utilities
3. **Create wrapper utilities** - When adapting existing infrastructure for a new use case, create thin wrapper utilities (see `summaryStreamingUtils.ts` as an example)
4. **Test alignment** - Write tests that verify new code uses the same code paths as existing functionality

### Security Considerations

**Anthropic API Browser Access:**
The application uses the `anthropic-dangerous-direct-browser-access: true` header for direct browser communication with Anthropic's API. This implementation has undergone internal security review and has been approved as secure for this specific use case. The header is required for browser-based applications to access Anthropic's API directly and is considered safe within the context of this client-side application architecture.

### Testing Architecture

Tests use automatic discovery based on folder placement. Playwright handles browser tests.

Key test utilities:
- `tests-e2e/live/helpers.ts` - Refer to `tests-e2e/live/README.md` for guidance when writing live E2E tests.

#### Critical E2E Testing Guidelines

**ALWAYS use test helpers - never create custom selectors or waits:**

1. **For API/Stream Events**: Use `waitForAssistantDone()` or `waitForStreamComplete()` - never create custom loading/streaming selectors
2. **For Settings**: Use `operateQuickSettings()`, `setProviderApiKey()`, `bootstrapLiveAPI()` - never manually interact with settings UI
3. **For Messages**: Use `sendMessage()` and `getVisibleMessages()` - never manually type or click send buttons
4. **For Model Selection**: Use specific model patterns like `/gpt-3\.5-turbo/i` for chat models, `/gpt-5-nano/i` for reasoning - never use broad patterns like `/gpt/i` that could match TTS/vision models

**Debugging Methodology:**
1. Always examine actual data (screenshots, console logs) rather than making assumptions
2. Write unit tests to isolate problems before fixing E2E issues
3. Don't mask symptoms with workarounds - find and fix root causes
4. Model type matters - TTS, vision, and chat models have different message handling behaviors

**Common Pitfalls:**
- Using `/gpt/i` regex that matches `gpt-audio` (TTS) instead of chat models
- Creating custom stream completion waits instead of using provided helpers
- Manually interacting with Settings UI instead of using helper functions
- Filtering out "empty" content messages instead of preventing them from being created

#### Test-Driven Development (TDD) Guidelines

When writing TDD tests, follow these practices:

1. **Write Tests for Desired Behavior** - Tests should describe what the feature SHOULD do when working correctly, not what it currently does wrong.

2. **Red-Green-Refactor Cycle**:
   - **Red**: Write a test that describes the desired behavior. Run it to confirm it fails (because the feature doesn't exist yet)
   - **Green**: Implement the minimal code to make the test pass
   - **Refactor**: Improve the implementation while keeping tests passing

3. **Test Naming**: Use descriptive names that explain the expected behavior:
   ```typescript
   // Good: describes desired behavior
   test('should preserve input text when creating new conversation')

   // Bad: focuses on current broken state
   test('new chat button clears input - SHOULD FAIL INITIALLY')
   ```

4. **Test Comments**: Write comments that describe the expected behavior, not the current bugs:
   ```typescript
   // Good: describes what should happen
   // Assert: Input should contain the original message

   // Bad: focuses on current failure
   // This will fail initially due to the bug - proving the bug exists
   ```

5. **Console Logging**: Use positive language in test output:
   ```typescript
   // Good: describes successful behavior
   console.log('✓ Input text preserved after new chat creation')

   // Bad: celebrates failure
   console.log('❌ TEST FAILED AS EXPECTED - This proves the bug exists!')
   ```

6. **When Tests Initially Fail**: This is expected and good! It means:
   - The test correctly identifies missing functionality
   - You have a clear target for implementation
   - You can measure progress as tests begin passing

Remember: TDD tests are specifications for how code should behave, written before the implementation exists.

### API Integration

The app expects an OpenAI API key to be configured in Settings. It supports:
- Text completions, streaming models (gpt-3.5-turbo, gpt-4o, gpt-4.1)
- Vision models (image uploads)
- Reasoning models (gpt-5, gpt-5-mini, gpt-5-nano, o3, o4)
- TTS/Speech generation
- DALL-E image generation

SSE streaming is handled via fetch with proper abort controller management for safe stream termination.

### Logging Architecture

**Browser Console Logging** - The application uses a tree-shaking logger to eliminate debug logs from production builds:

- **Logger Module** (`src/lib/logger.ts`): Centralized logging utility that uses `import.meta.env.DEV` for automatic dead-code elimination
  - `log.debug()` - Development/test only, stripped from production builds
  - `log.info()` - Development/test only, stripped from production builds
  - `log.warn()` - Always included in builds
  - `log.error()` - Always included in builds

**Usage Pattern:**
```typescript
import { log } from '../lib/logger.js';

// Debug logs (stripped in production)
log.debug('Starting API request:', { model, messageCount });
log.info('Configuration loaded successfully');

// Production logs (always included)
log.warn('Rate limit approaching threshold');
log.error('API request failed:', error);
```

**Build-Time Tree-Shaking:** Vite automatically removes `log.debug()` and `log.info()` calls during production builds, resulting in zero runtime overhead. The logger checks `import.meta.env.DEV` which Vite statically evaluates during bundling.

**Test Logging:**
- For E2E tests, set `VITE_E2E_TEST=true` environment variable to enable debug logs in the browser context. E2E test runner code uses the `debugLog()` system from `tests-e2e/debug-utils.ts` controlled by `DEBUG` environment variable.
- For unit tests, use the `debugLog()` system from `src/tests/utils/debugLog.ts` controlled by `DEBUG` environment variable.
- `DEBUG=0` or unset: No output (default)
- `DEBUG=1`: Only errors (ERR level)
- `DEBUG=2`: Errors and warnings (ERR + WARN levels)
- `DEBUG=3`: All output (ERR + WARN + INFO levels)

**Migration from console.log:** All production service code should use the logger instead of direct `console.*` calls. This has been implemented in:
- All service files (`src/services/`)
- Manager modules (`src/managers/`)
- Main entry point (`src/main.ts`)

## Important Notes

- Always preserve exact indentation when editing files
- The app uses Svelte 3 (not SvelteKit)
- TypeScript is configured with `checkJs: true`
- Tests automatically discovered by file location - no manual registration needed
- Quick Settings changes are preserved per conversation across sessions