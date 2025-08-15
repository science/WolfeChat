import { writable } from 'svelte/store';

const KEYS = {
  effort: 'reasoning_effort',
  verbosity: 'reasoning_verbosity',
  summary: 'reasoning_summary',
};

function readLS(key: string, fallback: string) {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export const reasoningEffort = writable<string>(readLS(KEYS.effort, 'medium')); // minimal | low | medium | high
export const verbosity = writable<string>(readLS(KEYS.verbosity, 'medium'));    // low | medium | high
export const summary = writable<string>(readLS(KEYS.summary, 'auto'));          // auto | detailed | null

reasoningEffort.subscribe((v) => { try { localStorage.setItem(KEYS.effort, v); } catch {} });
verbosity.subscribe((v) => { try { localStorage.setItem(KEYS.verbosity, v); } catch {} });
summary.subscribe((v) => { try { localStorage.setItem(KEYS.summary, v); } catch {} });
