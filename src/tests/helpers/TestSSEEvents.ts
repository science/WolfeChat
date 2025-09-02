import type { ResponsesStreamCallbacks } from '../../services/openaiService';

// Lightweight event bus with promise-based waiters for tests
export type Handler = (payload?: any) => void;

class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(type: string, h: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(h);
    return () => this.handlers.get(type)!.delete(h);
  }

  emit(type: string, payload?: any) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of Array.from(set)) h(payload);
  }

  waitFor<T = any>(type: string, timeoutMs = 10000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const off = this.on(type, (p) => {
        clearTimeout(timer);
        off();
        resolve(p as T);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeoutMs);
    });
  }
}

export function bindToCallbacks(user?: ResponsesStreamCallbacks) {
  const bus = new EventBus();

  const callbacks: ResponsesStreamCallbacks = {
    onEvent: user?.onEvent,
    onTextDelta: (t) => {
      user?.onTextDelta?.(t);
      bus.emit('sse.output.delta', t);
    },
    onCompleted: (finalText, raw) => {
      user?.onCompleted?.(finalText, raw);
      bus.emit('sse.output.completed', { finalText, raw });
      bus.emit('sse.stream.done');
    },
    onError: (e) => {
      user?.onError?.(e);
      bus.emit('sse.error', e);
    },
    onReasoningStart: (k, m) => {
      user?.onReasoningStart?.(k, m);
      bus.emit(`sse.reasoning.${k}.start`, m);
    },
    onReasoningDelta: (k, t) => {
      user?.onReasoningDelta?.(k, t);
      bus.emit(`sse.reasoning.${k}.delta`, t);
    },
    onReasoningDone: (k, txt) => {
      user?.onReasoningDone?.(k, txt);
      bus.emit(`sse.reasoning.${k}.done`, txt);
    }
  };

  const api = {
    waitForOutputCompleted: (ms?: number) => bus.waitFor('sse.output.completed', ms),
    waitForReasoningSummaryDone: (ms?: number) => bus.waitFor('sse.reasoning.summary.done', ms),
    waitForReasoningTextDone: (ms?: number) => bus.waitFor('sse.reasoning.text.done', ms),
    waitForAllDone: (ms?: number) => bus.waitFor('sse.stream.done', ms),
    waitForError: (ms?: number) => bus.waitFor('sse.error', ms),
    waitForEvent: (type: string, ms?: number) => bus.waitFor(type, ms),
    on: bus.on.bind(bus)
  };

  return { callbacks, bus: api } as const;
}
