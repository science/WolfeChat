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

# Browser E2E tests (Playwright)
# Recommended: Run directly with Playwright
npx playwright test tests-e2e                    # all E2E tests
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

Tests use automatic discovery based on folder placement. Playwright handles browser tests.

Key test utilities:
- `tests-e2e/live/helpers.ts` - Refer to `tests-e2e/live/README.md` for guidance when writing live E2E tests.

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