// Mock for idb.js - used in tests
const audioStore = new Map();

export async function saveAudioBlob(id, blob, conversationId) {
  audioStore.set(id, { blob, conversationId });
  return Promise.resolve();
}

export async function getAudioBlob(id) {
  const item = audioStore.get(id);
  return item ? item.blob : null;
}

export async function deleteAudioBlob(id) {
  audioStore.delete(id);
  return Promise.resolve();
}

export async function clearAudioStore() {
  audioStore.clear();
  return Promise.resolve();
}

export async function clearAllAudioBlobs() {
  audioStore.clear();
  return Promise.resolve();
}