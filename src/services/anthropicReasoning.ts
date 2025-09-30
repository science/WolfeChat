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
import {
  supportsReasoning as modelSupportsReasoning,
  getThinkingBudget as getModelThinkingBudget
} from './anthropicModelConfig.js';

/**
 * Check if a Claude model supports reasoning/extended thinking
 *
 * Now uses the centralized model configuration system instead of hardcoded lists
 */
export function supportsAnthropicReasoning(model: string): boolean {
  return modelSupportsReasoning(model);
}

/**
 * Add thinking configuration to request parameters for reasoning models
 *
 * Now uses model-specific thinking budget from model configuration
 */
export function addThinkingConfiguration(params: any): any {
  // Only add thinking config if model supports reasoning
  if (!supportsAnthropicReasoning(params.model)) {
    return params;
  }

  const thinkingBudget = getModelThinkingBudget(params.model);

  // Only add thinking if budget > 0
  if (thinkingBudget === 0) {
    return params;
  }

  return {
    ...params,
    thinking: {
      type: 'enabled',
      budget_tokens: thinkingBudget
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
  private anchorIndex?: number;
  private windowId: string | null = null;
  private panelId: string | null = null;
  private callbacks: ReasoningCallbacks;

  constructor(convId: string, model: string, anchorIndex?: number, callbacks: ReasoningCallbacks = {}) {
    this.convId = convId;
    this.model = model;
    this.anchorIndex = anchorIndex;
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
      this.windowId = createReasoningWindow(this.convId, this.model, this.anchorIndex);
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
  anchorIndex?: number;
  callbacks?: ReasoningCallbacks;
}): AnthropicReasoningSupport {
  return new AnthropicReasoningSupport(
    options.convId,
    options.model,
    options.anchorIndex,
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

export function getThinkingBudget(model?: string): number {
  if (customThinkingBudget) {
    return customThinkingBudget;
  }

  // If model is provided, get model-specific budget
  if (model) {
    return getModelThinkingBudget(model); // Use imported function from modelConfig
  }

  // Fallback to a reasonable default
  return 8000;
}

/**
 * Add thinking configuration with custom budget
 *
 * Now uses model-specific thinking budget when no custom budget is provided
 */
export function addThinkingConfigurationWithBudget(params: any, customBudget?: number): any {
  if (!supportsAnthropicReasoning(params.model)) {
    return params;
  }

  // Use custom budget if provided, otherwise get model-specific budget
  const thinkingBudget = customBudget || getModelThinkingBudget(params.model);

  // Only add thinking if budget > 0
  if (thinkingBudget === 0) {
    return params;
  }

  return {
    ...params,
    thinking: {
      type: 'enabled',
      budget_tokens: thinkingBudget
    }
  };
}