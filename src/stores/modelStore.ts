import { writable, type Writable } from 'svelte/store';

const MODELS_LS_KEY = 'models';

function loadFromLocalStorage(): any[] {
  try {
    const raw = localStorage.getItem(MODELS_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const modelsStore: Writable<any[]> = writable(loadFromLocalStorage());

// Persist to localStorage on changes
modelsStore.subscribe((val) => {
  try {
    localStorage.setItem(MODELS_LS_KEY, JSON.stringify(val || []));
  } catch {
    // ignore persistence errors
  }
});
