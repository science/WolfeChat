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

// Initialization function for the app
export async function initApp() {

    if (get(conversations).length > 0) {
      chosenConversationId.set(get(conversations).length - 1);
    }

  // Set the app height
  setAppHeight();

  // Add event listener to reset app height on resize
  window.addEventListener('resize', setAppHeight);

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
