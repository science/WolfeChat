import { writable, get, type Writable } from 'svelte/store';
import { modelsStore } from './modelStore.js';

const RECENT_MODELS_LS_KEY = 'recent_models';
const MAX_RECENT = 5;

function loadFromLocalStorage(): any[] {
  try {
    const raw = localStorage.getItem(RECENT_MODELS_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const recentModelsStore: Writable<any[]> = writable(loadFromLocalStorage());

// Persist to localStorage on changes
recentModelsStore.subscribe((val) => {
  try {
    localStorage.setItem(RECENT_MODELS_LS_KEY, JSON.stringify(val || []));
  } catch {
    // ignore persistence errors
  }
});

/**
 * Add a model to the recent list (most-recent first), de-duplicated, capped to MAX_RECENT.
 * Accepts a model id, looks up the object in modelsStore if available.
 */
export function addRecentModel(modelId: string) {
  if (!modelId) return;

  const allModels = get(modelsStore) || [];
  const existingObj = allModels.find((m: any) => m?.id === modelId);
  const toInsert = existingObj || { id: modelId };

  recentModelsStore.update((current: any[]) => {
    const withoutDup = (current || []).filter((m: any) => m?.id !== modelId);
    return [toInsert, ...withoutDup].slice(0, MAX_RECENT);
  });
}

export function clearRecentModels() {
  recentModelsStore.set([]);
}
