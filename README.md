# WolfeChat - Multi-Provider AI Chat UI

A browser-based chat interface for OpenAI (GPT-4, o1) and Anthropic (Claude) models. Use your own API keys with a clean, familiar UI—no subscriptions, pay only for what you use.

## Build notes

To build for production:

```
npm run build
```

To run locally for dev:

```
npm run dev
```

## Testing

The project includes a comprehensive test suite with both unit tests and end-to-end (E2E) browser tests.

### Test Organization

**Unit Tests** (Node.js with JSDOM):
- `src/tests/unit/` - Fast unit tests for individual components and functions

**E2E Tests** (Playwright browser tests):
- `tests-e2e/nonlive/` - Browser tests that don't require external APIs
- `tests-e2e/live/` - Browser tests that require OpenAI and/or Anthropic APIs (set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` env vars)

### Running Tests

**Unit Tests:**
```bash
# Run all unit tests (recommended - uses pinned Node 18)
npm run test

# Alternative unit test commands
node run-tests.mjs --suite unit          # Unit tests only
node run-tests.mjs --suite live          # Unit tests requiring APIs
node run-tests.mjs --suite all           # All unit test suites

# Filter unit tests
node run-tests.mjs --tag keyboard        # Run tests tagged 'keyboard'
node run-tests.mjs --name "scroll"       # Run tests containing 'scroll' in name
```

**E2E Browser Tests:**
```bash
# Run all E2E tests
npx playwright test tests-e2e

# Run non-live E2E tests (no API key needed)
npx playwright test tests-e2e/nonlive

# Run live E2E tests (requires OPENAI_API_KEY and/or ANTHROPIC_API_KEY)
npx playwright test tests-e2e/live

# Run specific test file
npx playwright test tests-e2e/live/api-error-preserves-conversation.spec.ts
```

**Important:** This project requires Node.js 18 due to test dependencies.

**Node Version Management:**
- This project is configured with Volta to automatically use Node 18.20.5 and npm 10.2.4
- If you have [Volta](https://volta.sh/) installed, it should automatically use the correct versions
- If tests fail with Node version errors, try: `volta run npm run test`
- If you don't have Volta, manually install Node.js 18.x or install Volta: `curl https://get.volta.sh | bash`

See [CLI_TESTING.md](CLI_TESTING.md) for detailed testing documentation.

## Credits and History
WolfeChat is a fork and continuation of prior excellent open-source work. Special thanks to patrikzudel for the original [PatrikZeros-ChatGPT-API-UI](https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI), and to agambon for the improvements in [SmoothGPT](https://github.com/agambon/SmoothGPT) that led to this project. This repository adapts and extends that lineage for WolfeChat while acknowledging all prior authors and licensing.

This project evolves the UI/UX, features, and codebase organization to fit WolfeChat’s goals while remaining grateful to the projects it builds upon.

## Multi-Provider Support

**Supported Providers:**
- **OpenAI**: GPT-4, GPT-3.5, o1/o3 reasoning models, vision, TTS, DALL-E
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Haiku, vision support

**Features:**
- Dual API key support—configure one or both providers
- Automatic provider routing based on model selection
- Seamless model switching within conversations
- Reasoning window display for o1 and Claude models
- Quick Settings for per-conversation model/parameter overrides

**Setup:**
1. Click Settings → Select provider (OpenAI or Anthropic)
2. Enter API key(s)
3. Start chatting—switch models anytime via Quick Settings

## Security

**Anthropic API Browser Access:**
This application uses the `anthropic-dangerous-direct-browser-access: true` header for direct browser communication with Anthropic's API. This implementation has been reviewed and approved by internal security teams and is authorized as secure for this specific use case. The header is required for browser-based applications to access Anthropic's API directly.

## Key Features

### Multi-Model Support
- **Dual Providers**: OpenAI and Anthropic in one interface
- **Quick Settings**: Switch models mid-conversation with per-chat overrides
- **Reasoning Models**: o1/o3 (OpenAI) and Claude reasoning with dedicated display windows

### Enhanced UX
- **Mobile-Friendly**: Responsive design tested on Firefox/Android
- **Message Management**: Copy, delete, or fork conversations at any point
- **Smart Autoscroll**: Scroll freely during streaming without disruption
- **Safe Stream Control**: Stop incoming responses cleanly without breaking state

### Modern API Integration
- **OpenAI Responses API**: SSE streaming with reasoning window support
- **Anthropic SDK**: Native Claude integration with progressive streaming
- **Browser-Based**: Direct API calls—no backend, all data in browser storage

### Conversation Features
- **Auto-Generated Titles**: Multi-provider fallback for smart naming
- **Custom Titles**: Edit conversation names anytime
- **Image Vision**: Upload images for GPT-4 Vision and Claude analysis
- **Enter Key Config**: Choose "send" or "newline" behavior

## Data Storage

Conversations are stored in browser localStorage—no server, no tracking. If you clear browser data, conversations are lost. You can download/restore sessions locally via Settings.

*** 

Further reading:
- Original project: [PatrikZeros-ChatGPT-API-UI](https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI)
- Prior fork: [SmoothGPT](https://github.com/agambon/SmoothGPT)
