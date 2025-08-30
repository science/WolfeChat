import { test } from '../testHarness.js';
import { createDraftsStore } from '../../stores/draftsStore.js';

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
