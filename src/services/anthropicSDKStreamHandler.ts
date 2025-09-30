/**
 * Anthropic SDK Stream Handler
 *
 * Handles streaming events from the Anthropic SDK
 * Processes different event types and manages reasoning/thinking blocks
 */

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onReasoningStart?: () => void;
  onReasoningDelta?: (text: string) => void;
  onReasoningComplete?: () => void;
  onCompleted?: () => void;
  onError?: (error: Error) => void;
}

export interface StreamEvent {
  type: string;
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: string;
    text?: string;
  };
  index?: number;
  message?: any;
}

export class AnthropicSDKStreamHandler {
  private callbacks: StreamCallbacks;
  private contentBlocks: Map<number, { type: string; text: string }> = new Map();
  private isReasoningActive = false;

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle a streaming event from the SDK
   */
  handleEvent(event: StreamEvent): void {
    try {
      switch (event.type) {
        case 'message_start':
          this.handleMessageStart(event);
          break;

        case 'content_block_start':
          this.handleContentBlockStart(event);
          break;

        case 'content_block_delta':
          this.handleContentBlockDelta(event);
          break;

        case 'content_block_stop':
          this.handleContentBlockStop(event);
          break;

        case 'message_delta':
          this.handleMessageDelta(event);
          break;

        case 'message_stop':
          this.handleMessageStop(event);
          break;

        default:
          console.warn('Unknown stream event type:', event.type);
      }
    } catch (error) {
      console.error('Error handling stream event:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleMessageStart(event: StreamEvent): void {
    // Initialize for new message
    this.contentBlocks.clear();
    this.isReasoningActive = false;
  }

  private handleContentBlockStart(event: StreamEvent): void {
    const index = event.index ?? 0;
    const blockType = event.content_block?.type || 'text';

    // Initialize content block
    this.contentBlocks.set(index, { type: blockType, text: '' });

    // Handle reasoning/thinking blocks
    if (blockType === 'thinking') {
      this.isReasoningActive = true;
      this.callbacks.onReasoningStart?.();
    }
  }

  private handleContentBlockDelta(event: StreamEvent): void {
    const index = event.index ?? 0;
    const deltaType = event.delta?.type;
    const deltaText = event.delta?.text || '';

    const block = this.contentBlocks.get(index);
    if (!block) {
      console.warn('Received delta for unknown content block:', index);
      return;
    }

    // Accumulate text
    block.text += deltaText;

    // Handle different delta types
    if (deltaType === 'text_delta') {
      // Regular text content
      this.callbacks.onTextDelta?.(deltaText);
    } else if (deltaType === 'thinking_delta') {
      // Thinking/reasoning content
      this.callbacks.onReasoningDelta?.(deltaText);
    } else {
      // Fallback for other delta types
      if (block.type === 'thinking') {
        this.callbacks.onReasoningDelta?.(deltaText);
      } else {
        this.callbacks.onTextDelta?.(deltaText);
      }
    }
  }

  private handleContentBlockStop(event: StreamEvent): void {
    const index = event.index ?? 0;
    const block = this.contentBlocks.get(index);

    if (!block) {
      console.warn('Received stop for unknown content block:', index);
      return;
    }

    // Handle reasoning completion
    if (block.type === 'thinking') {
      this.isReasoningActive = false;
      this.callbacks.onReasoningComplete?.();
    }
  }

  private handleMessageDelta(event: StreamEvent): void {
    // Handle message-level changes if needed
    // This could include usage updates, model changes, etc.
  }

  private handleMessageStop(event: StreamEvent): void {
    // Message is complete
    this.callbacks.onCompleted?.();

    // Clean up
    this.contentBlocks.clear();
    this.isReasoningActive = false;
  }

  /**
   * Get accumulated text for a content block
   */
  getContentBlockText(index: number): string {
    return this.contentBlocks.get(index)?.text || '';
  }

  /**
   * Get all accumulated text from all content blocks
   */
  getAllText(): string {
    return Array.from(this.contentBlocks.values())
      .filter(block => block.type !== 'thinking') // Exclude thinking blocks from final text
      .map(block => block.text)
      .join('');
  }

  /**
   * Get all reasoning text from thinking blocks
   */
  getReasoningText(): string {
    return Array.from(this.contentBlocks.values())
      .filter(block => block.type === 'thinking')
      .map(block => block.text)
      .join('');
  }

  /**
   * Check if reasoning is currently active
   */
  get isReasoning(): boolean {
    return this.isReasoningActive;
  }
}