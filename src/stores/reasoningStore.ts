import { writable } from 'svelte/store';

export type ReasoningKind = 'summary' | 'text';

export interface ReasoningPanel {
  id: string;
  convId?: number;
  responseId?: string;
  kind: ReasoningKind;
  text: string;
  open: boolean;
  startedAt: number;
  done: boolean;
}

export const reasoningPanels = writable<ReasoningPanel[]>([]);

/**
 * Reasoning windows are top-level containers, one per API Response.
 * They group one or more ReasoningPanels (e.g., summary + text) by responseId.
 */
export interface ReasoningWindow {
  id: string;
  convId?: number;
  model?: string;
  anchorIndex?: number;
  open: boolean;
  createdAt: number;
}
export const reasoningWindows = writable<ReasoningWindow[]>([]);

function genWindowId(convId?: number) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-win-${convId ?? 'na'}`;
}

export function createReasoningWindow(convId?: number, model?: string, anchorIndex?: number): string {
  const id = genWindowId(convId);
  reasoningWindows.update((arr) => [
    ...arr,
    { id, convId, model, anchorIndex, open: true, createdAt: Date.now() }
  ]);
  return id;
}

export function collapseReasoningWindow(id: string) {
  reasoningWindows.update((arr) => arr.map((w) => (w.id === id ? { ...w, open: false } : w)));
}

function genId(kind: ReasoningKind, convId?: number) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${kind}-${convId ?? 'na'}`;
}

export function startReasoningPanel(kind: ReasoningKind, convId?: number, responseId?: string): string {
  const id = genId(kind, convId);
  reasoningPanels.update((arr) => [
    ...arr,
    { id, convId, responseId, kind, text: '', open: true, startedAt: Date.now(), done: false }
  ]);
  return id;
}

export function appendReasoningText(id: string, chunk: string) {
  if (!chunk) return;
  reasoningPanels.update((arr) =>
    arr.map((p) => (p.id === id ? { ...p, text: p.text + chunk } : p))
  );
}

export function completeReasoningPanel(id: string) {
  reasoningPanels.update((arr) =>
    arr.map((p) => (p.id === id ? { ...p, open: false, done: true } : p))
  );
}

/**
 * Lightweight per-conversation SSE event log for debugging reasoning.
 * Stored separately from conversation history and NEVER included in prompts.
 */
export interface SSEEventEntry {
  id: string;
  convId?: number;
  type: string;
  ts: number;
}

export const reasoningSSEEvents = writable<SSEEventEntry[]>([]);

function genEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-evt`;
}

/**
 * Log a compact SSE entry (type only). We intentionally avoid storing payload
 * text to ensure none of this data is reused as model input.
 */
export function logSSEEvent(type: string, _data?: any, convId?: number) {
  reasoningSSEEvents.update((arr) => {
    const entry: SSEEventEntry = { id: genEventId(), convId, type, ts: Date.now() };
    const next = [...arr, entry];
    // Cap total entries to avoid unbounded growth
    return next.length > 500 ? next.slice(next.length - 500) : next;
  });
}
