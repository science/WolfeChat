var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/tests/testModel.ts
var testModel_exports = {};
__export(testModel_exports, {
  NON_REASONING_MODEL: () => NON_REASONING_MODEL,
  REASONING_MODEL: () => REASONING_MODEL,
  getNonReasoningModel: () => getNonReasoningModel,
  getReasoningModel: () => getReasoningModel,
  getTestModel: () => getTestModel
});
function getReasoningModel() {
  return REASONING_MODEL;
}
function getNonReasoningModel() {
  return NON_REASONING_MODEL;
}
function getTestModel(opts) {
  if (opts?.forceNonReasoning === true) return NON_REASONING_MODEL;
  if (opts?.reasoning === false) return NON_REASONING_MODEL;
  return REASONING_MODEL;
}
var REASONING_MODEL, NON_REASONING_MODEL;
var init_testModel = __esm({
  "src/tests/testModel.ts"() {
    REASONING_MODEL = "gpt-5-nano";
    NON_REASONING_MODEL = "gpt-3.5-turbo";
  }
});

// src/stores/stores.ts
var stores_exports = {};
__export(stores_exports, {
  apiKey: () => apiKey,
  audioUrls: () => audioUrls,
  base64Images: () => base64Images,
  chosenConversationId: () => chosenConversationId,
  clearFileInputSignal: () => clearFileInputSignal,
  combinedTokens: () => combinedTokens,
  conversations: () => conversations,
  createNewConversation: () => createNewConversation,
  debugVisible: () => debugVisible,
  defaultAssistantRole: () => defaultAssistantRole,
  helpVisible: () => helpVisible,
  isStreaming: () => isStreaming,
  menuVisible: () => menuVisible,
  selectedMode: () => selectedMode,
  selectedModel: () => selectedModel,
  selectedQuality: () => selectedQuality,
  selectedSize: () => selectedSize,
  selectedVoice: () => selectedVoice,
  settingsVisible: () => settingsVisible,
  showTokens: () => showTokens,
  streamContext: () => streamContext,
  userRequestedStreamClosure: () => userRequestedStreamClosure
});
import { writable } from "svelte/store";
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
function createNewConversation() {
  return {
    id: generateConversationId(),
    history: [],
    conversationTokens: 0,
    assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
    title: ""
  };
}
var settingsVisible, helpVisible, debugVisible, menuVisible, storedApiKey, parsedApiKey, envApiKey, initialApiKey, apiKey, storedCombinedTokens, parsedCombinedTokens, combinedTokens, storedDefaultAssistantRole, parsedDefaultAssistantRole, defaultAssistantRole, chosenConversationId, storedConversations, parsedConversations, conversations, selectedModel, selectedVoice, selectedMode, selectedSize, selectedQuality, audioUrls, base64Images, clearFileInputSignal, isStreaming, userRequestedStreamClosure, streamContext, storedShowTokens, parsedShowTokens, showTokens;
var init_stores = __esm({
  "src/stores/stores.ts"() {
    settingsVisible = writable(false);
    helpVisible = writable(false);
    debugVisible = writable(false);
    menuVisible = writable(false);
    storedApiKey = localStorage.getItem("api_key");
    parsedApiKey = storedApiKey !== null ? JSON.parse(storedApiKey) : null;
    envApiKey = null;
    try {
      if (typeof process !== "undefined" && process?.env?.OPENAI_API_KEY) {
        envApiKey = String(process.env.OPENAI_API_KEY);
      }
      if (!envApiKey && typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENAI_API_KEY) {
        envApiKey = String(import.meta.env.VITE_OPENAI_API_KEY);
      }
    } catch {
    }
    initialApiKey = parsedApiKey ?? envApiKey ?? null;
    apiKey = writable(initialApiKey);
    apiKey.subscribe((value) => localStorage.setItem("api_key", JSON.stringify(value)));
    storedCombinedTokens = localStorage.getItem("combined_tokens");
    parsedCombinedTokens = storedCombinedTokens !== null ? JSON.parse(storedCombinedTokens) : 0;
    combinedTokens = writable(parsedCombinedTokens);
    combinedTokens.subscribe((value) => localStorage.setItem("combined_tokens", JSON.stringify(value)));
    storedDefaultAssistantRole = localStorage.getItem("default_assistant_role");
    parsedDefaultAssistantRole = storedDefaultAssistantRole !== null ? JSON.parse(storedDefaultAssistantRole) : 0;
    defaultAssistantRole = writable(parsedDefaultAssistantRole || {
      role: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
      type: "system"
    });
    defaultAssistantRole.subscribe((value) => localStorage.setItem("default_assistant_role", JSON.stringify(value)));
    chosenConversationId = writable(0);
    storedConversations = localStorage.getItem("conversations");
    parsedConversations = storedConversations !== null ? JSON.parse(storedConversations) : null;
    if (parsedConversations) {
      parsedConversations = migrateConversations(parsedConversations);
    }
    conversations = writable(parsedConversations || [{
      id: generateConversationId(),
      history: [],
      conversationTokens: 0,
      assistantRole: "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.",
      title: ""
    }]);
    conversations.subscribe((value) => {
      localStorage.setItem("conversations", JSON.stringify(value));
    });
    selectedModel = writable(localStorage.getItem("selectedModel") || "gpt-3.5-turbo");
    selectedVoice = writable(localStorage.getItem("selectedVoice") || "alloy");
    selectedMode = writable(localStorage.getItem("selectedMode") || "GPT");
    selectedSize = writable(localStorage.getItem("selectedSize") || "1024x1024");
    selectedQuality = writable(localStorage.getItem("selectedQuality") || "standard");
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
    audioUrls = writable([]);
    base64Images = writable([]);
    clearFileInputSignal = writable(false);
    isStreaming = writable(false);
    userRequestedStreamClosure = writable(false);
    streamContext = writable({ streamText: "", convId: null });
    storedShowTokens = localStorage.getItem("show_tokens");
    parsedShowTokens = storedShowTokens !== null ? JSON.parse(storedShowTokens) : false;
    showTokens = writable(parsedShowTokens);
    showTokens.subscribe((value) => {
      localStorage.setItem("show_tokens", JSON.stringify(value));
    });
  }
});

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
function clearTestEnvironment() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("selectedModel");
    localStorage.removeItem("conversations");
    localStorage.removeItem("default_assistant_role");
    localStorage.removeItem("selectedMode");
    localStorage.removeItem("selectedVoice");
    localStorage.removeItem("selectedSize");
    localStorage.removeItem("selectedQuality");
    localStorage.removeItem("combined_tokens");
    localStorage.removeItem("show_tokens");
    localStorage.removeItem("api_key");
  }
}
async function runAllTests(opts) {
  clearTestEnvironment();
  try {
    const { getReasoningModel: getReasoningModel2 } = await Promise.resolve().then(() => (init_testModel(), testModel_exports));
    const { selectedModel: selectedModel2 } = await Promise.resolve().then(() => (init_stores(), stores_exports));
    const testModel = getReasoningModel2();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("selectedModel", testModel);
    }
    selectedModel2.set(testModel);
  } catch (e) {
  }
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

// src/tests/live/responsesNonStreamingLive.test.ts
init_stores();
import { get as get5 } from "svelte/store";

// src/utils/debugUtils.ts
init_stores();
import { get as get4 } from "svelte/store";

// src/services/openaiService.ts
init_stores();
import { get as get3, writable as writable5 } from "svelte/store";

// src/stores/reasoningSettings.ts
import { writable as writable2 } from "svelte/store";
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
var reasoningEffort = writable2(readLS(KEYS.effort, "medium"));
var verbosity = writable2(readLS(KEYS.verbosity, "medium"));
var summary = writable2(readLS(KEYS.summary, "auto"));
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
import { writable as writable3 } from "svelte/store";
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
var reasoningPanels = writable3(initialPanels);
var reasoningWindows = writable3(initialWindows);
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
var reasoningSSEEvents = writable3([]);
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

// src/managers/conversationManager.ts
init_stores();
init_stores();
init_stores();
import { get as get2 } from "svelte/store";
var streamText = "";
function setHistory(msg, convId = get2(chosenConversationId)) {
  return new Promise((resolve, reject) => {
    try {
      let conv = get2(conversations);
      conv[convId].history = msg;
      conversations.set(conv);
      resolve();
    } catch (error) {
      console.error("Failed to update history", error);
      reject(error);
    }
  });
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
function estimateTokens(msg, convId) {
  let chars = 0;
  msg.map((m) => {
    chars += m.content.length;
  });
  chars += streamText.length;
  let tokens = chars / 4;
  let conv = get2(conversations);
  conv[convId].conversationTokens = conv[convId].conversationTokens + tokens;
  conversations.set(conv);
  combinedTokens.set(get2(combinedTokens) + tokens);
}

// src/managers/imageManager.ts
init_stores();
init_stores();

// src/utils/generalUtils.ts
function countTicks(str) {
  let out = str.split("").filter((char) => char === "`").length;
  return out;
}

// src/services/openaiService.ts
var globalAbortController = null;
var isStreaming2 = writable5(false);
var userRequestedStreamClosure2 = writable5(false);
var streamContext2 = writable5({ streamText: "", convId: null });
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
function getDefaultResponsesModel() {
  const m = get3(selectedModel);
  if (!m || /gpt-3\.5|gpt-4-turbo-preview|gpt-4-32k|gpt-4$|o1-mini/.test(m)) {
    return "gpt-5-nano";
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
async function createResponseViaResponsesAPI(prompt, model) {
  const key = get3(apiKey);
  if (!key) throw new Error("No API key configured");
  const resolvedModel = model || getDefaultResponsesModel();
  const input = buildResponsesInputFromPrompt(prompt);
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
  return res.json();
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

// src/utils/debugUtils.ts
init_testModel();
async function testResponsesAPI(prompt = "Say 'double bubble bath' five times fast.", modelOverride) {
  const key = get4(apiKey);
  const model = modelOverride || get4(selectedModel);
  console.log("=== Responses API (non-streaming) Test ===");
  console.log("API Key configured:", !!key);
  console.log("Selected model:", model);
  if (!key) {
    console.error("No API key configured");
    return null;
  }
  try {
    const data = await createResponseViaResponsesAPI(prompt, model);
    const outputText = data?.output_text ?? data?.output?.[0]?.content?.map((c) => c?.text).join("") ?? data?.response?.output_text ?? JSON.stringify(data);
    console.log("Responses API result:", data);
    console.log("Responses API output_text:", outputText);
    return { success: true, raw: data, outputText, model };
  } catch (e) {
    console.error("Responses API error:", e);
    return { success: false, error: e };
  }
}
async function testResponsesStreamingAPI(prompt = "Stream this: 'double bubble bath' five times fast.", modelOverride) {
  const key = get4(apiKey);
  const model = modelOverride || get4(selectedModel);
  console.log("=== Responses API (streaming) Test ===");
  console.log("API Key configured:", !!key);
  console.log("Selected model:", model);
  if (!key) {
    console.error("No API key configured");
    return null;
  }
  const events = [];
  let finalText = "";
  try {
    finalText = await streamResponseViaResponsesAPI(prompt, model, {
      onEvent: (evt) => {
        if (evt.type === "response.created" || evt.type === "response.completed" || evt.type === "error") {
          console.log("SSE event:", evt.type, evt.data?.id || "");
        }
        events.push(evt);
      },
      onTextDelta: (_text) => {
      },
      onCompleted: (text) => {
        console.log("Streaming completed. Final text length:", text.length);
      },
      onError: (err) => {
        console.error("Streaming error:", err);
      }
    });
    return { success: true, finalText, eventsCount: events.length, events, model };
  } catch (e) {
    console.error("Responses Streaming error:", e);
    return { success: false, error: e, eventsCount: events.length, events, model };
  }
}

// src/tests/live/responsesNonStreamingLive.test.ts
registerTest({
  id: "live-responses-nonstream",
  name: "Live API: Responses API returns text (non-streaming)",
  tags: ["live", "api", "responses", "network", "smoke"],
  timeoutMs: 45e3,
  fn: async (assert) => {
    const key = get5(apiKey);
    assert.that(!!key, "API key is configured");
    if (!key) return;
    const { selectedModel: selectedModel2 } = await Promise.resolve().then(() => (init_stores(), stores_exports));
    const { getReasoningModel: getReasoningModel2 } = await Promise.resolve().then(() => (init_testModel(), testModel_exports));
    const prevModel = get5(selectedModel2);
    try {
      localStorage.removeItem("selectedModel");
      selectedModel2.set(getReasoningModel2());
      const result = await testResponsesAPI();
      assert.that(!!result, "Received a result object");
      assert.that(!!result?.success, "Non-streaming API call succeeded");
      assert.that(!!(result?.outputText ?? "").trim(), "Output text is non-empty");
    } catch (e) {
      assert.that(false, `Non-streaming API test error: ${e?.message ?? e}`);
    } finally {
      if (prevModel != null) selectedModel2.set(prevModel);
    }
  }
});

// src/tests/live/responsesStreamingLive.test.ts
init_stores();
import { get as get6 } from "svelte/store";
registerTest({
  id: "live-responses-stream",
  name: "Live API: Responses API streams tokens",
  tags: ["live", "api", "responses", "network", "smoke"],
  timeoutMs: 6e4,
  fn: async (assert) => {
    const key = get6(apiKey);
    assert.that(!!key, "API key is configured");
    if (!key) return;
    const { selectedModel: selectedModel2 } = await Promise.resolve().then(() => (init_stores(), stores_exports));
    const { getReasoningModel: getReasoningModel2 } = await Promise.resolve().then(() => (init_testModel(), testModel_exports));
    const prevModel = get6(selectedModel2);
    try {
      localStorage.removeItem("selectedModel");
      selectedModel2.set(getReasoningModel2());
      const result = await testResponsesStreamingAPI();
      assert.that(!!result, "Received a result object");
      assert.that(!!result?.success, "Streaming API call succeeded");
      assert.that((result?.eventsCount ?? 0) > 0, "Observed at least one streaming event");
      assert.that(!!(result?.finalText ?? "").trim(), "Final streamed text is non-empty");
    } catch (e) {
      assert.that(false, `Streaming API test error: ${e?.message ?? e}`);
    } finally {
      if (prevModel != null) selectedModel2.set(prevModel);
    }
  }
});

// src/tests/live/smoke.test.ts
test({
  id: "responses-api-nonstream",
  name: "Responses API - Non-Streaming returns text",
  tags: ["smoke", "responses", "live"],
  timeoutMs: 3e4,
  fn: async (assert) => {
    const result = await testResponsesAPI();
    assert.that(result != null, "Result should be returned");
    assert.that(result?.success === true, "Result.success should be true");
    assert.that(typeof result?.model === "string" && (result?.model?.length ?? 0) > 0, "Model id should be a non-empty string");
    assert.that(typeof result?.outputText === "string", "Output text should be a string");
    assert.that((result?.outputText ?? "").trim().length > 0, "Output text should be non-empty");
    assert.that((result?.outputText ?? "").length >= 5, "Output text length should be at least 5 chars");
  }
});
test({
  id: "responses-api-streaming",
  name: "Responses API - Streaming yields events and final text",
  tags: ["smoke", "responses", "stream", "live"],
  timeoutMs: 45e3,
  fn: async (assert) => {
    const result = await testResponsesStreamingAPI();
    assert.that(result != null, "Result should be returned");
    assert.that(result?.success === true, "Result.success should be true");
    assert.that(typeof result?.model === "string" && (result?.model?.length ?? 0) > 0, "Model id should be a non-empty string");
    assert.that(typeof result?.eventsCount === "number" && result?.eventsCount > 0, "Should receive at least one streaming event");
    assert.that(typeof result?.finalText === "string", "Final text should be a string");
    assert.that((result?.finalText ?? "").trim().length > 0, "Final text should be non-empty");
    assert.that((result?.eventsCount ?? 0) >= 3, "Should receive at least 3 streaming events");
  }
});

// src/tests/live/titleUpdateLive.test.ts
init_stores();
import { get as get7 } from "svelte/store";
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
registerTest({
  id: "live-title-update",
  name: "Live API: conversation title updates after first message",
  tags: ["live", "api", "responses", "network", "smoke"],
  timeoutMs: 45e3,
  fn: async (assert) => {
    const key = get7(apiKey);
    assert.that(!!key, "API key is configured");
    if (!key) return;
    const { selectedModel: selectedModel2 } = await Promise.resolve().then(() => (init_stores(), stores_exports));
    const { getReasoningModel: getReasoningModel2 } = await Promise.resolve().then(() => (init_testModel(), testModel_exports));
    const prevModel = get7(selectedModel2);
    localStorage.removeItem("selectedModel");
    selectedModel2.set(getReasoningModel2());
    const convId = get7(chosenConversationId);
    const convs0 = get7(conversations);
    assert.that(convs0 && convs0[convId] != null, "Current conversation exists");
    if (!convs0 || convs0[convId] == null) return;
    conversations.update((all) => {
      const copy = [...all];
      const curr = { ...copy[convId] };
      curr.title = "";
      if (Array.isArray(curr.history)) curr.history = [];
      copy[convId] = curr;
      return copy;
    });
    const beforeTitle = (get7(conversations)[convId]?.title ?? "").trim();
    assert.that(beforeTitle === "", 'Initial title is empty (renders as "New conversation")');
    const userMsg = [
      {
        role: "user",
        content: "Please answer briefly. Then the app should generate a short title summarizing this new chat."
      }
    ];
    try {
      await sendRegularMessage(userMsg, convId);
    } catch (e) {
      assert.that(false, `sendRegularMessage completed without throwing: ${e?.message ?? e}`);
      if (prevModel != null) selectedModel2.set(prevModel);
      return;
    }
    const deadline = Date.now() + 3e4;
    let finalTitle = "";
    while (Date.now() < deadline) {
      const t = (get7(conversations)[convId]?.title ?? "").trim();
      if (t && t.toLowerCase() !== "new conversation") {
        finalTitle = t;
        break;
      }
      await sleep(500);
    }
    if (prevModel != null) selectedModel2.set(prevModel);
    assert.that(!!finalTitle, `Conversation title updated to a non-empty value (got: "${finalTitle}")`);
    assert.that(finalTitle.toLowerCase() !== "new conversation", 'Title is not the placeholder "New conversation"');
  }
});
export {
  clearTests,
  formatSuiteResultsText,
  runAllTests
};
