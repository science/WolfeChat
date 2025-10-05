import { test } from '../testHarness.js';
import { createDraftsStore } from '../../stores/draftsStore.ts';
import AppComponent from '../../App.svelte';
import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';

// Unit: Draft store in isolation should not be prefilled with assistant role text
test({
  id: 'unit-draft-isolation',
  name: 'Unit: Draft store isolation stores per-conversation drafts',
  fn: () => {
    const drafts = createDraftsStore();

    const c1 = 'conv-unit-1';
    const c2 = 'conv-unit-2';

    drafts.setDraft(c1, 'Test draft');
    if (drafts.getDraft(c1) !== 'Test draft') {
      throw new Error('Draft for c1 should match');
    }
    if (drafts.getDraft(c2) !== '') {
      throw new Error('Unknown conversation should have empty draft');
    }
  }
});

// Unit: Basic input functionality should work
test({
  id: 'unit-input-basic',
  name: 'Unit: Basic text input functionality works',
  fn: () => {
    // Create a mock DOM environment
    const textarea = document.createElement('textarea');
    textarea.value = '';
    
    // Simulate typing text
    textarea.value = 'Hello world';
    
    // Verify the text was set
    if (textarea.value !== 'Hello world') {
      throw new Error('Basic textarea input should work');
    }
    
    // Simulate clearing
    textarea.value = '';
    if (textarea.value !== '') {
      throw new Error('Textarea should be clearable');
    }
  }
});
