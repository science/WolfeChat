import { writable } from 'svelte/store';

export type ReasoningKind = 'summary' | 'text';

export interface ReasoningPanel {
  id: string;
  convId?: number;
  kind: ReasoningKind;
  text: string;
  open: boolean;
  startedAt: number;
  done: boolean;
}

export const reasoningPanels = writable<ReasoningPanel[]>([]);

function genId(kind: ReasoningKind, convId?: number) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${kind}-${convId ?? 'na'}`;
}

export function startReasoningPanel(kind: ReasoningKind, convId?: number): string {
  const id = genId(kind, convId);
  reasoningPanels.update((arr) => [
    ...arr,
    { id, convId, kind, text: '', open: true, startedAt: Date.now(), done: false }
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
