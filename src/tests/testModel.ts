// Centralized test model selection for Wolfechat tests
// Reasoning-capable default model for tests
export const REASONING_MODEL = 'gpt-5-nano';
// Non-reasoning model when tests require a non-reasoning path
export const NON_REASONING_MODEL = 'gpt-3.5-turbo';

export function getReasoningModel(): string {
  return REASONING_MODEL;
}

export function getNonReasoningModel(): string {
  return NON_REASONING_MODEL;
}

export function getTestModel(opts?: { reasoning?: boolean; forceNonReasoning?: boolean }): string {
  if (opts?.forceNonReasoning === true) return NON_REASONING_MODEL;
  if (opts?.reasoning === false) return NON_REASONING_MODEL;
  return REASONING_MODEL;
}
