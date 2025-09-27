import { writable } from 'svelte/store';
import { debugLog } from '../utils/debugLayerLogger.js';

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
  debugLog.reasoning('window_creation_start', {
    convId,
    model,
    anchorIndex,
    timestamp: Date.now()
  }, convId);

  const id = genWindowId(convId);

  debugLog.reasoning('window_id_generated', {
    windowId: id,
    convId,
    model,
    pattern: `${Date.now()}-*-win-${convId ?? 'na'}`
  }, convId);

  reasoningWindows.update((arr) => {
    const newWindow = { id, convId, model, anchorIndex, open: true, createdAt: Date.now() };
    const updatedArray = [...arr, newWindow];

    debugLog.reasoning('window_added_to_store', {
      windowId: id,
      convId,
      model,
      anchorIndex,
      totalWindows: updatedArray.length,
      newWindow
    }, convId);

    return updatedArray;
  });

  debugLog.reasoning('window_creation_completed', {
    windowId: id,
    convId,
    model,
    anchorIndex,
    success: true
  }, convId);

  return id;
}

export function collapseReasoningWindow(id: string) {
  let windowFound = false;
  let windowInfo: any = null;

  debugLog.reasoning('window_collapse_start', {
    windowId: id,
    timestamp: Date.now()
  });

  reasoningWindows.update((arr) => {
    return arr.map((w) => {
      if (w.id === id) {
        windowFound = true;
        windowInfo = {
          windowId: id,
          convId: w.convId,
          model: w.model,
          anchorIndex: w.anchorIndex,
          wasOpen: w.open
        };

        debugLog.reasoning('window_marked_collapsed', {
          windowId: id,
          convId: w.convId,
          model: w.model,
          anchorIndex: w.anchorIndex,
          wasOpen: w.open,
          createdAt: w.createdAt
        }, w.convId);

        return { ...w, open: false };
      }
      return w;
    });
  });

  if (!windowFound) {
    debugLog.reasoning('window_collapse_not_found', {
      windowId: id
    });
  } else {
    debugLog.reasoning('window_collapse_completed', {
      windowId: id,
      ...windowInfo,
      success: true
    }, windowInfo?.convId);
  }
}

function genId(kind: ReasoningKind, convId?: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${kind}-${convId ?? 'na'}`;
}

export function startReasoningPanel(kind: ReasoningKind, convId?: string, responseId?: string): string {
  debugLog.reasoning('panel_creation_start', {
    kind,
    convId,
    responseId,
    timestamp: Date.now()
  }, convId, responseId);

  const id = genId(kind, convId);

  debugLog.reasoning('panel_id_generated', {
    panelId: id,
    kind,
    convId,
    responseId,
    pattern: `${Date.now()}-*-${kind}-${convId ?? 'na'}`
  }, convId, responseId);

  reasoningPanels.update((arr) => {
    const newPanel = { id, convId, responseId, kind, text: '', open: true, startedAt: Date.now(), done: false };
    const updatedArray = [...arr, newPanel];

    debugLog.reasoning('panel_added_to_store', {
      panelId: id,
      kind,
      convId,
      responseId,
      totalPanels: updatedArray.length,
      panelsForConv: updatedArray.filter(p => p.convId === convId).length,
      newPanel
    }, convId, responseId);

    return updatedArray;
  });

  debugLog.reasoning('panel_creation_completed', {
    panelId: id,
    kind,
    convId,
    responseId,
    success: true
  }, convId, responseId);

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
  let panelFound = false;
  let beforeText = '';
  let afterText = '';
  let panelInfo: any = null;

  debugLog.reasoning('text_update_start', {
    panelId: id,
    textLength: (text ?? '').length,
    textSnippet: (text ?? '').slice(0, 100),
    timestamp: Date.now()
  });

  reasoningPanels.update((arr) => {
    return arr.map((p) => {
      if (p.id === id) {
        panelFound = true;
        beforeText = p.text;
        afterText = text ?? '';
        panelInfo = {
          panelId: id,
          convId: p.convId,
          responseId: p.responseId,
          kind: p.kind,
          done: p.done,
          open: p.open
        };

        debugLog.reasoning('text_content_updated', {
          panelId: id,
          convId: p.convId,
          responseId: p.responseId,
          kind: p.kind,
          beforeTextLength: beforeText.length,
          afterTextLength: afterText.length,
          textChanged: beforeText !== afterText,
          panelOpen: p.open,
          panelDone: p.done,
          textSnippet: afterText.slice(0, 100)
        }, p.convId, p.responseId);

        return { ...p, text: afterText };
      }
      return p;
    });
  });

  if (!panelFound) {
    debugLog.reasoning('text_update_panel_not_found', {
      panelId: id,
      textLength: (text ?? '').length,
      allPanelIds: [] // We don't have access to current panels here, but this will be logged
    });
  } else {
    debugLog.reasoning('text_update_completed', {
      panelId: id,
      ...panelInfo,
      beforeTextLength: beforeText.length,
      afterTextLength: afterText.length,
      success: true
    }, panelInfo?.convId, panelInfo?.responseId);
  }
}

export function completeReasoningPanel(id: string) {
  let panelFound = false;
  let panelInfo: any = null;

  debugLog.reasoning('panel_completion_start', {
    panelId: id,
    timestamp: Date.now()
  });

  reasoningPanels.update((arr) => {
    return arr.map((p) => {
      if (p.id === id) {
        panelFound = true;
        panelInfo = {
          panelId: id,
          convId: p.convId,
          responseId: p.responseId,
          kind: p.kind,
          textLength: p.text.length,
          wasOpen: p.open,
          wasDone: p.done
        };

        debugLog.reasoning('panel_marked_complete', {
          panelId: id,
          convId: p.convId,
          responseId: p.responseId,
          kind: p.kind,
          textLength: p.text.length,
          wasOpen: p.open,
          wasDone: p.done,
          finalTextSnippet: p.text.slice(0, 100)
        }, p.convId, p.responseId);

        return { ...p, open: false, done: true };
      }
      return p;
    });
  });

  if (!panelFound) {
    debugLog.reasoning('panel_completion_not_found', {
      panelId: id
    });
  } else {
    debugLog.reasoning('panel_completion_completed', {
      panelId: id,
      ...panelInfo,
      success: true
    }, panelInfo?.convId, panelInfo?.responseId);
  }
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
  debugLog.reasoning('sse_event_logged', {
    eventType: type,
    convId,
    timestamp: Date.now(),
    hasData: !!_data,
    dataKeys: _data ? Object.keys(_data) : []
  }, convId);

  reasoningSSEEvents.update((arr) => {
    const entry: SSEEventEntry = { id: genEventId(), convId, type, ts: Date.now() };
    const next = [...arr, entry];
    const finalArray = next.length > 500 ? next.slice(next.length - 500) : next;

    debugLog.reasoning('sse_event_added_to_store', {
      eventId: entry.id,
      eventType: type,
      convId,
      totalEvents: finalArray.length,
      eventsForConv: finalArray.filter(e => e.convId === convId).length,
      wasTruncated: next.length > 500
    }, convId);

    return finalArray;
  });
}

// Expose for testing
if (typeof window !== 'undefined') {
  (window as any).startReasoningPanel = startReasoningPanel;
  (window as any).appendReasoningText = appendReasoningText;
  (window as any).setReasoningText = setReasoningText;
  (window as any).completeReasoningPanel = completeReasoningPanel;
}
