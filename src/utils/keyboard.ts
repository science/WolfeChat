export type EnterBehaviorOption = 'newline' | 'send';

export function shouldSendOnEnter(params: {
  behavior: EnterBehaviorOption;
  isStreaming: boolean;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  const { behavior, isStreaming, key, shiftKey, ctrlKey, metaKey } = params;

  // Do not send while streaming or when it's not the Enter key
  if (isStreaming) return false;
  if (key !== 'Enter') return false;

  // Shift+Enter always inserts a newline
  if (shiftKey) return false;

  // Ctrl+Enter sends, as long as no other modifiers are pressed
  if (ctrlKey) {
    if (metaKey) return false;
    return true;
  }

  // Regular Enter respects the behavior and only sends when behavior is 'send'
  if (metaKey) return false;
  return behavior === 'send';
}
