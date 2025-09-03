import { derived, writable, type Readable, type Writable } from 'svelte/store';
import { selectedModel } from './stores';
import { reasoningEffort as globalReasoningEffort, verbosity as globalVerbosity, summary as globalSummary } from './reasoningSettings';

export type Effort = 'minimal' | 'low' | 'medium' | 'high';
export type Verb = 'low' | 'medium' | 'high';
export type Summ = 'auto' | 'detailed' | 'null';

export interface ConversationQuickSettings {
  model?: string;
  reasoningEffort?: Effort;
  verbosity?: Verb;
  summary?: Summ;
}

export interface CQSettingsApi {
  subscribe: Readable<Record<string, ConversationQuickSettings>>['subscribe'];
  setSettings: (convId: string | null | undefined, patch: Partial<ConversationQuickSettings>) => void;
  getSettings: (convId: string | null | undefined) => ConversationQuickSettings;
  deleteSettings: (convId: string | null | undefined) => void;
  currentSettingsWritable: (chosenId: Readable<number | string | null | undefined>, idResolver: (id: number | string | null | undefined) => string | null) => Writable<ConversationQuickSettings>;
}

function normalizeId(id: string | number | null | undefined): string | null {
  if (id == null) return null;
  return String(id);
}

export function createConversationQuickSettingsStore(initial?: Record<string, ConversationQuickSettings>): CQSettingsApi {
  const store = writable<Record<string, ConversationQuickSettings>>({ ...(initial || {}) });

  function setSettings(convId: string | number | null | undefined, patch: Partial<ConversationQuickSettings>) {
    const key = normalizeId(convId);
    if (!key) return;
    store.update((m) => ({ ...m, [key]: { ...(m[key] || {}), ...patch } }));
  }

  function getSettings(convId: string | number | null | undefined): ConversationQuickSettings {
    const key = normalizeId(convId);
    if (!key) return {};
    let snapshot: Record<string, ConversationQuickSettings> = {};
    const unsub = store.subscribe((s) => (snapshot = s));
    unsub();
    return snapshot[key] || {};
  }

  function deleteSettings(convId: string | number | null | undefined) {
    const key = normalizeId(convId);
    if (!key) return;
    store.update((m) => {
      if (!(key in m)) return m;
      const { [key]: _, ...rest } = m;
      return rest;
    });
  }

  // Derived current settings with fallback to globals when missing
  function currentSettingsWritable(
    chosenId: Readable<number | string | null | undefined>,
    idResolver: (id: number | string | null | undefined) => string | null
  ): Writable<ConversationQuickSettings> {
    const convKey$ = derived(chosenId, idResolver);
    const fallback$ = derived([selectedModel, globalReasoningEffort, globalVerbosity, globalSummary], ([$m, $e, $v, $s]) => ({ model: $m, reasoningEffort: $e as Effort, verbosity: $v as Verb, summary: $s as Summ }));

    const readable = derived([store, convKey$, fallback$], ([$store, $key, $fb]) => {
      if (!$key) return $fb;
      const cur = $store[$key] || {};
      return { ...$fb, ...cur } as ConversationQuickSettings;
    });

    return {
      subscribe: readable.subscribe,
      set: (val: ConversationQuickSettings) => {
        let keySnap: string | null = null;
        const u1 = convKey$.subscribe((k) => (keySnap = k));
        u1();
        if (!keySnap) return;
        // store the explicit values only (avoid writing fallbacks)
        store.update((m) => ({ ...m, [keySnap!]: { ...m[keySnap!] , ...val } }));
      },
      update: (fn: (val: ConversationQuickSettings) => ConversationQuickSettings) => {
        let keySnap: string | null = null;
        let curVal: ConversationQuickSettings = {};
        const u1 = convKey$.subscribe((k) => (keySnap = k)); u1();
        if (!keySnap) return;
        const u2 = readable.subscribe((v) => (curVal = v)); u2();
        const next = fn(curVal);
        store.update((m) => ({ ...m, [keySnap!]: { ...m[keySnap!], ...next } }));
      },
    } as Writable<ConversationQuickSettings>;
  }

  return { subscribe: store.subscribe, setSettings, getSettings, deleteSettings, currentSettingsWritable };
}

export const conversationQuickSettings = createConversationQuickSettingsStore();

if (typeof window !== 'undefined') {
  (window as any).conversationQuickSettings = conversationQuickSettings;
}
