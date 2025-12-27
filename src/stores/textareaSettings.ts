import { writable } from 'svelte/store';

const DEFAULT_MAX_HEIGHT = 288;
const DEFAULT_MIN_HEIGHT = 96;

// Bounds for validation in UI
export const MAX_HEIGHT_BOUNDS = { min: 100, max: 600 };
export const MIN_HEIGHT_BOUNDS = { min: 32, max: 200 };

const MAX_HEIGHT_KEY = 'textarea_max_height';
const MIN_HEIGHT_KEY = 'textarea_min_height';

function loadNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch (_) {}
  return fallback;
}

export const textareaMaxHeight = writable<number>(
  loadNumber(MAX_HEIGHT_KEY, DEFAULT_MAX_HEIGHT)
);

export const textareaMinHeight = writable<number>(
  loadNumber(MIN_HEIGHT_KEY, DEFAULT_MIN_HEIGHT)
);

// Persist on change
textareaMaxHeight.subscribe((v) => {
  try {
    localStorage.setItem(MAX_HEIGHT_KEY, String(v));
  } catch (_) {}
});

textareaMinHeight.subscribe((v) => {
  try {
    localStorage.setItem(MIN_HEIGHT_KEY, String(v));
  } catch (_) {}
});
