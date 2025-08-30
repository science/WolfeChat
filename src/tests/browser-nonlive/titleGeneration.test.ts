import { test, withCleanEnvironment } from "../testHarness.js";
import { conversations, chosenConversationId, apiKey } from "../../stores/stores.js";
import * as convoManager from "../../managers/conversationManager.js";
import * as openaiSvc from "../../services/openaiService.js";

function setApiKeyMock(val: string|null) { apiKey.set(val as any); }

// Helper to reset store to single empty conversation
async function resetConversation() {
  await withCleanEnvironment(async () => {});
  conversations.set([
    {
      id: "conv-test-1",
      history: [],
      conversationTokens: 0,
      assistantRole: "",
      title: "",
    },
  ]);
  chosenConversationId.set(0);
}

// 1) createTitle fallback when Responses-shaped JSON returned
// We stub openaiService.sendRequest to return Responses JSON (no data.choices)
// Then routeMessage triggers createTitle and should set fallback title

test({
  id: "title.createTitle.fallback",
  name: "Title createTitle falls back on invalid structure",
  async fn(assert) {
    await resetConversation();
    setApiKeyMock("test-key");

    const origSendRequest = openaiSvc.sendRequest;
    // Return a Responses-like object that lacks data.choices
    // to trigger the warning path in createTitle
    // Also ensure countTokens path is not hit
    (openaiSvc as any).sendRequest = async () => ({ output_text: "Some Title" });

    // Spy on console.warn to confirm message
    const warns: any[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => { warns.push(args.join(" ")); };

    try {
      await convoManager.routeMessage("Build me a REST API with auth and tests", 0);
      const convList = (await import("../../stores/stores.js")).conversations;
      let current: any[] = [];
      convList.subscribe(v => current = v)();
      const t = current[0].title;
      assert.that(!!warns.find(w => w.includes("Title generation: Invalid response structure")), "Warns on invalid response shape");
      assert.that(!!t, "Title is set");
      assert.that(t.startsWith("Build me a REST API"), "Fallback is derived from input slice");
    } finally {
      (openaiSvc as any).sendRequest = origSendRequest;
      console.warn = origWarn;
    }
  }
});

// 2) maybeUpdateTitleAfterFirstMessage sets title using Responses API
// Stub global fetch used in openaiService.maybeUpdateTitleAfterFirstMessage

test({
  id: "title.maybeUpdate.setsFromResponses",
  name: "Title is set from Responses output after first assistant reply",
  async fn(assert) {
    await resetConversation();
    setApiKeyMock("test-key");

    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      // only intercept the title-generation call (non-streaming). Stream calls may happen too.
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && init.body && JSON.parse(init.body).stream === false) {
        return new Response(JSON.stringify({ output: [{ content: [{ text: "REST API Builder" }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }
      // For other calls (like the main assistant streaming), return minimal stream-complete path
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && JSON.parse(init.body).stream === true) {
        const encoder = new TextEncoder();
        // Minimal SSE: one delta then completed
        const sse = [
          "event: response.output_text.delta\ndata: {\"delta\":{\"text\":\"Hi\"}}\n\n",
          "event: response.completed\ndata: {}\n\n",
          "data: [DONE]\n\n"
        ].join("");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sse));
            controller.close();
          }
        });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response("{}", { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      // Send a message via regular path to trigger streaming and then title update
      await convoManager.routeMessage("Please outline a REST API design", 0);
      let list: any[] = [];
      conversations.subscribe(v => list = v)();
      const title = list[0].title;
      assert.that(title === "REST API Builder", "Title set from Responses output");
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }
});

// 3) Do not override custom title

test({
  id: "title.noOverride.custom",
  name: "Existing non-empty title is not overridden",
  async fn(assert) {
    await resetConversation();
    setApiKeyMock("test-key");

    // Pre-set a custom title
    conversations.update(arr => { const c = [...arr]; c[0] = { ...c[0], title: "My Custom Title" }; return c; });

    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && init.body && JSON.parse(init.body).stream === false) {
        return new Response(JSON.stringify({ output_text: "Should Not Apply" }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }
      // Regular stream minimal
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && JSON.parse(init.body).stream === true) {
        const encoder = new TextEncoder();
        const sse = [
          "event: response.output_text.delta\ndata: {\"delta\":{\"text\":\"OK\"}}\n\n",
          "event: response.completed\ndata: {}\n\n",
          "data: [DONE]\n\n"
        ].join("");
        const stream = new ReadableStream({ start(controller){ controller.enqueue(new TextEncoder().encode(sse)); controller.close(); } });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response("{}", { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      await convoManager.routeMessage("Anything", 0);
      let list: any[] = [];
      conversations.subscribe(v => list = v)();
      assert.that(list[0].title === "My Custom Title", "Title not overridden");
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }
});

// 4) Sanitize title

test({
  id: "title.sanitize.quotes.prefix",
  name: "Sanitizes quotes and Title: prefix",
  async fn(assert) {
    await resetConversation();
    setApiKeyMock("test-key");

    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && init.body && JSON.parse(init.body).stream === false) {
        return new Response(JSON.stringify({ output_text: '"Title: " "Quoted Name"' }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }
      if (typeof url === 'string' && url.endsWith('/v1/responses') && init && JSON.parse(init.body).stream === true) {
        const encoder = new TextEncoder();
        const sse = [
          "event: response.output_text.delta\ndata: {\"delta\":{\"text\":\"Text\"}}\n\n",
          "event: response.completed\ndata: {}\n\n",
          "data: [DONE]\n\n"
        ].join("");
        const stream = new ReadableStream({ start(controller){ controller.enqueue(encoder.encode(sse)); controller.close(); } });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response("{}", { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    try {
      await convoManager.routeMessage("Generate something", 0);
      let list: any[] = [];
      conversations.subscribe(v => list = v)();
      assert.that(list[0].title === "Quoted Name", "Sanitized title");
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }
});
