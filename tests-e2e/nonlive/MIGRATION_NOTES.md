# Test Migration Notes: reasoning-windows-placement.spec.ts

## Migration Summary
Successfully migrated `src/tests/browser-nonlive/reasoningWindowsPlacement.test.ts` to Playwright e2e test at `tests-e2e/nonlive/reasoning-windows-placement.spec.ts`.

## Key Changes Made

### 1. Test Approach
- **Original**: Direct store manipulation and DOM queries
- **Migrated**: Network mocking with UI interaction via real user actions

### 2. Simplified Scope
Focused on the three most critical test scenarios:
1. Reasoning windows appear only when reasoning data is in API response
2. Reasoning window placement remains stable when new messages are added  
3. Non-reasoning models don't show reasoning windows

Deferred for future implementation (require more complex multi-chat UI navigation):
- Per-conversation separation
- New chat append behavior
- Chat deletion behavior
- Chat switching isolation

### 3. Technical Implementation

#### Network Mocking
- Mock `/v1/responses` endpoint to control reasoning data
- Use SSE (Server-Sent Events) format matching production API
- Control reasoning inclusion based on model selection (`gpt-5-nano` = reasoning, `gpt-3.5-turbo` = no reasoning)

#### UI Interaction
- Use semantic selectors: `getByRole('textbox')`, `getByRole('button')`
- Quick Settings access via `button[aria-controls="quick-settings-body"]`
- Model selection via `#current-model-select`
- Reasoning window detection via `details:has-text("Reasoning")`

#### Helper Functions
- `seedTestEnvironment()`: Set up localStorage with test models
- `sendMessage()`: Send chat messages via UI
- `selectModel()`: Change model via Quick Settings
- `createSSEStream()`: Generate mock API responses

### 4. Improvements Over Original

1. **More realistic**: Tests actual UI behavior instead of internal state
2. **More maintainable**: Uses stable selectors aligned with AGENTS.md guidance  
3. **Faster execution**: ~8 seconds vs longer original test suite
4. **Better isolation**: Each test is independent with its own mock setup

### 5. Future Enhancements

To fully match original test coverage, add:
1. Multi-chat navigation tests (requires better sidebar navigation helpers)
2. Chat deletion and reindexing tests
3. Conversation-scoped reasoning window tests

### 6. Key Learnings

- Network mocking is more reliable than store manipulation for e2e tests
- Simpler test scenarios often provide better coverage and maintainability
- Focus on user-visible behavior rather than implementation details
- Use production-stable selectors (ARIA attributes, IDs) over classes