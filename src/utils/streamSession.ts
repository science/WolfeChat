import { streamResponseViaResponsesAPI, type ResponsesStreamCallbacks } from '../services/openaiService';

export type ReasoningKind = 'summary' | 'text';

export interface StreamSession {
  awaitMainResponseCompleted(): Promise<string>;
  awaitAllReasoningDone(): Promise<{ summary?: string; text?: string }>;
  awaitCurrentReasoningDone(kind: ReasoningKind): Promise<string | undefined>;
  awaitStreamDone(): Promise<void>;
  subscribeTextDeltas(handler: (delta: string) => void): () => void;
  cancel(): void;
  getFinalText(): string;
  getReasoning(kind: ReasoningKind): string | undefined;
}

export function createStreamSession(opts: { prompt?: string; model?: string; inputOverride?: any[]; uiContext?: { convId?: string; anchorIndex?: number } }) {
  let finalText = '';
  const reasoning: Partial<Record<ReasoningKind, string>> = {};
  const deltaHandlers = new Set<(d: string) => void>();

  // Promise resolvers
  let resolveCompleted: (t: string) => void, rejectCompleted: (e: any) => void;
  const completedP = new Promise<string>((res, rej) => { resolveCompleted = res; rejectCompleted = rej; });

  let resolveAllReasoning: (o: { summary?: string; text?: string }) => void, rejectAllReasoning: (e: any) => void;
  const allReasoningP = new Promise<{ summary?: string; text?: string }>((res, rej) => { resolveAllReasoning = res; rejectAllReasoning = rej; });

  const waitingByKind = new Map<ReasoningKind, { resolve: (t?: string) => void; reject: (e: any) => void; promise: Promise<string | undefined> }>();
  for (const k of ['summary','text'] as ReasoningKind[]) {
    let r!: (t?: string) => void, j!: (e: any) => void;
    const p = new Promise<string | undefined>((res, rej) => { r = res; j = rej; });
    waitingByKind.set(k, { resolve: r, reject: j, promise: p });
  }

  let resolveStreamDone: () => void, rejectStreamDone: (e: any) => void;
  const streamDoneP = new Promise<void>((res, rej) => { resolveStreamDone = res; rejectStreamDone = rej; });

  // We consider all-reasoning-done as soon as we get first output_text delta
  let allReasoningSignaled = false;

  const callbacks: ResponsesStreamCallbacks = {
    onTextDelta: (t) => {
      if (!allReasoningSignaled) {
        allReasoningSignaled = true;
        resolveAllReasoning({ summary: reasoning.summary, text: reasoning.text });
      }
      finalText += t || '';
      for (const h of deltaHandlers) h(t || '');
    },
    onCompleted: (t) => {
      finalText = t || finalText;
      resolveCompleted(finalText);
    },
    onError: (e) => {
      rejectCompleted(e);
      if (!allReasoningSignaled) rejectAllReasoning(e);
      rejectStreamDone(e);
      for (const k of waitingByKind.keys()) waitingByKind.get(k)!.reject(e);
    },
    onReasoningStart: () => {},
    onReasoningDelta: (k, txt) => {
      const key = k as ReasoningKind;
      reasoning[key] = (reasoning[key] || '') + (txt || '');
    },
    onReasoningDone: (k, txt) => {
      const key = k as ReasoningKind;
      if (typeof txt === 'string' && txt.length) reasoning[key] = txt;
      const wait = waitingByKind.get(key);
      wait && wait.resolve(reasoning[key]);
    }
  };

  // Kick off the stream
  const run = streamResponseViaResponsesAPI(opts.prompt || '', opts.model, callbacks, opts.inputOverride, opts.uiContext)
    .catch((e) => {
      // ensure rejections flow to promises
      callbacks.onError?.(e);
      throw e;
    })
    .finally(() => {
      resolveStreamDone();
    });

  function subscribeTextDeltas(handler: (delta: string) => void) {
    deltaHandlers.add(handler);
    return () => deltaHandlers.delete(handler);
  }

  function cancel() {
    // Delegate to service-level abort
    try {
      // dynamic import to avoid direct cycle
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const svc = require('../services/openaiService');
      if (typeof svc.closeStream === 'function') svc.closeStream();
    } catch {}
  }

  const session: StreamSession = {
    awaitMainResponseCompleted: () => completedP,
    awaitAllReasoningDone: () => allReasoningP,
    awaitCurrentReasoningDone: (k: ReasoningKind) => waitingByKind.get(k)!.promise,
    awaitStreamDone: () => streamDoneP,
    subscribeTextDeltas,
    cancel,
    getFinalText: () => finalText,
    getReasoning: (k: ReasoningKind) => reasoning[k]
  };

  return { session, run } as const;
}
