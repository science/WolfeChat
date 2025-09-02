/* Utilities to mock the Responses SSE endpoint inside browser context */

export type SSEChunk = string | { delay?: number; block: string };

export function sseBlock(event: string | undefined, data: any): string {
  const lines: string[] = [];
  if (event && event !== 'message') lines.push(`event: ${event}`);
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  payload.split('\n').forEach((ln) => lines.push(`data: ${ln}`));
  return lines.join('\n');
}

export function makeSSEStream(chunks: SSEChunk[], endDelay = 0): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) {
        const delay = typeof c === 'string' ? 0 : (c.delay ?? 0);
        const block = typeof c === 'string' ? c : c.block;
        if (delay) await new Promise((r) => setTimeout(r, delay));
        controller.enqueue(enc.encode(block + '\n\n'));
      }
      if (endDelay) await new Promise((r) => setTimeout(r, endDelay));
      controller.close();
    }
  });
}

// Install a fetch mock for POST https://api.openai.com/v1/responses that returns a streaming Response
export async function installResponsesFetchMock(chunks: SSEChunk[]) {
  const original = window.fetch.bind(window);
  const urlMatch = /\/v1\/responses$/;

  (window as any).__fetchMockInstalled = true;
  ;(window as any).__restoreFetch = () => { (window as any).fetch = original; };

  (window as any).fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const method = init?.method || 'GET';
    if (method === 'POST' && urlMatch.test(url)) {
      const stream = makeSSEStream(chunks);
      const res = new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
      return Promise.resolve(res);
    }
    return original(input as any, init);
  };
}
