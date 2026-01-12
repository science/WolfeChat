<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SvelteMarkdown from 'svelte-markdown';
  import EditIcon from '../assets/edit.svg';
  import DeleteIcon from '../assets/delete.svg';
  import type { ChatMessage } from '../stores/stores.js';
  import { countShadowedMessages } from '../lib/summaryUtils.js';
  import { getSummaryBackgroundClasses } from '../lib/summaryStyleUtils.js';

  export let message: ChatMessage;
  export let messageIndex: number;
  export let history: ChatMessage[];
  export let isEditing: boolean = false;

  const dispatch = createEventDispatcher();

  let editContent: string = '';

  $: shadowedCount = countShadowedMessages(history, messageIndex);
  $: isActive = message.summaryActive !== false;
  $: isLoading = message.summaryLoading === true;
  $: backgroundClasses = getSummaryBackgroundClasses(isLoading);

  function handleToggle() {
    dispatch('toggle', { index: messageIndex });
  }

  function handleEdit() {
    editContent = message.content;
    dispatch('startEdit', { index: messageIndex });
  }

  function handleSave() {
    dispatch('saveEdit', { index: messageIndex, content: editContent });
  }

  function handleCancel() {
    dispatch('cancelEdit');
  }

  function handleDelete() {
    dispatch('delete', { index: messageIndex });
  }
</script>

<div
  class="summary-message relative {backgroundClasses}"
  role="listitem"
  aria-label="Conversation summary"
  data-testid="summary-message"
  data-message-index={messageIndex}
  data-summary-active={isActive}
  data-summary-loading={isLoading}
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-3" data-testid="summary-header">
    <div class="flex items-center space-x-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6h16"/>
        <path d="M4 10h16"/>
        <path d="M4 14h10"/>
        <path d="M8 18h8"/>
      </svg>
      <span class="font-bold text-indigo-300">Summary</span>
      {#if message.model}
        <span class="text-sm text-gray-400" data-testid="summary-model">({message.model})</span>
      {/if}
      <span class="text-sm text-gray-400" data-testid="summary-message-count">
        {shadowedCount} message{shadowedCount !== 1 ? 's' : ''}
      </span>
    </div>

    <div class="flex items-center space-x-2">
      <!-- Active toggle checkbox (disabled while loading) -->
      <label class="flex items-center space-x-2 {isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
        <input
          type="checkbox"
          checked={isActive}
          disabled={isLoading}
          on:change={handleToggle}
          class="form-checkbox h-4 w-4 text-indigo-500 rounded border-gray-600 bg-gray-700 focus:ring-indigo-500 disabled:opacity-50"
          aria-label="Use summary instead of original messages"
        />
        <span class="text-sm text-gray-300">Use summary</span>
      </label>
    </div>
  </div>

  <!-- Loading/Streaming state -->
  {#if isLoading}
    <div data-testid="summary-loading">
      <!-- Show streaming content as it arrives -->
      {#if message.content}
        <div
          class="text-gray-200 prose prose-invert prose-sm max-w-none mb-3"
          data-testid="summary-content-streaming"
        >
          <SvelteMarkdown source={message.content + '█'} />
        </div>
      {/if}
      <!-- Loading indicator -->
      <div class="flex items-center space-x-2 text-gray-400">
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm">{message.content ? 'Generating...' : 'Generating summary...'}</span>
      </div>
    </div>
  {:else if isEditing}
    <!-- Edit mode -->
    <div class="space-y-3">
      <textarea
        bind:value={editContent}
        class="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[100px]"
        data-testid="summary-edit-textarea"
        placeholder="Edit summary content..."
      ></textarea>
      <div class="flex justify-end space-x-2">
        <button
          on:click={handleCancel}
          class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Cancel
        </button>
        <button
          on:click={handleSave}
          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm"
          aria-label="Save summary"
        >
          Save
        </button>
      </div>
    </div>
  {:else}
    <!-- Display mode -->
    <div
      class="text-gray-200 prose prose-invert prose-sm max-w-none {!isActive ? 'opacity-50' : ''}"
      data-testid="summary-content"
    >
      <SvelteMarkdown source={message.content} />
    </div>

    <!-- Toolbelt -->
    <div class="flex space-x-2 mt-3 pt-2 border-t border-gray-700/50">
      <button
        class="p-1 hover:bg-gray-700 rounded"
        title="Edit summary"
        aria-label="Edit summary"
        on:click={handleEdit}
      >
        <img class="summary-toolbelt-icon w-4 h-4" src={EditIcon} alt="Edit" />
      </button>
      <button
        class="p-1 hover:bg-gray-700 rounded"
        title="Delete summary"
        aria-label="Delete summary"
        on:click={handleDelete}
      >
        <img class="summary-toolbelt-icon w-4 h-4" src={DeleteIcon} alt="Delete" />
      </button>
    </div>
  {/if}

  <!-- Inactive indicator -->
  {#if !isActive}
    <div class="absolute top-2 right-2 text-xs text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded">
      Inactive
    </div>
  {/if}
</div>
