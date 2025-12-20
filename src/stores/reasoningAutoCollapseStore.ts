/**
 * Reasoning Auto-Collapse Store
 *
 * Controls whether reasoning windows automatically collapse when
 * the model finishes its response.
 *
 * - true (default): reasoning windows collapse when response completes
 * - false: reasoning windows stay open after response completes
 *
 * This is a global setting that applies to all conversations.
 */

import { writable } from 'svelte/store';

const STORAGE_KEY = 'reasoning_auto_collapse';

function loadInitial(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'false') return false;
    if (v === 'true') return true;
  } catch (_) {}
  // Default to true (current behavior - auto-collapse)
  return true;
}

export const reasoningAutoCollapse = writable<boolean>(loadInitial());

// Persist on change
reasoningAutoCollapse.subscribe((v) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch (_) {}
});
