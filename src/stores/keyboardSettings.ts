import { writable } from 'svelte/store';

export type EnterBehaviorOption = 'newline' | 'send';

const STORAGE_KEY = 'enterBehavior';
function loadInitial(): EnterBehaviorOption {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'send' || v === 'newline') return v;
  } catch (_) {}
  return 'newline';
}

export const enterBehavior = writable<EnterBehaviorOption>(loadInitial());

// Persist on change
enterBehavior.subscribe((v) => {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch (_) {}
});
