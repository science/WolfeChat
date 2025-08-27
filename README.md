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

## Credits and History
WolfeChat is a fork and continuation of prior excellent open-source work. Special thanks to patrikzudel for the original [PatrikZeros-ChatGPT-API-UI](https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI), and to the SmoothGPT maintainers for substantial improvements that inspired and informed this project. This repository adapts and extends that lineage for WolfeChat while acknowledging all prior authors.

This project evolves the UI/UX, features, and codebase organization to fit WolfeChat’s goals while remaining grateful to the projects it builds upon.

## APP IMPROVEMENTS:

### Fully Modularized
- I refactored the codebase to be modularized, instead of being contained in one large file. This makes extending the code much easier.

### Export and Import Session
- Because all data is browser-side, wiping cache will wipe the data. The user can now preserve their conversations by exporting their session file.

### API Checking
- The settings pane has a button to conduct an API check and let the user know if the API key is working or not.

### Model Selection
- Instead of it being hardcoded to use a certain model, the settings pane now queries the API for a list of available models, and the user may select one. The UI will display the currently active model in the side pane.

### Support for Text-To-Speech and Vision Models
- In the settings pane you can select a mode: GPT, GPT + Vision, or TTS. The list of available models dynamically filters.

### Text-To-Speech
- With a TTS model selected, the settings pane also allows a user to select a Voice model. Then the user can submit text to be converted into an MP3. The resulting message displays a play button and a download button. Note that these are ephemeral: they are only stored in the active session and will no longer work if you reload the page.

### Image Recognition
- With a Vision model selected, the user can upload one or more images to the API. The UI will dynamically update to expose the image upload button when this mode is selected. The AI will be able to see and tell you about the images.

### Copy Any Message
- A copy button is now present on any message, allowing the user to copy it to their clipboard.



### Mid-conversation Editing
- Just like on the official UI, the user may edit any message. This branches the conversation at that point.

### Improved Autoscroll
- The conversation now allows the user to safely scroll up while text is streaming in. If the user scrolls back down to the bottom, the chat window snaps back into scrolling mode.

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
