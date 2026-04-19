/**
 * Title Generation Store
 *
 * Controls the automatic conversation-title feature:
 *   - `titleGenerationEnabled` — when false, no title is generated, the
 *     sidebar keeps its default "New Conversation" label.
 *   - `titleGenerationModel` — picker value; null means "use the
 *     conversation's currently selected model".
 *
 * Reasoning is always forced off for title generation regardless of the
 * chosen model (see getTitleReasoningOptions in src/lib/titleModelUtils.ts).
 */

import { writable } from 'svelte/store';

function readLS<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

/**
 * Whether the app generates a title automatically after the first exchange.
 * Default: true (matches existing product behaviour).
 */
export const titleGenerationEnabled = writable<boolean>(readLS('title_generation_enabled', true));
titleGenerationEnabled.subscribe(v => {
  try {
    localStorage.setItem('title_generation_enabled', JSON.stringify(v));
  } catch {}
});

/**
 * Explicit title model. null means "use the conversation's model".
 */
export const titleGenerationModel = writable<string | null>(readLS('title_generation_model', null));
titleGenerationModel.subscribe(v => {
  try {
    localStorage.setItem('title_generation_model', JSON.stringify(v));
  } catch {}
});
