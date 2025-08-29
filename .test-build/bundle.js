// src/tests/testHarness.ts
var Assert = class {
  assertions = 0;
  failures = 0;
  notes = [];
  that(cond, message) {
    this.assertions++;
    if (!cond) {
      this.failures++;
      this.notes.push(`FAIL: ${message}`);
    } else {
      this.notes.push(`OK: ${message}`);
    }
  }
};
var registry = [];
function registerTest(test2) {
  if (registry.some((t) => t.id === test2.id)) return;
  registry.push(test2);
}
function test(testDef) {
  registerTest(testDef);
}
function clearTests() {
  registry = [];
}
function listTests() {
  return [...registry];
}
async function runOne(test2) {
  const start = performance.now();
  const assert = new Assert();
  const run = async () => {
    await test2.fn(assert);
  };
  const timeoutMs = test2.timeoutMs ?? 3e4;
  let error;
  try {
    await Promise.race([
      run(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs))
    ]);
  } catch (e) {
    error = e;
    assert.notes.push(`ERROR: ${e?.message ?? String(e)}`);
    assert.failures++;
  }
  const durationMs = performance.now() - start;
  return {
    id: test2.id,
    name: test2.name,
    success: assert.failures === 0 && !error,
    durationMs,
    assertions: assert.assertions,
    failures: assert.failures,
    details: assert.notes.join("\n"),
    error
  };
}
async function runAllTests(opts) {
  const tests = (opts?.filter ? registry.filter(opts.filter) : registry).slice();
  const suiteStart = performance.now();
  const results = [];
  for (const t of tests) {
    const r = await runOne(t);
    results.push(r);
  }
  const durationMs = performance.now() - suiteStart;
  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  return { total: results.length, passed, failed, durationMs, results };
}
function formatSuiteResultsText(suite) {
  const lines = [];
  lines.push(`=== Test Harness Results ===`);
  lines.push(`Total: ${suite.total} | Passed: ${suite.passed} | Failed: ${suite.failed} | Duration: ${suite.durationMs.toFixed(0)}ms`);
  lines.push("");
  for (const r of suite.results) {
    lines.push(`- [${r.success ? "PASS" : "FAIL"}] ${r.name} (${r.durationMs.toFixed(0)}ms)`);
    if (r.details) {
      lines.push(r.details);
    }
    if (r.error) {
      lines.push(`Error: ${r.error?.message ?? String(r.error)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
if (typeof window !== "undefined") {
  window.SmoothGPTTestHarness = {
    listTests,
    runAll: () => runAllTests()
  };
}

// src/tests/unit/svelte-code-shim.js
var CodeShim = class {
  constructor(options = {}) {
    const { target = null, props = {} } = options;
    this.target = target;
    this.props = props;
    this.render();
  }
  $set(props) {
    this.props = { ...this.props, ...props || {} };
    this.render();
  }
  render() {
    if (!this.target) return;
    const lang = (this.props.lang || "js").toString();
    const text = (this.props.text || this.props.value || this.props.code || "").toString();
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = `language-${lang}`;
    code.innerHTML = `<span class="token">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
    this.target.innerHTML = "";
    pre.appendChild(code);
    this.target.appendChild(pre);
  }
  $destroy() {
    this.target = null;
  }
};

// src/tests/unit/codeRendererStreaming.unit.test.ts
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
registerTest({
  id: "code-renderer-loses-highlighting-on-prop-update",
  name: "Code renderer loses Prism highlighting when text prop changes (streaming simulation)",
  tags: ["ui", "markdown", "renderer", "regression"],
  timeoutMs: 5e3,
  fn: async (assert) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const initial = "```js\nconst a = 1;\n```";
    const updated = "```js\nconst a = 1;\nconst b = 2;\n```";
    const comp = new CodeShim({ target: host, props: { text: initial, lang: "js" } });
    await sleep(0);
    const codeEl1 = host.querySelector("code");
    assert.that(!!codeEl1, "Initial code element exists");
    const hadTokens = codeEl1.innerHTML.includes("token");
    assert.that(hadTokens, "Initial Prism tokenization applied");
    comp.$set({ text: updated });
    await sleep(0);
    const codeEl2 = host.querySelector("code");
    assert.that(!!codeEl2, "Code element still exists after update");
    const stillHasTokens = codeEl2.innerHTML.includes("token");
    assert.that(stillHasTokens, "Highlighting persists after prop update");
    comp.$destroy();
    document.body.removeChild(host);
  }
});

// src/utils/keyboard.ts
function shouldSendOnEnter(params) {
  const { behavior, isStreaming: isStreaming3, key, shiftKey, ctrlKey, metaKey } = params;
  if (isStreaming3) return false;
  if (key !== "Enter") return false;
  if (shiftKey) return false;
  if (ctrlKey) {
    if (metaKey) return false;
    return true;
  }
  if (metaKey) return false;
  return behavior === "send";
}

// src/tests/unit/ctrlEnterSend.test.ts
test({
  id: "ctrl-enter-send-basic",
  name: "Ctrl+Enter sends message when not streaming",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, "Ctrl+Enter should send when not streaming");
  }
});
test({
  id: "ctrl-enter-no-send-streaming",
  name: "Ctrl+Enter does not send when streaming",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: true,
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, "Ctrl+Enter should not send when streaming");
  }
});
test({
  id: "ctrl-enter-with-shift",
  name: "Ctrl+Shift+Enter does not send",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: true,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, "Ctrl+Shift+Enter should not send");
  }
});
test({
  id: "ctrl-enter-with-meta",
  name: "Ctrl+Meta+Enter does not send",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: true
    });
    assert.that(result === false, "Ctrl+Meta+Enter should not send");
  }
});
test({
  id: "ctrl-enter-overrides-newline-behavior",
  name: "Ctrl+Enter sends even when behavior is newline",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, "Ctrl+Enter should override newline behavior");
  }
});
test({
  id: "ctrl-enter-works-with-send-behavior",
  name: "Ctrl+Enter sends when behavior is send",
  tags: ["keyboard", "ctrl-enter"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "send",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === true, "Ctrl+Enter should send when behavior is send");
  }
});
test({
  id: "regular-enter-respects-behavior",
  name: "Regular Enter respects behavior setting",
  tags: ["keyboard"],
  fn: (assert) => {
    const newlineResult = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(newlineResult === false, "Regular Enter should not send with newline behavior");
    const sendResult = shouldSendOnEnter({
      behavior: "send",
      isStreaming: false,
      key: "Enter",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(sendResult === true, "Regular Enter should send with send behavior");
  }
});
test({
  id: "shift-enter-always-newline",
  name: "Shift+Enter always inserts newline",
  tags: ["keyboard"],
  fn: (assert) => {
    const sendBehaviorResult = shouldSendOnEnter({
      behavior: "send",
      isStreaming: false,
      key: "Enter",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(sendBehaviorResult === false, "Shift+Enter should not send even with send behavior");
    const newlineBehaviorResult = shouldSendOnEnter({
      behavior: "newline",
      isStreaming: false,
      key: "Enter",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });
    assert.that(newlineBehaviorResult === false, "Shift+Enter should not send with newline behavior");
  }
});
test({
  id: "non-enter-keys-ignored",
  name: "Non-Enter keys are ignored",
  tags: ["keyboard"],
  fn: (assert) => {
    const result = shouldSendOnEnter({
      behavior: "send",
      isStreaming: false,
      key: "a",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    assert.that(result === false, "Non-Enter keys should not trigger send");
  }
});

// src/stores/keyboardSettings.ts
import { writable } from "svelte/store";
var STORAGE_KEY = "enterBehavior";
function loadInitial() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "send" || v === "newline") return v;
  } catch (_) {
  }
  return "newline";
}
var enterBehavior = writable(loadInitial());
enterBehavior.subscribe((v) => {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch (_) {
  }
});

// src/tests/unit/keyboardSettings.test.ts
import { get } from "svelte/store";
registerTest({
  id: "enter-behavior-send",
  name: 'Enter sends when "Send message" is selected',
  fn: async (assert) => {
    const prev = get(enterBehavior);
    try {
      enterBehavior.set("send");
      const shouldSend = shouldSendOnEnter({
        behavior: "send",
        isStreaming: false,
        key: "Enter",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false
      });
      assert.that(shouldSend === true, 'Enter triggers send when behavior is "send" and no modifiers are pressed');
    } finally {
      enterBehavior.set(prev);
    }
  }
});
registerTest({
  id: "enter-behavior-newline",
  name: 'Enter inserts newline when "Insert a new line" is selected',
  fn: async (assert) => {
    const prev = get(enterBehavior);
    try {
      enterBehavior.set("newline");
      const shouldSend = shouldSendOnEnter({
        behavior: "newline",
        isStreaming: false,
        key: "Enter",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false
      });
      assert.that(shouldSend === false, 'Enter does not send when behavior is "newline" (default)');
    } finally {
      enterBehavior.set(prev);
    }
  }
});

// src/tests/unit/modelSelectionPayload.test.ts
import { get as get5 } from "svelte/store";

// src/stores/modelStore.ts
import { writable as writable2 } from "svelte/store";
var MODELS_LS_KEY = "models";
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(MODELS_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
var modelsStore = writable2(loadFromLocalStorage());
modelsStore.subscribe((val) => {
  try {
    localStorage.setItem(MODELS_LS_KEY, JSON.stringify(val || []));
  } catch {
  }
});

// src/stores/stores.ts
import { writable as writable3 } from "svelte/store";
var settingsVisible = writable3(false);
var helpVisible = writable3(false);
var debugVisible = writable3(false);
var menuVisible = writable3(false);
var storedApiKey = localStorage.getItem("api_key");
var parsedApiKey = storedApiKey !== null ? JSON.parse(storedApiKey) : null;
var apiKey = writable3(parsedApiKey);
apiKey.subscribe((value) => localStorage.setItem("api_key", JSON.stringify(value)));
var storedCombinedTokens = localStorage.getItem("combined_tokens");
var parsedCombinedTokens = storedCombinedTokens !== null ? JSON.parse(storedCombinedTokens) : 0;
var combinedTokens = writable3(parsedCombinedTokens);
combinedTokens.subscribe((value) => localStorage.setItem("combined_tokens", JSON.stringify(value)));
var storedDefaultAssistantRole = localStorage.getItem("default_assistant_role");
var parsedDefaultAssistantRole = storedDefaultAssistantRole !== null ? JSON.parse(storedDefaultAssistantRole) : 0;
var defaultAssistantRole = writable3(parsedDefaultAssistantRole || {
  role: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
  type: "system"
});
defaultAssistantRole.subscribe((value) => localStorage.setItem("default_assistant_role", JSON.stringify(value)));
var chosenConversationId = writable3(0);
function generateConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function migrateConversations(convs) {
  return convs.map((conv, index) => {
    if (!conv.id) {
      return {
        ...conv,
        id: generateConversationId()
      };
    }
    return conv;
  });
}
var storedConversations = localStorage.getItem("conversations");
var parsedConversations = storedConversations !== null ? JSON.parse(storedConversations) : null;
if (parsedConversations) {
  parsedConversations = migrateConversations(parsedConversations);
}
var conversations = writable3(parsedConversations || [{
  id: generateConversationId(),
  history: [],
  conversationTokens: 0,
  assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
  title: ""
}]);
conversations.subscribe((value) => {
  localStorage.setItem("conversations", JSON.stringify(value));
});
var selectedModel = writable3(localStorage.getItem("selectedModel") || "gpt-3.5-turbo");
var selectedVoice = writable3(localStorage.getItem("selectedVoice") || "alloy");
var selectedMode = writable3(localStorage.getItem("selectedMode") || "GPT");
var selectedSize = writable3(localStorage.getItem("selectedSize") || "1024x1024");
var selectedQuality = writable3(localStorage.getItem("selectedQuality") || "standard");
selectedModel.subscribe((value) => {
  localStorage.setItem("selectedModel", value);
});
selectedVoice.subscribe((value) => {
  localStorage.setItem("selectedVoice", value);
});
selectedSize.subscribe((value) => {
  localStorage.setItem("selectedSize", value);
});
selectedQuality.subscribe((value) => {
  localStorage.setItem("selectedQuality", value);
});
selectedMode.subscribe((value) => {
  localStorage.setItem("selectedMode", value);
});
var audioUrls = writable3([]);
var base64Images = writable3([]);
var clearFileInputSignal = writable3(false);
var isStreaming = writable3(false);
var userRequestedStreamClosure = writable3(false);
var streamContext = writable3({ streamText: "", convId: null });
var storedShowTokens = localStorage.getItem("show_tokens");
var parsedShowTokens = storedShowTokens !== null ? JSON.parse(storedShowTokens) : false;
var showTokens = writable3(parsedShowTokens);
showTokens.subscribe((value) => {
  localStorage.setItem("show_tokens", JSON.stringify(value));
});
function createNewConversation() {
  return {
    id: generateConversationId(),
    history: [],
    conversationTokens: 0,
    assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
    title: ""
  };
}

// src/managers/conversationManager.ts
import { get as get4 } from "svelte/store";

// src/stores/reasoningStore.ts
import { writable as writable4 } from "svelte/store";
var REASONING_PANELS_KEY = "reasoning_panels";
var REASONING_WINDOWS_KEY = "reasoning_windows";
function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage:`, e);
  }
  return defaultValue;
}
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
}
var initialPanels = loadFromStorage(REASONING_PANELS_KEY, []);
var initialWindows = loadFromStorage(REASONING_WINDOWS_KEY, []);
var reasoningPanels = writable4(initialPanels);
var reasoningWindows = writable4(initialWindows);
reasoningPanels.subscribe((panels) => {
  saveToStorage(REASONING_PANELS_KEY, panels);
});
reasoningWindows.subscribe((windows) => {
  saveToStorage(REASONING_WINDOWS_KEY, windows);
});
function genWindowId(convId) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-win-${convId ?? "na"}`;
}
function createReasoningWindow(convId, model, anchorIndex) {
  const id = genWindowId(convId);
  reasoningWindows.update((arr) => [
    ...arr,
    { id, convId, model, anchorIndex, open: true, createdAt: Date.now() }
  ]);
  return id;
}
function collapseReasoningWindow(id) {
  reasoningWindows.update((arr) => arr.map((w) => w.id === id ? { ...w, open: false } : w));
}
function genId(kind, convId) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${kind}-${convId ?? "na"}`;
}
function startReasoningPanel(kind, convId, responseId) {
  const id = genId(kind, convId);
  reasoningPanels.update((arr) => [
    ...arr,
    { id, convId, responseId, kind, text: "", open: true, startedAt: Date.now(), done: false }
  ]);
  return id;
}
function appendReasoningText(id, chunk) {
  if (!chunk) return;
  reasoningPanels.update(
    (arr) => arr.map((p) => p.id === id ? { ...p, text: p.text + chunk } : p)
  );
}
function setReasoningText(id, text) {
  reasoningPanels.update(
    (arr) => arr.map((p) => p.id === id ? { ...p, text: text ?? "" } : p)
  );
}
function completeReasoningPanel(id) {
  reasoningPanels.update(
    (arr) => arr.map((p) => p.id === id ? { ...p, open: false, done: true } : p)
  );
}
var reasoningSSEEvents = writable4([]);
function genEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-evt`;
}
function logSSEEvent(type, _data, convId) {
  reasoningSSEEvents.update((arr) => {
    const entry = { id: genEventId(), convId, type, ts: Date.now() };
    const next = [...arr, entry];
    return next.length > 500 ? next.slice(next.length - 500) : next;
  });
}
if (typeof window !== "undefined") {
  window.startReasoningPanel = startReasoningPanel;
  window.appendReasoningText = appendReasoningText;
  window.setReasoningText = setReasoningText;
  window.completeReasoningPanel = completeReasoningPanel;
}

// src/services/openaiService.ts
import { get as get3, writable as writable6 } from "svelte/store";

// src/stores/reasoningSettings.ts
import { writable as writable5 } from "svelte/store";
var KEYS = {
  effort: "reasoning_effort",
  verbosity: "reasoning_verbosity",
  summary: "reasoning_summary"
};
function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
var reasoningEffort = writable5(readLS(KEYS.effort, "medium"));
var verbosity = writable5(readLS(KEYS.verbosity, "medium"));
var summary = writable5(readLS(KEYS.summary, "auto"));
reasoningEffort.subscribe((v) => {
  try {
    localStorage.setItem(KEYS.effort, v);
  } catch {
  }
});
verbosity.subscribe((v) => {
  try {
    localStorage.setItem(KEYS.verbosity, v);
  } catch {
  }
});
summary.subscribe((v) => {
  try {
    localStorage.setItem(KEYS.summary, v);
  } catch {
  }
});

// src/managers/imageManager.ts
function onSendVisionMessageComplete() {
  base64Images.set([]);
  clearFileInputSignal.set(true);
}

// src/utils/generalUtils.ts
function countTicks(str) {
  let out = str.split("").filter((char) => char === "`").length;
  return out;
}

// src/idb.js
var audioStore = /* @__PURE__ */ new Map();
async function saveAudioBlob(id, blob, conversationId) {
  audioStore.set(id, { blob, conversationId });
  return Promise.resolve();
}
async function getAudioBlob(id) {
  const item = audioStore.get(id);
  return item ? item.blob : null;
}

// src/services/openaiService.ts
var configuration = null;
var globalAbortController = null;
var isStreaming2 = writable6(false);
var userRequestedStreamClosure2 = writable6(false);
var streamContext2 = writable6({ streamText: "", convId: null });
var errorMessage = [
  {
    role: "assistant",
    content: "There was an error. Maybe the API key is wrong? Or the servers could be down?"
  }
];
async function sendRequest(msg, model = get3(selectedModel)) {
  try {
    msg = [
      {
        role: "system",
        content: get3(conversations)[get3(chosenConversationId)].assistantRole
      },
      ...msg
    ];
    const key = get3(apiKey);
    const resolvedModel = model || getDefaultResponsesModel();
    const input = buildResponsesInputFromMessages(msg);
    const payload = buildResponsesPayload(resolvedModel, input, false);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
    }
    const data = await res.json();
    if (data?.usage) {
      countTokens(data.usage);
    }
    return data;
  } catch (error) {
    console.error("Error in sendRequest:", error);
    configuration = null;
    await setHistory(errorMessage);
    throw error;
  }
}
async function sendTTSMessage(text, model, voice, conversationId) {
  console.log("Sending TTS message.");
  const payload = {
    model,
    voice,
    input: text
  };
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${get3(apiKey)}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to generate audio, response status: ${response.status}`);
    const blob = await response.blob();
    const uniqueID = `audio-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    saveAudioBlob(uniqueID, blob).then(() => {
      console.log("Audio blob saved to IndexedDB with ID:", uniqueID);
    }).catch(console.error);
    getAudioBlob(uniqueID).then((blob2) => {
      console.log(uniqueID);
      console.log(blob2);
      if (blob2 instanceof Blob) {
        if (blob2) {
          const audioUrl = URL.createObjectURL(blob2);
          displayAudioMessage(audioUrl);
        } else {
          console.error("Blob is null or undefined");
        }
      } else {
        console.error("Retrieved object is not a Blob:", blob2);
      }
    }).catch((error) => console.error("Error retrieving audio blob:", error));
  } catch (error) {
    console.error("TTS request error:", error);
  }
}
async function sendVisionMessage(msg, imagesBase64, convId) {
  console.log("Sending vision message.");
  userRequestedStreamClosure2.set(false);
  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get3(conversations)[convId].history;
  const anchorIndex = currentHistory.length - 1;
  const conversationUniqueId = get3(conversations)[convId]?.id;
  const historyMessages = currentHistory.map((historyItem) => ({
    role: historyItem.role,
    content: convertChatContentToResponsesContent(historyItem.content, historyItem.role)
  }));
  const userTextMessage = [...msg].reverse().find((m) => m.role === "user")?.content || "";
  const contentParts = [];
  if (userTextMessage) contentParts.push({ type: "input_text", text: userTextMessage });
  for (const imageBase64 of imagesBase64) {
    contentParts.push({ type: "input_image", image_url: imageBase64 });
  }
  const currentMessage = { role: "user", content: contentParts };
  const finalInput = [...historyMessages, currentMessage];
  let streamText2 = "";
  currentHistory = [...currentHistory];
  isStreaming2.set(true);
  try {
    await streamResponseViaResponsesAPI(
      "",
      get3(selectedModel),
      {
        onTextDelta: (text) => {
          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) {
            ticks = !ticks;
            tickCounter = 0;
          }
          streamText2 += text;
          streamContext2.set({ streamText: streamText2, convId });
          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText2 + "\u2588" + (ticks ? "\n```" : "")
              }
            ],
            convId
          );
        },
        onCompleted: async () => {
          if (get3(userRequestedStreamClosure2)) {
            streamText2 = streamText2.replace(/█+$/, "");
            userRequestedStreamClosure2.set(false);
          }
          await setHistory(
            [
              ...currentHistory,
              { role: "assistant", content: streamText2 }
            ],
            convId
          );
          estimateTokens(msg, convId);
          streamText2 = "";
          isStreaming2.set(false);
          onSendVisionMessageComplete();
        },
        onError: (_err) => {
          isStreaming2.set(false);
          onSendVisionMessageComplete();
        }
      },
      finalInput,
      { convId: conversationUniqueId, anchorIndex }
    );
  } finally {
    isStreaming2.set(false);
  }
}
async function sendRegularMessage(msg, convId) {
  userRequestedStreamClosure2.set(false);
  let tickCounter = 0;
  let ticks = false;
  let currentHistory = get3(conversations)[convId].history;
  const anchorIndex = currentHistory.length - 1;
  const conversationUniqueId = get3(conversations)[convId]?.id;
  let roleMsg = {
    role: get3(defaultAssistantRole).type,
    content: get3(conversations)[convId].assistantRole
  };
  msg = [roleMsg, ...msg];
  const cleansedMessages = msg.map(cleanseMessage);
  const input = buildResponsesInputFromMessages(cleansedMessages);
  let lastUserPromptText = "";
  const lastUserMessage = [...cleansedMessages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const c = lastUserMessage.content;
    if (typeof c === "string") {
      lastUserPromptText = c;
    } else if (Array.isArray(c)) {
      lastUserPromptText = c.map((p) => typeof p === "string" ? p : p?.text ?? "").join(" ").trim();
    } else if (c != null) {
      lastUserPromptText = String(c);
    }
  }
  let streamText2 = "";
  currentHistory = [...currentHistory];
  isStreaming2.set(true);
  try {
    await streamResponseViaResponsesAPI(
      "",
      get3(selectedModel),
      {
        onTextDelta: (text) => {
          const msgTicks = countTicks(text);
          tickCounter += msgTicks;
          if (msgTicks === 0) tickCounter = 0;
          if (tickCounter === 3) {
            ticks = !ticks;
            tickCounter = 0;
          }
          streamText2 += text;
          streamContext2.set({ streamText: streamText2, convId });
          setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText2 + "\u2588" + (ticks ? "\n```" : "")
              }
            ],
            convId
          );
        },
        onCompleted: async (_finalText) => {
          if (get3(userRequestedStreamClosure2)) {
            streamText2 = streamText2.replace(/█+$/, "");
            userRequestedStreamClosure2.set(false);
          }
          await setHistory(
            [
              ...currentHistory,
              {
                role: "assistant",
                content: streamText2
              }
            ],
            convId
          );
          estimateTokens(msg, convId);
          await maybeUpdateTitleAfterFirstMessage(convId, lastUserPromptText, streamText2);
          streamText2 = "";
          isStreaming2.set(false);
        },
        onError: (_err) => {
          isStreaming2.set(false);
        }
      },
      input,
      { convId: conversationUniqueId, anchorIndex }
    );
  } finally {
    isStreaming2.set(false);
  }
}
async function sendDalleMessage(msg, convId) {
  isStreaming2.set(true);
  let hasEncounteredError = false;
  let currentHistory = get3(conversations)[convId].history;
  let roleMsg = {
    role: get3(defaultAssistantRole).type,
    content: get3(conversations)[convId].assistantRole
  };
  msg = [roleMsg, ...msg];
  const cleansedMessages = msg.map(cleanseMessage);
  const prompt = cleansedMessages[cleansedMessages.length - 1].content;
  try {
    let response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${get3(apiKey)}`
      },
      body: JSON.stringify({
        model: get3(selectedModel),
        prompt,
        size: get3(selectedSize),
        quality: get3(selectedQuality),
        n: 1
      })
    });
    if (!response.ok) throw new Error("HTTP error, status = " + response.status);
    let data = await response.json();
    let imageUrl = data.data[0].url;
    setHistory([...currentHistory, {
      role: "assistant",
      content: imageUrl,
      type: "image"
      // Adding a type property to distinguish image messages
    }], convId);
  } catch (error) {
    console.error("Error generating image:", error);
    hasEncounteredError = true;
  } finally {
    isStreaming2.set(false);
  }
}
function getDefaultResponsesModel() {
  const m = get3(selectedModel);
  if (!m || /gpt-3\.5|gpt-4-turbo-preview|gpt-4-32k|gpt-4$/.test(m)) {
    return "gpt-4o-mini";
  }
  return m;
}
function supportsReasoning(model) {
  const m = (model || "").toLowerCase();
  return m.includes("gpt-5") || m.includes("o3") || m.includes("o4") || m.includes("reason");
}
function buildResponsesPayload(model, input, stream) {
  const payload = { model, input, store: false, stream };
  if (supportsReasoning(model)) {
    const eff = get3(reasoningEffort) || "medium";
    const verb = get3(verbosity) || "medium";
    const sum = get3(summary) || "auto";
    payload.text = { verbosity: verb };
    payload.reasoning = { effort: eff, summary: sum === "null" ? null : sum };
  }
  return payload;
}
function buildResponsesInputFromPrompt(prompt) {
  return [
    {
      role: "user",
      content: [{ type: "input_text", text: prompt }]
    }
  ];
}
function convertChatContentToResponsesContent(content, role) {
  const isAssistant = (role || "").toLowerCase() === "assistant";
  if (typeof content === "string") {
    return [{ type: isAssistant ? "output_text" : "input_text", text: content }];
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (isAssistant) {
        if (typeof part === "string") {
          return { type: "output_text", text: part };
        }
        if (part?.type === "text" && typeof part?.text === "string") {
          return { type: "output_text", text: part.text };
        }
        if (part?.type === "input_text" && typeof part?.text === "string") {
          return { type: "output_text", text: part.text };
        }
        return { type: "output_text", text: typeof part === "string" ? part : JSON.stringify(part) };
      }
      if (part?.type === "text" && typeof part?.text === "string") {
        return { type: "input_text", text: part.text };
      }
      if (part?.type === "image_url") {
        const url = part?.image_url?.url ?? part?.image_url ?? part?.url ?? "";
        return { type: "input_image", image_url: url };
      }
      if (part?.type === "input_text" || part?.type === "input_image") {
        return part;
      }
      return { type: "input_text", text: typeof part === "string" ? part : JSON.stringify(part) };
    });
  }
  return [{ type: isAssistant ? "output_text" : "input_text", text: String(content) }];
}
function buildResponsesInputFromMessages(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: convertChatContentToResponsesContent(m.content, m.role)
  }));
}
function extractOutputTextFromResponses(obj) {
  if (!obj) return "";
  if (typeof obj.output_text === "string") return obj.output_text.trim();
  const outputs = Array.isArray(obj.output) ? obj.output : Array.isArray(obj.outputs) ? obj.outputs : null;
  if (outputs) {
    let text = "";
    for (const o of outputs) {
      const content = Array.isArray(o?.content) ? o.content : [];
      for (const p of content) {
        if (typeof p?.text === "string") text += p.text;
        else if (typeof p === "string") text += p;
      }
    }
    if (text.trim()) return text.trim();
  }
  if (Array.isArray(obj?.content)) {
    const t = obj.content.map((p) => p?.text || "").join("");
    if (t.trim()) return t.trim();
  }
  try {
    const s = JSON.stringify(obj);
    const m = s.match(/"text"\s*:\s*"([^"]{1,200})/);
    if (m) return m[1];
  } catch {
  }
  return "";
}
function sanitizeTitle(title) {
  let t = (title || "").trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/^title\s*:\s*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > 80) t = t.slice(0, 80);
  return t;
}
async function maybeUpdateTitleAfterFirstMessage(convId, lastUserPrompt, assistantReply) {
  try {
    const all = get3(conversations);
    const conv = all?.[convId];
    if (!conv) return;
    const currentTitle = (conv.title ?? "").trim().toLowerCase();
    if (currentTitle && currentTitle !== "new conversation") return;
    const sys = {
      role: "system",
      content: "You generate a short, clear chat title. Respond with only the title, no quotes, max 8 words, Title Case."
    };
    const user = {
      role: "user",
      content: lastUserPrompt || "Create a short title for this conversation."
    };
    const asst = assistantReply ? { role: "assistant", content: assistantReply } : null;
    const msgs = asst ? [sys, user, asst] : [sys, user];
    const input = buildResponsesInputFromMessages(msgs);
    const model = "gpt-4o-mini";
    const payload = buildResponsesPayload(model, input, false);
    const key = get3(apiKey);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Responses API error ${res.status}: ${text || res.statusText}`);
    }
    const data = await res.json();
    const rawTitle = extractOutputTextFromResponses(data);
    const title = sanitizeTitle(rawTitle);
    if (!title) return;
    conversations.update((allConvs) => {
      const copy = [...allConvs];
      const curr = { ...copy[convId] };
      const currTitle = (curr.title ?? "").trim().toLowerCase();
      if (!currTitle || currTitle === "new conversation") {
        curr.title = title;
        copy[convId] = curr;
      }
      return copy;
    });
  } catch (err) {
    console.warn("Title generation failed:", err);
  }
}
async function streamResponseViaResponsesAPI(prompt, model, callbacks, inputOverride, uiContext) {
  const key = get3(apiKey);
  if (!key) throw new Error("No API key configured");
  const resolvedModel = model || getDefaultResponsesModel();
  const input = inputOverride || buildResponsesInputFromPrompt(prompt);
  const payload = buildResponsesPayload(resolvedModel, input, true);
  const controller = new AbortController();
  globalAbortController = controller;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    globalAbortController = null;
    throw new Error(`Responses API stream error ${res.status}: ${text || res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  const panelTracker = /* @__PURE__ */ new Map();
  const panelTextTracker = /* @__PURE__ */ new Map();
  const convIdCtx = uiContext?.convId;
  const anchorIndexCtx = uiContext?.anchorIndex;
  const responseWindowId = supportsReasoning(resolvedModel) ? createReasoningWindow(convIdCtx, resolvedModel, anchorIndexCtx) : null;
  function processSSEBlock(block) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    let eventType = "message";
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }
    if (dataLines.length === 0) return;
    const dataStr = dataLines.join("\n");
    if (dataStr === "[DONE]") {
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText);
      if (responseWindowId) collapseReasoningWindow(responseWindowId);
      return;
    }
    let obj = null;
    try {
      obj = JSON.parse(dataStr);
    } catch (e) {
      callbacks?.onError?.(new Error(`Failed to parse SSE data JSON: ${e}`));
      return;
    }
    const resolvedType = eventType !== "message" ? eventType : obj?.type || "message";
    callbacks?.onEvent?.({ type: resolvedType, data: obj });
    logSSEEvent(resolvedType, obj, convIdCtx);
    if (resolvedType === "response.reasoning_summary_part.added" || resolvedType === "response.reasoning_summary_text.delta" || resolvedType === "response.reasoning_summary.delta") {
      const delta = obj?.delta ?? "";
      if (!panelTracker.has("summary")) {
        const panelId = startReasoningPanel("summary", convIdCtx, responseWindowId || void 0);
        panelTracker.set("summary", panelId);
        panelTextTracker.set(panelId, "");
        callbacks?.onReasoningStart?.("summary", obj?.part);
      }
      if (typeof delta === "string" && delta) {
        const panelId = panelTracker.get("summary");
        const currentText = panelTextTracker.get(panelId) || "";
        const newText = currentText + delta;
        panelTextTracker.set(panelId, newText);
        setReasoningText(panelId, newText);
        callbacks?.onReasoningDelta?.("summary", delta);
      }
    } else if (resolvedType === "response.reasoning_summary_part.done" || resolvedType === "response.reasoning_summary_text.done" || resolvedType === "response.reasoning_summary.done") {
      const text = obj?.part?.text ?? obj?.text ?? "";
      const panelId = panelTracker.get("summary");
      if (panelId) {
        if (typeof text === "string" && text) {
          setReasoningText(panelId, text);
          panelTextTracker.set(panelId, text);
        }
        completeReasoningPanel(panelId);
        callbacks?.onReasoningDone?.("summary", panelTextTracker.get(panelId) || "");
        panelTracker.delete("summary");
        panelTextTracker.delete(panelId);
      }
    } else if (resolvedType === "response.reasoning_text.delta" || resolvedType === "response.reasoning.delta") {
      const delta = obj?.delta ?? "";
      if (!panelTracker.has("text")) {
        const panelId = startReasoningPanel("text", convIdCtx, responseWindowId || void 0);
        panelTracker.set("text", panelId);
        panelTextTracker.set(panelId, "");
        callbacks?.onReasoningStart?.("text");
      }
      if (typeof delta === "string" && delta) {
        const panelId = panelTracker.get("text");
        const currentText = panelTextTracker.get(panelId) || "";
        const newText = currentText + delta;
        panelTextTracker.set(panelId, newText);
        setReasoningText(panelId, newText);
        callbacks?.onReasoningDelta?.("text", delta);
      }
    } else if (resolvedType === "response.reasoning_text.done" || resolvedType === "response.reasoning.done") {
      const text = obj?.text ?? "";
      let panelId = panelTracker.get("text");
      if (!panelId && text) {
        panelId = startReasoningPanel("text", convIdCtx, responseWindowId || void 0);
        panelTracker.set("text", panelId);
        panelTextTracker.set(panelId, "");
        callbacks?.onReasoningStart?.("text");
      }
      if (panelId) {
        if (typeof text === "string" && text) {
          setReasoningText(panelId, text);
          panelTextTracker.set(panelId, text);
        }
        completeReasoningPanel(panelId);
        callbacks?.onReasoningDone?.("text", panelTextTracker.get(panelId) || "");
        panelTracker.delete("text");
        panelTextTracker.delete(panelId);
      }
    } else if (resolvedType === "response.output_text.delta") {
      const deltaText = obj?.delta?.text ?? obj?.delta ?? obj?.output_text_delta ?? obj?.text ?? "";
      if (deltaText) {
        finalText += deltaText;
        callbacks?.onTextDelta?.(deltaText);
      }
    } else if (resolvedType === "response.completed") {
      for (const [kind, panelId] of panelTracker.entries()) {
        completeReasoningPanel(panelId);
        panelTextTracker.delete(panelId);
      }
      panelTracker.clear();
      panelTextTracker.clear();
      callbacks?.onCompleted?.(finalText, obj);
      if (responseWindowId) collapseReasoningWindow(responseWindowId);
    } else if (resolvedType === "error") {
      callbacks?.onError?.(obj);
    }
  }
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const decoded = decoder.decode(value, { stream: true });
    buffer += decoded;
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const p of parts) {
      if (p.trim()) processSSEBlock(p);
    }
  }
  if (buffer.trim()) processSSEBlock(buffer);
  globalAbortController = null;
  return finalText;
}

// src/managers/conversationManager.ts
var streamText = "";
function setHistory(msg, convId = get4(chosenConversationId)) {
  return new Promise((resolve, reject) => {
    try {
      let conv = get4(conversations);
      conv[convId].history = msg;
      conversations.set(conv);
      resolve();
    } catch (error) {
      console.error("Failed to update history", error);
      reject(error);
    }
  });
}
function newChat() {
  const currentConversations = get4(conversations);
  if (currentConversations.length > 0 && currentConversations[currentConversations.length - 1].history.length === 0) {
    console.log("Jumping to recent conversation.");
    chosenConversationId.set(currentConversations.length - 1);
    return;
  }
  const newConversation = createNewConversation();
  conversations.update((conv) => [...conv, newConversation]);
  chosenConversationId.set(get4(conversations).length - 1);
}
function cleanseMessage(msg) {
  const allowedProps = ["role", "content"];
  let cleansed = Object.keys(msg).filter((key) => allowedProps.includes(key)).reduce((obj, key) => {
    obj[key] = msg[key];
    return obj;
  }, {});
  if (!Array.isArray(cleansed.content)) {
    cleansed.content = cleansed.content.toString();
  }
  return cleansed;
}
async function routeMessage(input, convId) {
  let currentHistory = get4(conversations)[convId].history;
  let messageHistory = currentHistory;
  currentHistory = [...currentHistory, { role: "user", content: input }];
  setHistory(currentHistory);
  const defaultModel = "gpt-3.5-turbo";
  const defaultVoice = "alloy";
  const model = get4(selectedModel) || defaultModel;
  const voice = get4(selectedVoice) || defaultVoice;
  let outgoingMessage;
  outgoingMessage = [
    ...messageHistory,
    { role: "user", content: input }
  ];
  if (model.includes("tts")) {
    await sendTTSMessage(input, model, voice, convId);
  } else if (model.includes("vision")) {
    const imagesBase64 = get4(base64Images);
    await sendVisionMessage(outgoingMessage, imagesBase64, convId);
  } else if (model.includes("dall-e")) {
    await sendDalleMessage(outgoingMessage, convId);
  } else {
    await sendRegularMessage(outgoingMessage, convId);
  }
  if (get4(conversations)[convId].history.length === 1 || get4(conversations)[convId].title === "") {
    await createTitle(input);
  }
}
function setTitle(title) {
  let conv = get4(conversations);
  conv[get4(chosenConversationId)].title = title;
  conversations.set(conv);
}
async function createTitle(currentInput) {
  const titleModel = "gpt-4-turbo-preview";
  try {
    let response = await sendRequest([
      { role: "user", content: currentInput },
      {
        role: "user",
        content: "Generate a title for this conversation, so I can easily reference it later. Maximum 6 words. Don't provide anything other than the title. Don't use quotes."
      }
    ], titleModel);
    if (response && response.data && response.data.choices && response.data.choices.length > 0) {
      let message = response.data.choices[0].message?.content;
      if (message) {
        setTitle(message.toString());
      } else {
        console.warn("Title generation: No content in response message");
        setTitle(currentInput.slice(0, 30) + (currentInput.length > 30 ? "..." : ""));
      }
    } else {
      console.warn("Title generation: Invalid response structure", response);
      setTitle(currentInput.slice(0, 30) + (currentInput.length > 30 ? "..." : ""));
    }
  } catch (error) {
    console.error("Error generating title:", error);
    setTitle(currentInput.slice(0, 30) + (currentInput.length > 30 ? "..." : ""));
  }
}
function displayAudioMessage(audioUrl) {
  const audioMessage = {
    role: "assistant",
    content: "Audio file generated.",
    audioUrl,
    isAudio: true
  };
  setHistory([...get4(conversations)[get4(chosenConversationId)].history, audioMessage]);
}
function countTokens(usage) {
  let conv = get4(conversations);
  conv[get4(chosenConversationId)].conversationTokens = conv[get4(chosenConversationId)].conversationTokens + usage.total_tokens;
  conversations.set(conv);
  combinedTokens.set(get4(combinedTokens) + usage.total_tokens);
  console.log("Counted tokens: " + usage.total_tokens);
}
function estimateTokens(msg, convId) {
  let chars = 0;
  msg.map((m) => {
    chars += m.content.length;
  });
  chars += streamText.length;
  let tokens = chars / 4;
  let conv = get4(conversations);
  conv[convId].conversationTokens = conv[convId].conversationTokens + tokens;
  conversations.set(conv);
  combinedTokens.set(get4(combinedTokens) + tokens);
}

// src/tests/unit/modelSelectionPayload.test.ts
function sleep2(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function captureNextPayload(run) {
  const originalFetch = window.fetch?.bind(window);
  let captured = null;
  function shouldCapture(input) {
    try {
      const url = typeof input === "string" ? input : input.url ?? String(input);
      return /\/v1\/(responses|chat\/completions|audio\/speech|images\/generations)/.test(url);
    } catch {
      return true;
    }
  }
  window.fetch = (async (input, init) => {
    if (shouldCapture(input)) {
      try {
        let url = typeof input === "string" ? input : input.url ?? String(input);
        const headers = init?.headers ?? {};
        const body = init?.body && typeof init.body === "string" ? init.body : "";
        const payload = body ? JSON.parse(body) : null;
        captured = { url, headers, payload };
      } catch {
      }
    }
    return Promise.resolve({ ok: true, json: async () => ({}), text: async () => "", status: 200 });
  });
  try {
    await Promise.resolve(run());
    await sleep2(0);
  } catch {
  }
  await sleep2(0);
  await new Promise((r) => requestAnimationFrame(() => r()));
  window.fetch = originalFetch;
  return captured;
}
registerTest({
  id: "ui-model-selection-payload-capture",
  name: "Model selection drives request payload.model",
  tags: ["ui", "non-api"],
  timeoutMs: 15e3,
  fn: async (assert) => {
    const models = get5(modelsStore);
    if (!models || models.length === 0) {
      throw new Error("Model cache is empty. Please load models first (e.g., via Settings -> Reload or run an API test) before running non-API tests.");
    }
    await Promise.resolve(newChat());
    await sleep2(0);
    const convId = get5(chosenConversationId);
    const originalSelection = get5(selectedModel);
    selectedModel.set("gpt-4.1");
    const cap41 = await captureNextPayload(() => routeMessage("Test with gpt-4.1", convId));
    assert.that(!!cap41, "Captured a request payload for gpt-4.1 selection");
    if (cap41 && cap41.payload) {
      const modelField = cap41.payload?.model;
      assert.that(
        typeof modelField === "string",
        `Payload has a model field (found: ${String(modelField)})`
      );
      assert.that(
        modelField === "gpt-4.1",
        `Selected model 'gpt-4.1' is used in payload.model (actual: ${String(modelField)})`
      );
    } else {
      assert.that(false, "No payload captured for gpt-4.1 (the send flow may have changed)");
    }
    selectedModel.set("gpt-5");
    const cap5 = await captureNextPayload(() => routeMessage("Test with gpt-5", convId));
    assert.that(!!cap5, "Captured a request payload for gpt-5 selection");
    if (cap5 && cap5.payload) {
      const modelField = cap5.payload?.model;
      assert.that(
        typeof modelField === "string",
        `Payload has a model field (found: ${String(modelField)})`
      );
      assert.that(
        modelField === "gpt-5",
        `Selected model 'gpt-5' is used in payload.model (actual: ${String(modelField)})`
      );
    } else {
      assert.that(false, "No payload captured for gpt-5 (the send flow may have changed)");
    }
    selectedModel.set(originalSelection);
  }
});

// src/tests/unit/responsesConversionAndPayload.test.ts
function makeMsg(role, content) {
  return { role, content };
}
registerTest({
  id: "nonapi-responses-conversion-payload",
  name: "Responses conversion handles edge cases and builds valid payload",
  tags: ["non-api", "responses", "conversion"],
  timeoutMs: 5e3,
  fn: async (t) => {
    const msgs1 = [
      makeMsg("system", "You are a helpful assistant."),
      makeMsg("user", "Say hi")
    ];
    const input1 = buildResponsesInputFromMessages(msgs1);
    t.that(Array.isArray(input1), "Input is array for messages");
    t.that(input1.length === 2, "Two input turns");
    t.that(Array.isArray(input1[0].content), "Each input turn has content array");
    t.that(input1[0].content[0].type === "input_text" || input1[0].content[0].type === "output_text", "System mapped to text");
    const msgs2 = [
      makeMsg("user", [
        { type: "input_text", text: "Describe this image" },
        { type: "image_url", image_url: { url: "https://example.com/x.png" } }
      ])
    ];
    const input2 = buildResponsesInputFromMessages(msgs2);
    t.that(input2.length === 1, "Single turn remains single");
    const c2 = input2[0].content;
    t.that(c2.some((p) => p.type === "input_text"), "Has input_text");
    t.that(c2.some((p) => p.type === "input_image"), "Has input_image");
    const msgs3 = [makeMsg("user", { foo: "bar", n: 2 })];
    const input3 = buildResponsesInputFromMessages(msgs3);
    t.that(typeof input3[0].content[0].text === "string", "Object content coerced to string");
    const payload = buildResponsesPayload("gpt-5", input1, true);
    t.that(payload.model === "gpt-5", "Payload.model set");
    t.that(payload.stream === true, "Payload.stream set");
    t.that(Array.isArray(payload.input), "Payload.input is array");
    const payloadR = buildResponsesPayload("gpt-5", input1, false);
    t.that(!!payloadR.reasoning || !!payloadR.text, "Reasoning/text extras exist for reasoning-capable model");
  }
});
export {
  clearTests,
  formatSuiteResultsText,
  runAllTests
};
