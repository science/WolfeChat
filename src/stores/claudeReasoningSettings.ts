/**
 * Claude Reasoning Settings Store
 *
 * Global defaults for Claude/Anthropic extended thinking settings.
 * These are used as fallbacks when per-conversation settings are not specified.
 */

import { writable } from 'svelte/store';

const KEYS = {
  thinkingEnabled: 'claude_thinking_enabled',
};

function readLSBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch {
    return fallback;
  }
}

/**
 * Global default for Claude extended thinking.
 * Default: true (thinking is enabled by default for Claude reasoning models)
 */
export const claudeThinkingEnabled = writable<boolean>(readLSBool(KEYS.thinkingEnabled, true));

// Persist to localStorage on change
claudeThinkingEnabled.subscribe((v) => {
  try {
    localStorage.setItem(KEYS.thinkingEnabled, String(v));
  } catch {}
});
