import { writable, get } from 'svelte/store';

export type ReasoningKind = 'summary' | 'text';

export interface ReasoningPanel {
  id: string;
  convId?: string; // Changed from number to string
  responseId?: string;
  kind: ReasoningKind;
  text: string;
  open: boolean;
  startedAt: number;
  done: boolean;
}

export interface ReasoningWindow {
  id: string;
  convId?: string; // Changed from number to string
  model?: string;
  anchorIndex?: number;
  open: boolean;
  createdAt: number;
}

// Storage keys
const REASONING_PANELS_KEY = 'reasoning_panels';
const REASONING_WINDOWS_KEY = 'reasoning_windows';

// Load from localStorage
function loadFromStorage<T>(key: string, defaultValue: T[]): T[] {
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

// Save to localStorage
function saveToStorage<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
}

// Initialize stores with persisted data
const initialPanels = loadFromStorage<ReasoningPanel>(REASONING_PANELS_KEY, []);
const initialWindows = loadFromStorage<ReasoningWindow>(REASONING_WINDOWS_KEY, []);

export const reasoningPanels = writable<ReasoningPanel[]>(initialPanels);
export const reasoningWindows = writable<ReasoningWindow[]>(initialWindows);

// Subscribe to changes and persist
reasoningPanels.subscribe((panels) => {
  saveToStorage(REASONING_PANELS_KEY, panels);
});

reasoningWindows.subscribe((windows) => {
  saveToStorage(REASONING_WINDOWS_KEY, windows);
});

function genWindowId(convId?: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-win-${convId ?? 'na'}`;
}

export function createReasoningWindow(convId?: string, model?: string, anchorIndex?: number): string {
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

function genId(kind: ReasoningKind, convId?: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${kind}-${convId ?? 'na'}`;
}

export function startReasoningPanel(kind: ReasoningKind, convId?: string, responseId?: string): string {
  const id = genId(kind, convId);
  reasoningPanels.update((arr) => [
    ...arr,
    { id, convId, responseId, kind, text: '', open: true, startedAt: Date.now(), done: false }
  ]);
  return id;
}

/**
 * @deprecated Use setReasoningText with accumulated text instead to avoid duplication issues
 */
export function appendReasoningText(id: string, chunk: string) {
  if (!chunk) return;
  reasoningPanels.update((arr) =>
    arr.map((p) => (p.id === id ? { ...p, text: p.text + chunk } : p))
  );
}

export function setReasoningText(id: string, text: string) {
  reasoningPanels.update((arr) =>
    arr.map((p) => (p.id === id ? { ...p, text: text ?? '' } : p))
  );
}

export function completeReasoningPanel(id: string) {
  reasoningPanels.update((arr) =>
    arr.map((p) => (p.id === id ? { ...p, open: false, done: true } : p))
  );
}

// Clear reasoning data for a specific conversation
export function clearReasoningForConversation(convId: string) {
  reasoningWindows.update((arr) => arr.filter((w) => w.convId !== convId));
  reasoningPanels.update((arr) => arr.filter((p) => p.convId !== convId));
}

// Clear all reasoning data
export function clearAllReasoning() {
  reasoningWindows.set([]);
  reasoningPanels.set([]);
}

/**
 * Lightweight per-conversation SSE event log for debugging reasoning.
 * Stored separately from conversation history and NEVER included in prompts.
 */
export interface SSEEventEntry {
  id: string;
  convId?: string; // Changed from number to string
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
export function logSSEEvent(type: string, _data?: any, convId?: string) {
  reasoningSSEEvents.update((arr) => {
    const entry: SSEEventEntry = { id: genEventId(), convId, type, ts: Date.now() };
    const next = [...arr, entry];
    // Cap total entries to avoid unbounded growth
    return next.length > 500 ? next.slice(next.length - 500) : next;
  });
}

// Expose for testing
if (typeof window !== 'undefined') {
  (window as any).startReasoningPanel = startReasoningPanel;
  (window as any).appendReasoningText = appendReasoningText;
  (window as any).setReasoningText = setReasoningText;
  (window as any).completeReasoningPanel = completeReasoningPanel;
}
