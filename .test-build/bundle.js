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

// src/services/openaiService.ts
import { get as get4, writable as writable6 } from "svelte/store";

// src/stores/stores.ts
import { writable as writable2 } from "svelte/store";
var settingsVisible = writable2(false);
var helpVisible = writable2(false);
var debugVisible = writable2(false);
var menuVisible = writable2(false);
var storedApiKey = localStorage.getItem("api_key");
var parsedApiKey = storedApiKey !== null ? JSON.parse(storedApiKey) : null;
var apiKey = writable2(parsedApiKey);
apiKey.subscribe((value) => localStorage.setItem("api_key", JSON.stringify(value)));
var storedCombinedTokens = localStorage.getItem("combined_tokens");
var parsedCombinedTokens = storedCombinedTokens !== null ? JSON.parse(storedCombinedTokens) : 0;
var combinedTokens = writable2(parsedCombinedTokens);
combinedTokens.subscribe((value) => localStorage.setItem("combined_tokens", JSON.stringify(value)));
var storedDefaultAssistantRole = localStorage.getItem("default_assistant_role");
var parsedDefaultAssistantRole = storedDefaultAssistantRole !== null ? JSON.parse(storedDefaultAssistantRole) : 0;
var defaultAssistantRole = writable2(parsedDefaultAssistantRole || {
  role: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
  type: "system"
});
defaultAssistantRole.subscribe((value) => localStorage.setItem("default_assistant_role", JSON.stringify(value)));
var chosenConversationId = writable2(0);
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
var conversations = writable2(parsedConversations || [{
  id: generateConversationId(),
  history: [],
  conversationTokens: 0,
  assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
  title: ""
}]);
conversations.subscribe((value) => {
  localStorage.setItem("conversations", JSON.stringify(value));
});
var selectedModel = writable2(localStorage.getItem("selectedModel") || "gpt-3.5-turbo");
var selectedVoice = writable2(localStorage.getItem("selectedVoice") || "alloy");
var selectedMode = writable2(localStorage.getItem("selectedMode") || "GPT");
var selectedSize = writable2(localStorage.getItem("selectedSize") || "1024x1024");
var selectedQuality = writable2(localStorage.getItem("selectedQuality") || "standard");
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
var audioUrls = writable2([]);
var base64Images = writable2([]);
var clearFileInputSignal = writable2(false);
var isStreaming = writable2(false);
var userRequestedStreamClosure = writable2(false);
var streamContext = writable2({ streamText: "", convId: null });
var storedShowTokens = localStorage.getItem("show_tokens");
var parsedShowTokens = storedShowTokens !== null ? JSON.parse(storedShowTokens) : false;
var showTokens = writable2(parsedShowTokens);
showTokens.subscribe((value) => {
  localStorage.setItem("show_tokens", JSON.stringify(value));
});

// src/stores/reasoningSettings.ts
import { writable as writable3 } from "svelte/store";
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
var reasoningEffort = writable3(readLS(KEYS.effort, "medium"));
var verbosity = writable3(readLS(KEYS.verbosity, "medium"));
var summary = writable3(readLS(KEYS.summary, "auto"));
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
if (typeof window !== "undefined") {
  window.startReasoningPanel = startReasoningPanel;
  window.appendReasoningText = appendReasoningText;
  window.setReasoningText = setReasoningText;
  window.completeReasoningPanel = completeReasoningPanel;
}

// src/managers/conversationManager.ts
import { get as get3 } from "svelte/store";

// src/services/openaiService.ts
var isStreaming2 = writable6(false);
var userRequestedStreamClosure2 = writable6(false);
var streamContext2 = writable6({ streamText: "", convId: null });
function supportsReasoning(model) {
  const m = (model || "").toLowerCase();
  return m.includes("gpt-5") || m.includes("o3") || m.includes("o4") || m.includes("reason");
}
function buildResponsesPayload(model, input, stream) {
  const payload = { model, input, store: false, stream };
  if (supportsReasoning(model)) {
    const eff = get4(reasoningEffort) || "medium";
    const verb = get4(verbosity) || "medium";
    const sum = get4(summary) || "auto";
    payload.text = { verbosity: verb };
    payload.reasoning = { effort: eff, summary: sum === "null" ? null : sum };
  }
  return payload;
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
