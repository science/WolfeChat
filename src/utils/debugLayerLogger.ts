// Layer-by-layer debug logging system for tracing data flow bugs
// This complements debugUtils.ts by focusing on internal app state flow

export interface DebugLogEntry {
  timestamp: number;
  layer: 'sseParser' | 'messageAssembly' | 'storeUpdates' | 'reactivity' | 'domRender' | 'reasoning';
  event: string;
  data: any;
  conversationId?: string;
  responseId?: string;
  callStack: string[];
  sequenceId: number;
}

export interface DebugDataStructure {
  // Existing debug data structure (from E2E tests)
  reasoningEvents?: any[];
  uiStateChanges?: any[];
  assistantMessages?: any[];
  streamState?: any[];

  // New layer tracking
  layers: {
    sseParser: DebugLogEntry[];
    messageAssembly: DebugLogEntry[];
    storeUpdates: DebugLogEntry[];
    reactivity: DebugLogEntry[];
    domRender: DebugLogEntry[];
    reasoning: DebugLogEntry[];
  };

  // Unified timeline
  timeline: DebugLogEntry[];

  // Conversation context tracking
  conversationContext: Map<string, any>;
}

// Global sequence counter for ordering events
let globalSequenceId = 0;

// Helper to check if debug mode is enabled
export function isDebugMode(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__DEBUG_E2E >= 2 || (window as any).DEBUG_E2E === 2 || (window as any).DEBUG_E2E === '2');
}

// Initialize debug data structure on window
export function initializeDebugStructure(): void {
  if (!isDebugMode()) return;

  if (typeof window === 'undefined') return;

  if (!(window as any).__testDebugData) {
    (window as any).__testDebugData = {
      reasoningEvents: [],
      uiStateChanges: [],
      assistantMessages: [],
      streamState: []
    };
  }

  const debugData = (window as any).__testDebugData;

  if (!debugData.layers) {
    debugData.layers = {
      sseParser: [],
      messageAssembly: [],
      storeUpdates: [],
      reactivity: [],
      domRender: [],
      reasoning: []
    };
  }

  if (!debugData.timeline) {
    debugData.timeline = [];
  }

  if (!debugData.conversationContext) {
    debugData.conversationContext = new Map();
  }
}

// High-resolution timestamp generation
export function getTimestamp(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// Call stack capture utility (limited to avoid performance impact)
export function captureCallStack(): string[] {
  try {
    const error = new Error();
    return (error.stack || '').split('\n').slice(2, 7); // Skip 2 lines, take 5
  } catch {
    return [];
  }
}

// Core logging function
export function logDebugEvent(
  layer: DebugLogEntry['layer'],
  event: string,
  data: any,
  conversationId?: string,
  responseId?: string
): void {
  if (!isDebugMode()) return;

  initializeDebugStructure();

  const entry: DebugLogEntry = {
    timestamp: getTimestamp(),
    layer,
    event,
    data,
    conversationId,
    responseId,
    callStack: captureCallStack(),
    sequenceId: ++globalSequenceId
  };

  try {
    const debugData = (window as any).__testDebugData as DebugDataStructure;

    // Add to layer-specific array
    debugData.layers[layer].push(entry);

    // Add to unified timeline
    debugData.timeline.push(entry);

    // Update conversation context if provided
    if (conversationId) {
      debugData.conversationContext.set(conversationId, {
        lastUpdate: entry.timestamp,
        lastEvent: event
      });
    }

    // Console log for immediate visibility during development
    console.log(`[DEBUG-${layer.toUpperCase()}] ${event}`, {
      seq: entry.sequenceId,
      convId: conversationId,
      respId: responseId,
      data: data
    });

  } catch (error) {
    console.error('Failed to log debug event:', error);
  }
}

// Layer-specific logging functions
export const debugLog = {
  sseParser: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('sseParser', event, data, conversationId, responseId),

  messageAssembly: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('messageAssembly', event, data, conversationId, responseId),

  storeUpdates: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('storeUpdates', event, data, conversationId, responseId),

  reactivity: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('reactivity', event, data, conversationId, responseId),

  domRender: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('domRender', event, data, conversationId, responseId),

  reasoning: (event: string, data: any, conversationId?: string, responseId?: string) =>
    logDebugEvent('reasoning', event, data, conversationId, responseId)
};

// Analysis helper functions
export function getDebugData(): DebugDataStructure | null {
  if (!isDebugMode()) return null;

  if (typeof window === 'undefined') return null;

  return (window as any).__testDebugData || null;
}

export function getTimelineForConversation(conversationId: string): DebugLogEntry[] {
  const data = getDebugData();
  if (!data) return [];

  return data.timeline.filter(entry => entry.conversationId === conversationId);
}

export function getEventsForResponseId(responseId: string): DebugLogEntry[] {
  const data = getDebugData();
  if (!data) return [];

  return data.timeline.filter(entry => entry.responseId === responseId);
}

export function findMissingEvents(): { layer: string; expectedEvents: string[] }[] {
  const data = getDebugData();
  if (!data) return [];

  const missing: { layer: string; expectedEvents: string[] }[] = [];

  // Check for expected SSE events
  const sseEvents = data.layers.sseParser.map(e => e.event);
  const expectedSSEEvents = ['response.created', 'response.output_text.delta', 'response.completed'];
  const missingSSE = expectedSSEEvents.filter(event => !sseEvents.includes(event));
  if (missingSSE.length > 0) {
    missing.push({ layer: 'sseParser', expectedEvents: missingSSE });
  }

  // Check for expected message assembly events
  const assemblyEvents = data.layers.messageAssembly.map(e => e.event);
  const expectedAssemblyEvents = ['message_created', 'content_accumulated', 'setHistory_called'];
  const missingAssembly = expectedAssemblyEvents.filter(event => !assemblyEvents.includes(event));
  if (missingAssembly.length > 0) {
    missing.push({ layer: 'messageAssembly', expectedEvents: missingAssembly });
  }

  return missing;
}

export function analyzeEventTiming(): { gaps: any[]; rapidSequences: any[] } {
  const data = getDebugData();
  if (!data) return { gaps: [], rapidSequences: [] };

  const timeline = data.timeline.sort((a, b) => a.timestamp - b.timestamp);
  const gaps: any[] = [];
  const rapidSequences: any[] = [];

  for (let i = 1; i < timeline.length; i++) {
    const timeDiff = timeline[i].timestamp - timeline[i-1].timestamp;

    // Flag large gaps (> 100ms)
    if (timeDiff > 100) {
      gaps.push({
        gap: timeDiff,
        before: timeline[i-1],
        after: timeline[i]
      });
    }

    // Flag rapid sequences (< 1ms)
    if (timeDiff < 1) {
      rapidSequences.push({
        gap: timeDiff,
        events: [timeline[i-1], timeline[i]]
      });
    }
  }

  return { gaps, rapidSequences };
}

// Debug dump function for test failures
export function dumpDebugData(): void {
  const data = getDebugData();
  if (!data) {
    console.log('[DEBUG-DUMP] No debug data available');
    return;
  }

  console.log('[DEBUG-DUMP] === Full Debug Data ===');
  console.log('[DEBUG-DUMP] Total events:', data.timeline.length);

  // Show events by layer
  Object.keys(data.layers).forEach(layer => {
    const events = data.layers[layer as keyof typeof data.layers];
    console.log(`[DEBUG-DUMP] ${layer}: ${events.length} events`);
    events.forEach(event => {
      console.log(`  ${event.sequenceId}: ${event.event}`, event.data);
    });
  });

  // Show timeline
  console.log('[DEBUG-DUMP] === Timeline ===');
  data.timeline.forEach(event => {
    console.log(`${event.sequenceId}: [${event.layer}] ${event.event} @${event.timestamp.toFixed(2)}ms`);
  });

  // Analysis
  const missing = findMissingEvents();
  if (missing.length > 0) {
    console.log('[DEBUG-DUMP] === Missing Events ===');
    missing.forEach(m => {
      console.log(`${m.layer}: missing ${m.expectedEvents.join(', ')}`);
    });
  }

  const timing = analyzeEventTiming();
  if (timing.gaps.length > 0) {
    console.log('[DEBUG-DUMP] === Large Time Gaps ===');
    timing.gaps.forEach(gap => {
      console.log(`${gap.gap.toFixed(2)}ms gap between ${gap.before.event} and ${gap.after.event}`);
    });
  }
}

// Reset debug data (useful for test isolation)
export function resetDebugData(): void {
  if (!isDebugMode()) return;

  if (typeof window === 'undefined') return;

  globalSequenceId = 0;

  const debugData = (window as any).__testDebugData;
  if (debugData) {
    debugData.layers = {
      sseParser: [],
      messageAssembly: [],
      storeUpdates: [],
      reactivity: [],
      domRender: [],
      reasoning: []
    };
    debugData.timeline = [];
    debugData.conversationContext = new Map();
  }
}