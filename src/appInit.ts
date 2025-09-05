// appInit.ts
import { initOpenAIApi } from "./services/openaiService.js";
import { clearAllAudioBlobs } from './idb.js';
import { apiKey, base64Images } from "./stores/stores.js";
import { conversations, chosenConversationId, settingsVisible } from "./stores/stores.js";
import { get, writable } from "svelte/store";

// Function to set the app height for mobile viewport issues
function setAppHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-height', `${vh}px`);
}

// Expose minimal, test-only hooks for E2E during non-production builds
function installTestHooks() {
  try {
    // @ts-ignore env injected by Vite
    const mode = (import.meta as any)?.env?.MODE || process.env.NODE_ENV;
    if (mode === 'production') return;

    const w = window as any;
    w.__wolfeTest = w.__wolfeTest || {};

    // Seed conversations and active index quickly without UI
    w.__wolfeTest.setConversations = (convs: any[], activeIdx: number = 0) => {
      if (!Array.isArray(convs)) return false;
      conversations.set(convs);
      chosenConversationId.set(activeIdx);
      return true;
    };

    // Optionally expose stores for diagnostics
    w.wolfeStores = { conversations, chosenConversationId };
  } catch (e) {
    console.warn('Failed to install test hooks', e);
  }
}

// Initialization function for the app
export async function initApp() {

    if (get(conversations).length > 0) {
      chosenConversationId.set(get(conversations).length - 1);
    }

  // Set the app height
  setAppHeight();

  // Add event listener to reset app height on resize
  window.addEventListener('resize', setAppHeight);

  // Install test hooks (no-op in production)
  installTestHooks();

  // Clear all audio blobs from IndexedDB on init
  try {
    await clearAllAudioBlobs();
  } catch (error) {
    console.error('Failed to clear audio blobs:', error);
  }
  base64Images.set([]);
  // Initialize OpenAI service with API key from store
  apiKey.subscribe((value) => {
    if (value) {
      initOpenAIApi();
    }
  });

  // Additional initialization logic can go here
}

// Function to perform any cleanup on app unload or similar scenarios
export function cleanupApp() {
  window.removeEventListener('resize', setAppHeight);
  // Any additional cleanup logic can go here
}
