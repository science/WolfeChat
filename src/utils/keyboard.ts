export type EnterBehaviorOption = 'newline' | 'send';

export function shouldSendOnEnter(params: {
  behavior: EnterBehaviorOption;
  isStreaming: boolean;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  const {
    behavior,
    isStreaming,
    key,
    shiftKey,
    ctrlKey,
    metaKey,
  } = params;

  if (isStreaming) return false;
  if (behavior !== 'send') return false;
  if (key !== 'Enter') return false;
  if (shiftKey || ctrlKey || metaKey) return false;

  return true;
}
