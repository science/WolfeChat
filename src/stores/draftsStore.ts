import { writable, get } from 'svelte/store';

interface DraftsStore {
  setDraft: (conversationId: string, draft: string) => void;
  getDraft: (conversationId: string) => string;
  deleteDraft: (conversationId: string) => void;
  clearAllDrafts: () => void;
}

export function createDraftsStore(): DraftsStore {
  const drafts = writable<Record<string, string>>({});

  return {
    setDraft: (conversationId: string, draft: string) => {
      drafts.update(store => ({
        ...store,
        [conversationId]: draft
      }));
    },

    getDraft: (conversationId: string): string => {
      const currentDrafts = get(drafts);
      return currentDrafts[conversationId] || '';
    },

    deleteDraft: (conversationId: string) => {
      drafts.update(store => {
        const newStore = { ...store };
        delete newStore[conversationId];
        return newStore;
      });
    },

    clearAllDrafts: () => {
      drafts.set({});
    }
  };
}

// Export a global instance for app usage
export const draftsStore = createDraftsStore();