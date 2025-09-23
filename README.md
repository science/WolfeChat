# WolfeChat - a Multi-Provider Chat UI

WolfeChat supports both OpenAI and Anthropic AI providers, giving you access to GPT and Claude models in a single interface.

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

WolfeChat now supports both OpenAI and Anthropic AI providers:

**Supported Providers:**
- **OpenAI**: GPT models, vision capabilities, reasoning models (o1), TTS, DALL-E
- **Anthropic**: Claude models with vision support

**Key Features:**
- Configure separate API keys for each provider in Settings
- Automatic provider switching based on selected model
- Combined model lists when both providers are configured
- Provider-specific validation and error handling
- Seamless switching between GPT and Claude models in conversations

**Setup:**
1. Go to Settings
2. Select your preferred provider (OpenAI or Anthropic)
3. Enter the corresponding API key
4. Optionally configure both providers for access to all models

## Security

**Anthropic API Browser Access:**
This application uses the `anthropic-dangerous-direct-browser-access: true` header for direct browser communication with Anthropic's API. This implementation has been reviewed and approved by internal security teams and is authorized as secure for this specific use case. The header is required for browser-based applications to access Anthropic's API directly.

## APP IMPROVEMENTS:

### Responsive
The app is upgraded to work better on phones (tested on Firefox/Android).

### Quick Settings
Added a Quick Settings menu to make it easy to switch between different models in the same conversation. Also, when using a Reasoning model like GPT-5, it is quick to increase or decrease the reasoning and verbosity settings in a single conversation.

### Support for Reasoning Models like GPT-5
Reasoning, Verbosity, and Summary are all configurable when using GPT-5
Reasoning data from server is displayed in the chat, when available. The reasoning text is _not_ sent back to the AI model as context during conversations

### More Settings Options
"Enter" key behavior can be configured to either "send messages" or "add linefeeds to the chat message."

### Message Management
- A copy button is now present on any message.
- A delete button lets you remove any message, either user or AI messages.
- A delete all below button lets you fork the chat from that point in the conversation.

### Using new OpenAI Responses API
Deprecated ChatResponses API, which enables extensibility and Reasoning window streaming.

### Improved Autoscroll
- The conversation now allows the user to safely scroll up while text is streaming in. Also provided are up/down buttons in Quick Settings to jump between long prompts (especially useful on phones)

### Improved UI
- The UI more closely resembles the official ChatGPT interface, with better icons, avatars, and expanding text areas.

### Improved Incoming Data Handling
- The API is supposed to send JSON packets for the app to render as incoming text, but sometimes it sends multiple JSON packets in a burst. When multiple JSON packets arrive at once, the original code would error out. Now, the app gracefully unpacks and separates the JSON packets so the text continues to flow.

### Safely Stop Incoming Data
- While the AI is talking to the user and data is streaming in, the UI won't allow the user to submit a new message. If the user wants to stop the API from talking, they can click the stop button and safely stop the incoming stream.

### Improved Conversation Titles
- In the background, the app will request the API to generate a title for the conversation after the first message is sent. This hidden prompt is now improved so the title is more meaningful and useful.

### Conversation Title Editing
- The user can now click the edit button on a conversation title and give it a custom title.

## NOTE:

The original version had special buttons for "send without history" and "summarize". I removed these as accounting for these edge cases made modularizing the code quite difficult. I also didn't find myself ever making use of them. To "send without history" you can simply start a new conversation. To "summarize" you can simply ask the AI to summarize the conversation. However, now that the code is robustly modularized, someone could add them back in if desired.

Just like the original version, the conversations are stored in the browser cache, and will be lost if the cache is wiped.

I don't necessarily plan to actively support requests, as I forked the original just to improve it for my own needs. Feel free to let me know about bugs, and I might get to it. Otherwise, feel free to fork this or the original and make further improvements.

*** 

Further reading:
- Original project: [PatrikZeros-ChatGPT-API-UI](https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI)
- Prior fork: [SmoothGPT](https://github.com/agambon/SmoothGPT)
