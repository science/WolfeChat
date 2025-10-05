# Wolfechat Development Guidelines

## Build & Development Commands
- `npm run dev`: Start dev server with hot reload (Vite on network with `--host`)
  - You never need to run the dev server: there is always a dev server instance running already.
- `npm run build`: Build to `dist/` (commit `dist/` for UI changes before merge)
  - Note: do not execute `npm run build` without being asked explicitly.
- `npm run check`: Type-check all TypeScript/Svelte files
- **Tests**: Custom test harness in `src/tests/`. Run individual test: import in `App.svelte` during dev

## Code Style & Structure
- **Formatting**: 2-space indents, no tabs. Imports: external libs → local modules
- **Naming**: Components `PascalCase.svelte`, functions/vars `camelCase`, assets `kebab-case.svg`
- **Types**: TypeScript strict mode. Define interfaces for all API responses and component props
- **Imports**: Use absolute paths from `src/`. Group: `svelte` → `openai`/libs → stores → utils → components
- **Error Handling**: Try-catch async operations, log errors to console, show user-friendly messages via stores

## Architecture Patterns
- `src/lib/`: Svelte components (UI only, no business logic)
- `src/managers/`: Feature orchestration, side effects, complex state updates
- `src/services/`: External API calls (OpenAI, PDFs). Keep network logic here
- `src/stores/`: Svelte stores for global state. Use `writable()` and `derived()`
- `src/utils/`: Pure functions, no side effects or store dependencies
- **Tailwind CSS**: Use utility classes. Custom styles go in `src/styles/` only when needed
- **State Management**: Prefer stores over props drilling. Update conversation via `conversationManager.ts`
- **Security**: Never commit API keys. Keys stored client-side only via Settings UI
- **Tests**: There are two types of tests "live" and "nonapi" -- there are two corresponding folders under the ./src/tests folder. Put new test files into the appropriate subfolder. Live tests use external APIs, and so running them should be limited to major integration regression testing (like during deployment pipelines). Nonapi tests are everything else and can be run freely at any time without requiring costs or much time. Where possible add tests to existing test files rather than creating small test files for obscure features that already have a major test suite file. When creating a test file, try to create names for the files that reflect the larger feature, so other future tests can also be added to this file over time.

### E2E debug chattiness toggle

To keep CI logs quiet but allow deep diagnostics locally, e2e tests can gate verbose browser and SSE logs behind an env-controlled debug level.

- Set DEBUG to control verbosity:
  - 0 (default): silent
  - 2: show browser console errors, pre-flight diagnostics, and OpenAI request/response summaries
  - 3: include high-volume SSE event names (debug spam)

Usage examples:
- Run one test with network/console logs:
  - `DEBUG=2 npx playwright test tests-e2e/live/sse-events-live.spec.ts -g "hook-based"`
- Include SSE event spam:
  - `DEBUG=3 npx playwright test tests-e2e/live/sse-events-live.spec.ts -g "hook-based"`

### Test utilities and live setup

- Prefer using helpers in `tests-e2e/live/helpers.ts` for stable, production-like flows:
  - `bootstrapLiveAPI(page)`: opens Settings, fills `#api-key`, clicks “Check API”, waits for models to populate, then saves and closes.
  - `selectReasoningModelInQuickSettings(page)`: opens Quick Settings via `button[aria-controls="quick-settings-body"]` and selects a reasoning-capable model (prefers `gpt-5-nano`).
  - `operateQuickSettings(page, opts)`: generalized, idempotent Quick Settings operator. Ensures the panel is open/closed as requested, selects the target model (by label/value or regex), and can set reasoning controls (effort/verbosity/summary). Use this instead of ad-hoc toggling.

Note for e2e authors:
- Always consult and reuse helpers from `tests-e2e/live/helpers.ts` for Quick Settings, Settings/API bootstrapping, and common UI flows. Avoid duplicating selectors or opening panels manually in each spec.
- For SSE/event-driven waits injected into the page, prefer the utilities in `src/tests/helpers/TestSSEEvents.ts` to bind callbacks and await semantic completion events.
- When driving the chat composer, follow existing patterns in e2e specs (e.g., resolving the chat input via role+name `getByRole('textbox', { name: /chat input/i })`, with fallbacks) rather than broad `getByRole('textbox')`.
- For SSE validation in-browser, use the wrapper in `src/tests/helpers/TestSSEEvents.ts` with `streamResponseViaResponsesAPI`:
  - Inject once per test page:
    - define `window.__runBoundStream(prompt)` that binds callbacks, awaits `sse.output.completed` and `sse.stream.done`, and returns `{ finalText }`.
- Prefer semantic wait hooks over manual timing:
  - Use `createStreamSession({...})` from `src/utils/streamSession.ts` when you need deterministic waits.
  - Treat “all reasoning complete” as the first main output token (simplifies cross-model behavior).
  - Primary waits: `awaitMainResponseCompleted()`, `awaitAllReasoningDone()`, `awaitCurrentReasoningDone(kind)`, `awaitStreamDone()`.
- Avoid ad-hoc localStorage hacks for API keys; always use the Settings flow to ensure `modelsStore` is populated before selecting a model.
- Keep per-test timeouts reasonable; live SSE tests use `test.setTimeout(45_000)` instead of `test.slow()`.

#### Key Helper Functions

• bootstrapLiveAPI(page): Opens Settings, fills API key, clicks "Check API", waits for models
• operateQuickSettings(page, opts): Idempotent Quick Settings operator with options:
 • mode: 'ensure-open', 'ensure-closed', 'open', 'close'
 • model: string or RegExp for model selection
 • reasoningEffort, verbosity, summary: reasoning controls
 • closeAfter: boolean to close panel after operations


#### Semantic Selectors

• Quick Settings toggle: button[aria-controls="quick-settings-body"]
• Model select: #current-model-select or getByRole('combobox', { name: /api model/i })
• Reasoning controls: #reasoning-effort, #verbosity, #summary
• Chat input: getByRole('textbox', { name: /chat input/i })
• Sidebar new conversation: nav .getByRole('button', { name: /^new conversation$/i })
• Conversation rows: .conversation.title-container

#### Wait Mechanisms

• SSE Event Hooks: Use bindToCallbacks() from TestSSEEvents.ts
• Key waits: waitForOutputCompleted(), waitForReasoningSummaryDone(), waitForAllDone()
• Network intercepts: Monitor api.openai.com requests to verify payloads

## Source code management

- Don't check in or stage new/changed/deleted files or folders unless explicitly asked to do so.

## UI Test Guidance (Playwright)

### **Don't run ANY tests unless you are explicitly asked to do so. Do not run playwright tests, unit tests, or any other tests without explicit direction from the user.**

### Use semantic, production-stable locators first. Avoid brittle or test-only selectors. Preferred strategies:

- Open panels via their controlling buttons, not content containers:
  - Use the ARIA relationship already in the DOM, e.g., `button[aria-controls="quick-settings-body"]` to open Quick Settings.
  - Do not try to click the body container to open it.

- Operate real, production IDs for inputs once visible:
  - Model select: `#current-model-select` (combobox) inside Quick Settings.
  - Prefer role-based queries when labels are stable: `getByRole('combobox', { name: /api model/i })`.

- Fallbacks only when necessary (in order):
  1) Role + accessible name
  2) ARIA relationships (e.g., `aria-controls`)
  3) Stable production IDs
  4) Last resort: localStorage setup + page reload

- Interaction recipe example for model change:
  1) Click `button[aria-controls="quick-settings-body"]`
  2) `await page.locator('#current-model-select').selectOption({ label: 'gpt-5' })`
  3) Send the message and assert the outgoing request payload

- Avoid hidden element interactions: ensure the control is visible before operating it (`await locator.isVisible()`).

- Prefer intercepting network requests to assert payloads instead of inspecting internal state.

- Keep tests resilient to copy and minor markup changes by leaning on ARIA roles/labels and semantic attributes already in production UI.
- Prefer production semantic tags over test-only IDs. When building features, add meaningful roles/labels/aria-* to significant UI so tests can hook them without test-only attributes. If a needed semantic tag is missing, surface this gap in the plan and add the semantic tag in the UI code rather than papering over with test IDs.

### LLM Model selection

- When using live LLM models, prefer 'gpt-5-nano' as the reasoning model, and use gpt-3.5-turbo as the non-reasoning model. 