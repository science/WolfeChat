/**
 * Anthropic Reasoning Support
 *
 * Handles extended thinking/reasoning for Claude models
 * Integrates with existing reasoning window system
 */

import {
  createReasoningWindow,
  startReasoningPanel,
  setReasoningText,
  completeReasoningPanel
} from '../stores/reasoningStore.js';

/**
 * Claude models that support extended thinking/reasoning
 */
const REASONING_MODELS = [
  'claude-opus-4-1',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-sonnet-3.7'
];

/**
 * Default thinking budget in tokens
 */
const DEFAULT_THINKING_BUDGET = 16384; // 16k tokens as recommended

/**
 * Check if a Claude model supports reasoning/extended thinking
 */
export function supportsAnthropicReasoning(model: string): boolean {
  return REASONING_MODELS.some(reasoningModel =>
    model.includes(reasoningModel)
  );
}

/**
 * Add thinking configuration to request parameters for reasoning models
 */
export function addThinkingConfiguration(params: any): any {
  // Only add thinking config if model supports reasoning
  if (!supportsAnthropicReasoning(params.model)) {
    return params;
  }

  return {
    ...params,
    thinking: {
      type: 'enabled',
      budget_tokens: DEFAULT_THINKING_BUDGET
    }
  };
}

/**
 * Interface for reasoning support callbacks
 */
export interface ReasoningCallbacks {
  onReasoningStart?: () => void;
  onReasoningUpdate?: (text: string) => void;
  onReasoningComplete?: () => void;
}

/**
 * Reasoning support manager for a specific conversation
 */
export class AnthropicReasoningSupport {
  private convId: string;
  private model: string;
  private windowId: string | null = null;
  private panelId: string | null = null;
  private callbacks: ReasoningCallbacks;

  constructor(convId: string, model: string, callbacks: ReasoningCallbacks = {}) {
    this.convId = convId;
    this.model = model;
    this.callbacks = callbacks;
  }

  /**
   * Start a reasoning session
   */
  startReasoning(): void {
    if (!supportsAnthropicReasoning(this.model)) {
      console.warn('Model does not support reasoning:', this.model);
      return;
    }

    // Create reasoning window if not exists
    if (!this.windowId) {
      this.windowId = createReasoningWindow(this.convId, this.model);
    }

    // Create reasoning panel
    this.panelId = startReasoningPanel('text', this.convId, this.windowId);

    console.log('Started Anthropic reasoning session:', {
      convId: this.convId,
      model: this.model,
      windowId: this.windowId,
      panelId: this.panelId
    });

    this.callbacks.onReasoningStart?.();
  }

  /**
   * Update reasoning text
   */
  updateReasoning(text: string): void {
    if (!this.panelId) {
      console.warn('No active reasoning panel to update');
      return;
    }

    setReasoningText(this.panelId, text);
    this.callbacks.onReasoningUpdate?.(text);
  }

  /**
   * Complete the reasoning session
   */
  completeReasoning(): void {
    if (!this.panelId) {
      console.warn('No active reasoning panel to complete');
      return;
    }

    completeReasoningPanel(this.panelId);

    console.log('Completed Anthropic reasoning session:', {
      convId: this.convId,
      panelId: this.panelId
    });

    this.callbacks.onReasoningComplete?.();

    // Reset for next reasoning session
    this.panelId = null;
  }

  /**
   * Check if reasoning is currently active
   */
  get isActive(): boolean {
    return this.panelId !== null;
  }

  /**
   * Get the reasoning window ID
   */
  get reasoningWindowId(): string | null {
    return this.windowId;
  }
}

/**
 * Factory function to create reasoning support for a conversation
 */
export function createAnthropicReasoningSupport(options: {
  convId: string;
  model: string;
  callbacks?: ReasoningCallbacks;
}): AnthropicReasoningSupport {
  return new AnthropicReasoningSupport(
    options.convId,
    options.model,
    options.callbacks || {}
  );
}

/**
 * Configure thinking budget (for settings integration)
 */
let customThinkingBudget: number | null = null;

export function setThinkingBudget(budget: number): void {
  if (budget < 1024) {
    throw new Error('Thinking budget must be at least 1024 tokens');
  }
  customThinkingBudget = budget;
}

export function getThinkingBudget(): number {
  return customThinkingBudget || DEFAULT_THINKING_BUDGET;
}

/**
 * Add thinking configuration with custom budget
 */
export function addThinkingConfigurationWithBudget(params: any, budget?: number): any {
  if (!supportsAnthropicReasoning(params.model)) {
    return params;
  }

  const thinkingBudget = budget || getThinkingBudget();

  return {
    ...params,
    thinking: {
      type: 'enabled',
      budget_tokens: thinkingBudget
    }
  };
}