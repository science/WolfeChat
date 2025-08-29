# WolfeChat - a ChatGPT API Enhanced UI

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

The project includes a comprehensive test suite with automatic test discovery based on folder structure.

### Running Tests

```bash
# Run unit tests (default)
npm run test

# Run live/API tests (requires OpenAI API key)
npm run test:live

# Run specific test suite
node run-tests.mjs --suite unit          # Unit tests only
node run-tests.mjs --suite browser-nonlive  # Browser tests (future)
node run-tests.mjs --suite live          # API tests only
node run-tests.mjs --suite all           # All tests

# Filter tests
node run-tests.mjs --tag keyboard        # Run tests tagged 'keyboard'
node run-tests.mjs --name "scroll"       # Run tests containing 'scroll' in name
```

### Test Organization

Tests are automatically discovered based on their location:
- `src/tests/unit/` - Unit tests that run in Node.js with JSDOM
- `src/tests/browser-nonlive/` - Tests requiring a real browser (future implementation)
- `src/tests/live/` - Tests that require external APIs (OpenAI, etc.)

Simply add a `*.test.ts` file to the appropriate folder and it will be automatically included in the test suite.

See [CLI_TESTING.md](CLI_TESTING.md) for detailed testing documentation.

## Credits and History
WolfeChat is a fork and continuation of prior excellent open-source work. Special thanks to patrikzudel for the original [PatrikZeros-ChatGPT-API-UI](https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI), and to agambon for the improvements in [SmoothGPT](https://github.com/agambon/SmoothGPT) that led to this project. This repository adapts and extends that lineage for WolfeChat while acknowledging all prior authors and licensing.

This project evolves the UI/UX, features, and codebase organization to fit WolfeChat’s goals while remaining grateful to the projects it builds upon.

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
