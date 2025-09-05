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
- `tests-e2e/live/` - Playwright browser tests with OpenAI API

#### Running Tests
```bash
# Unit tests (default)
npm run test

# Live API tests (requires OPENAI_API_KEY)
npm run test:live

# All tests
npm run test:all

# Browser E2E tests (Playwright)
# Recommended: Run directly with Playwright
npx playwright test tests-e2e                    # all E2E tests
npx playwright test tests-e2e/nonlive            # nonlive tests
npx playwright test tests-e2e/live               # live API tests (requires OPENAI_API_KEY)

# Alternative: npm wrappers (equivalent to above)
npm run test:browser          # wraps: npx playwright test tests-e2e/nonlive
npm run test:browser-live     # wraps: npx playwright test tests-e2e/live

# Run single test file
node run-tests.mjs --name "specific-test-name"
node run-tests.mjs --tag "tag-name"
```

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

### Testing Architecture

Tests use automatic discovery based on folder placement. The `run-tests.mjs` runner compiles TypeScript with esbuild and provides JSDOM environment for unit tests. Playwright handles browser tests.

Key test utilities:
- `src/tests/testHarness.ts` - Core test framework with Assert class
- `src/tests/mocks/` - Svelte store and component mocks for Node.js
- `tests-e2e/live/helpers.ts` - Shared Playwright test helpers

#### Standard Test Models

For consistency across tests, use these specific models:
- **Non-reasoning tests**: `gpt-3.5-turbo` - Fast, reliable, cost-effective
- **Reasoning tests**: `gpt-5-nano` - Supports reasoning features with minimal cost

These models provide consistent behavior and are available across different API access levels.

### API Integration

The app expects an OpenAI API key to be configured in Settings. It supports:
- Text completions (GPT-3.5, GPT-4, etc.)
- Vision models (image uploads)
- Reasoning models (o1-mini, o1-preview)
- TTS/Speech generation
- DALL-E image generation

SSE streaming is handled via fetch with proper abort controller management for safe stream termination.

## Important Notes

- Always preserve exact indentation when editing files
- The app uses Svelte 3 (not SvelteKit)
- TypeScript is configured with `checkJs: true`
- Tests automatically discovered by file location - no manual registration needed
- Reasoning text from o1 models is displayed but never sent back as conversation context
- Quick Settings changes are preserved per conversation across sessions