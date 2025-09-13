<script lang="ts">
  import { onMount, onDestroy } from 'svelte';  
  import { initApp, cleanupApp } from './appInit.js';
  import AudioPlayer from './lib/AudioPlayer.svelte';
  import Topbar from "./lib/Topbar.svelte";
  import Sidebar from "./lib/Sidebar.svelte";
  import Settings from "./lib/Settings.svelte";
  import Help from "./lib/Help.svelte";
  import SvelteMarkdown from "svelte-markdown";
  import CodeRenderer from "./renderers/Code.svelte";
  import UserCodeRenderer from "./renderers/userCode.svelte";
  import EmRenderer from "./renderers/Em.svelte";
  import ListRenderer from "./renderers/ListRenderer.svelte";
  import ListItemRenderer from "./renderers/ListItem.svelte";
  import CodeSpanRenderer from "./renderers/CodeSpan.svelte";
  import ParagraphRenderer from "./renderers/Paragraph.svelte";
  import HtmlRenderer from "./renderers/Html.svelte";
  import DeleteIcon from "./assets/delete.svg";
  import DeleteBelowIcon from "./assets/deleteBelow.svg";
  import CopyIcon from "./assets/CopyIcon.svg"; 
  import UserIcon from "./assets/UserIcon.svg"; 
  import RobotIcon from "./assets/RobotIcon.svg"; 
  import MoreIcon from "./assets/more.svg";
  import EditIcon from "./assets/edit.svg";
  import SendIcon from "./assets/send.svg";
  import WaitIcon from "./assets/wait.svg"; 
  import  UploadIcon from "./assets/upload-icon.svg";
  import { afterUpdate } from "svelte";
  import { conversations, chosenConversationId, settingsVisible, helpVisible, debugVisible, clearFileInputSignal } from "./stores/stores.js";
  import { isAudioMessage, formatMessageForMarkdown } from "./utils/generalUtils.js";
  import { routeMessage, newChat, deleteMessageFromConversation, deleteAllMessagesBelow } from "./managers/conversationManager.js";
  import { copyTextToClipboard } from './utils/generalUtils.js';
  import { selectedModel, selectedVoice, selectedMode, isStreaming } from './stores/stores.js';
  import { addRecentModel } from './stores/recentModelsStore.js';
  import { reloadConfig } from './services/openaiService.js';
  import { handleImageUpload, onSendVisionMessageComplete } from './managers/imageManager.js';
  import { base64Images } from './stores/stores.js';
  import { closeStream } from './services/openaiService.js';  
  import DebugPanel from './lib/DebugPanel.svelte';
  import ReasoningInline from './lib/ReasoningInline.svelte';
  import QuickSettings from './lib/QuickSettings.svelte';
  import { ScrollMemory } from './utils/scrollState.js';
  import { enterBehavior } from './stores/keyboardSettings.js';
  import { shouldSendOnEnter } from './utils/keyboard.js';
  import { draftsStore } from './stores/draftsStore.js';

  let fileInputElement; 
  let input: string = "";
  let textAreaElement; 
  let editTextArea;
  let updatingInputFromDraft = false; 


  let chatContainer: HTMLElement;
  let moreButtonsToggle: boolean = false;
  let conversationTitle = "";

  let editingMessageId: number | null = null;
  let editingMessageContent: string = "";

  const scrollMem = new ScrollMemory();
  $: scrollMem.setSuspended($isStreaming);
  let lastConvId: number | null = null;

  $: if ($clearFileInputSignal && fileInputElement) {
    fileInputElement.value = '';
    clearFileInputSignal.set(false); // Reset the signal
  }


  // Handle conversation switching without circular reactive updates
  function handleConversationSwitch(newConvId: number | null, oldConvId: number | null) {
    const currentConversations = $conversations;

    // Enhanced draft saving with additional safety checks
    if (oldConvId !== null && oldConvId !== newConvId && currentConversations[oldConvId]) {
      // Only save if input is not empty and not already being updated from draft
      if (!updatingInputFromDraft && input.trim() !== '') {
        draftsStore.setDraft(currentConversations[oldConvId].id, input);
      }
    }

    if (newConvId !== undefined && newConvId !== null && currentConversations[newConvId]) {
      // Load draft for new conversation
      const conversationDraft = draftsStore.getDraft(currentConversations[newConvId].id);
      updatingInputFromDraft = true;
      input = conversationDraft;
      updatingInputFromDraft = false;
    }
  }

  $: {
    const currentConversationId = $chosenConversationId;
    const currentConversations = $conversations;
    const totalConversations = $conversations.length;

    if (currentConversationId !== undefined && currentConversations[currentConversationId]) {
      conversationTitle = currentConversations[currentConversationId].title || "New Conversation";
    }
    
    if (currentConversationId === undefined || currentConversationId === null || currentConversationId < 0 || currentConversationId >= totalConversations) {
      console.log("changing conversation from ID", $chosenConversationId);
      chosenConversationId.set(totalConversations > 0 ? totalConversations - 1 : null);
      console.log("to ID", $chosenConversationId);
    }
    
    // Handle conversation switching only when the conversation actually changes
    if (lastConvId !== currentConversationId) {
      handleConversationSwitch(currentConversationId, lastConvId);
      lastConvId = currentConversationId;
    }
  }

  // Save draft when input changes (but not when we're loading from draft)
  let draftSaveTimer: number | null = null;
  $: {
    if (!updatingInputFromDraft &&
        $chosenConversationId !== undefined &&
        $conversations[$chosenConversationId] &&
        input !== undefined &&
        input.trim() !== '') { // Only save non-empty drafts
      // Cancel previous timer
      if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
      }
      // Save draft after a short delay to avoid interfering with rapid typing
      draftSaveTimer = setTimeout(() => {
        draftsStore.setDraft($conversations[$chosenConversationId].id, input);
        draftSaveTimer = null;
      }, 300);
    }
  }

function clearFiles() {  
    base64Images.set([]); // Assuming this is a writable store tracking uploaded images  
  }  
  
  let chatContainerObserver: MutationObserver | null = null;  
  
  function setupMutationObserver() {    
    if (!chatContainer) return; // Ensure chatContainer is mounted  
  
    const config = { childList: true, subtree: true, characterData: true };  
  
    chatContainerObserver = new MutationObserver((mutationsList, observer) => {  
      // Trigger scroll if any relevant mutations observed  
      // Disabled scroll to end of chat
      // scrollChatToEnd();  
      // Maintain per-conversation scroll ratio after DOM mutations
      scrollMem.restoreCurrentAfterFrame();
    });  
  
    chatContainerObserver.observe(chatContainer, config);    
  }  

  onMount(async () => {
    await initApp();

    // Ensure at least one conversation exists for tests
    if ($conversations.length === 0) {
      newChat();
    }

    // Attach scroll memory to chat container and initialize for current conversation
    if (chatContainer) {
      scrollMem.attach(chatContainer);
      scrollMem.setActiveKey($chosenConversationId != null ? String($chosenConversationId) : null);
      scrollMem.restoreCurrentAfterFrame();
      lastConvId = $chosenConversationId;
    }
    
    // Setup MutationObserver after app initialization and component mounting  
    setupMutationObserver();
    
    // Make drafts available globally for e2e tests
    (window as any).drafts = draftsStore;
    (window as any).conversations = $conversations;
    (window as any).chosenConversationId = $chosenConversationId;
  });  
  
  onDestroy(() => {  
    // Clean up MutationObserver when component is destroyed to prevent memory leaks  
    if (chatContainerObserver) {  
      chatContainerObserver.disconnect();  
      chatContainerObserver = null;  
    }  
    // Detach scroll memory
    scrollMem.detach();
    // Clean up app-specific resources  
    cleanupApp();  
  });

  // Keep window references updated when stores change for e2e tests
  $: if (typeof window !== 'undefined') {
    (window as any).conversations = $conversations;
    (window as any).chosenConversationId = $chosenConversationId;
  }

  function scrollChatToEnd() {    
  if (chatContainer) {    
    const threshold = 150; // How close to the bottom (in pixels) to trigger auto-scroll  
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - threshold <= chatContainer.clientHeight;  
        
    if (isNearBottom) {    
      chatContainer.scrollTop = chatContainer.scrollHeight;    
    }    
  }    
}  

const textMaxHeight = 300; // Maximum height in pixels

function autoExpand(event) {
    event.target.style.height = 'inherit'; // Reset the height
    const computed = window.getComputedStyle(event.target);
    // Calculate the height
    const height = parseInt(computed.getPropertyValue('border-top-width'), 10)
                 + event.target.scrollHeight
                 + parseInt(computed.getPropertyValue('border-bottom-width'), 10);

                 event.target.style.height = `${Math.min(height, textMaxHeight)}px`; // Apply the smaller of the calculated height or maxHeight
  }

  function processMessage() {
    let convId = $chosenConversationId;
    routeMessage(input, convId);
    input = ""; 
    // Clear the draft since message was sent
    if ($conversations[convId]) {
      draftsStore.setDraft($conversations[convId].id, "");
    }
    clearFiles ();
    textAreaElement.style.height = '96px'; // Reset the height after sending
  }
  function scrollChat() {
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  let lastMessageCount = 0; 
  afterUpdate(() => {
    const currentMessageCount = $conversations[$chosenConversationId]?.history.length || 0;
    if (currentMessageCount > lastMessageCount) {
      // disable scroll to bottom on update
      // scrollChat();
      // Ensure we re-apply saved ratio when content grows
      scrollMem.restoreCurrentAfterFrame();
    }
    lastMessageCount = currentMessageCount; // Update the count after every update
  });

  // Restore per-conversation scroll position when switching chats
  afterUpdate(() => {
    if ($chosenConversationId !== lastConvId) {
      scrollMem.setActiveKey($chosenConversationId != null ? String($chosenConversationId) : null);
      scrollMem.restoreCurrentAfterFrame();
      lastConvId = $chosenConversationId;
    }
  });
  
  $: isVisionMode = $selectedMode.includes('Vision');

$: conversationTitle = $conversations[$chosenConversationId] ? $conversations[$chosenConversationId].title : "ChatGPT";


let uploadedFileCount: number = 0; 
$: uploadedFileCount = $base64Images.length;


function startEditMessage(i: number) {
    editingMessageId = i;
    editingMessageContent = $conversations[$chosenConversationId].history[i].content;
  }

  function cancelEdit() {
    editingMessageId = null;
    editingMessageContent = "";
    editTextArea.style.height = '96px'; // Reset the height when editing is canceled
  }

  function submitEdit(i: number) {
    const editedContent = editingMessageContent; // Temporarily store the edited content
    // Calculate how many messages need to be deleted
    const deleteCount = $conversations[$chosenConversationId].history.length - i;
    // Delete messages from the end to the current one, including itself
    for (let j = 0; j < deleteCount; j++) {
      deleteMessageFromConversation($conversations[$chosenConversationId].history.length - 1);
    }
    // Process the edited message as new input
    let convId = $chosenConversationId;
    routeMessage(editedContent, convId);
    cancelEdit(); // Reset editing state
  }

  function isImageUrl(url) {
    // Ensure the URL has no spaces and matches the domain and specific content type for images
    return !/\s/.test(url) &&
           url.includes('blob.core.windows.net') &&
           /rsct=image\/(jpeg|jpg|gif|png|bmp)/i.test(url);
  }

  /**
   * Handles new chat creation while preserving input drafts.
   * This function ensures the current conversation's draft is saved
   * before creating a new conversation, preventing data loss.
   *
   * Order of operations:
   * 1. Save current input as draft for active conversation
   * 2. Create new conversation (triggers conversation switch)
   * 3. Clear input field (new conversation starts with empty input)
   */
  function handleNewChat() {
    // Save current draft before switching conversations
    const currentConvId = $chosenConversationId;
    const currentConversations = $conversations;

    if (currentConvId !== null && currentConvId !== undefined && currentConversations[currentConvId]) {
      draftsStore.setDraft(currentConversations[currentConvId].id, input);
    }

    // Now create the new chat (this will trigger conversation switching)
    newChat();

    // Clear input only after successful conversation switch
    input = '';
  }

</script>
<svelte:head>
  <title>{$conversations.length > 0 && $conversations[$chosenConversationId] ? ($conversations[$chosenConversationId].title || "WolfeChat") : "WolfeChat"}</title>
</svelte:head>
{#if $settingsVisible}
<Settings on:settings-changed={reloadConfig} />
{/if}
{#if $helpVisible}
<Help />
{/if}

<main class="bg-primary overflow-hidden">
  <Sidebar on:new-chat={handleNewChat} on:clear-chat={() => { input = ''; }} />
    <div class="h-screen flex justify-stretch flex-col md:ml-[260px] bg-secondary text-white/80 height-manager main-content-area">
      <Topbar bind:conversation_title={conversationTitle} on:new-chat={handleNewChat} />
      <div class="py-5 bg-primary px-5 flex flex-row justify-between flex-wrap-reverse">
        
      <QuickSettings on:input-cleared={() => { input = ''; }} />
      </div>
      <div class="flex bg-primary overflow-y-auto overflow-x-hidden justify-center grow" data-testid="chat-scroll-container" bind:this={chatContainer}>
      {#if $conversations.length > 0 && $conversations[$chosenConversationId]}
        <div class="flex flex-col max-w-3xl pt-5 grow" role="list" aria-label="Conversation messages" data-history-total={$conversations[$chosenConversationId].history.length} data-non-system-count={$conversations[$chosenConversationId].history.filter(m => m.role !== 'system').length}>
          
          <div>
        {#each $conversations[$chosenConversationId].history as message, i}

        {#if message.role !=='system'}

          <div class="message relative inline-block bg-primary px-2 pb-5 flex flex-col" role="listitem" aria-label={message.role === 'assistant' ? 'Assistant message' : message.role === 'user' ? 'User message' : undefined} data-message-index={i} data-message-role={message.role} data-testid={message.role === 'assistant' ? 'assistant-message' : message.role === 'user' ? 'user-message' : undefined}>
            <div class="profile-picture flex">
              <div>
                <img src={message.role === 'user' ? UserIcon : RobotIcon} alt="Profile" class="w-6 h-6 ml-10" />
              </div>
              <div class="relative ml-3 font-bold">
                  {#if message.role === 'assistant'}
                    {message.model ? `AI Response (${message.model})` : 'AI Response'}
                  {:else}
                    You
                  {/if}
              </div>
            </div>

            {#if editingMessageId === i}
            <textarea bind:this={editTextArea}
            class="message-edit-textarea mt-2 bg-gray-700 p-3 mx-10 resize-none focus:outline-none rounded-lg"
            bind:value={editingMessageContent}
            on:input={autoExpand}
            style="height: 96px; overflow-y: auto;" 
            ></textarea>
            <div class="flex place-content-center mt-4">
              <button class="submit-edit rounded-lg p-2 mr-2 
              { $isStreaming ? 'bg-gray-500 cursor-not-allowed hover:bg-gray-500' : 'hover:bg-green-500 bg-green-700'}"
                   on:click={() => submitEdit(i)} 
                      disabled={$isStreaming}>Submit</button>
              <button class="cancel-edit bg-gray-700 hover:bg-gray-500 rounded-lg p-2 mr-2" 
                      on:click={() => cancelEdit()}>Cancel</button>
            </div>
            
            {:else}


            <div class="message-display pl-20 pr-5 md:px-20 text-[1rem]">
              {#if isImageUrl(message.content)}
          <img src={message.content} alt="Generated" class="max-w-full h-auto my-3"/>
          <div class="text-sm text-gray-500">
            This image will be available for 60 minutes. Right click + save as!
          </div>
        {:else if isAudioMessage(message)}
          <div class="pb-3">
            <AudioPlayer audioUrl={message.audioUrl} />
          </div>
        {:else}

        {#if message.role === 'assistant' || message.role === 'user'}
                <SvelteMarkdown renderers={{
                  code: CodeRenderer,
                  em: EmRenderer,
                  list: ListRenderer,
                  listitem: ListItemRenderer,
                  paragraph: ParagraphRenderer,
                  html: HtmlRenderer,
                }} source={formatMessageForMarkdown(message.content.toString())} />

{/if}

              {/if}
            </div>
            <div class="toolbelt flex space-x-2 pl-20 mb-2 tools">
              <!-- Moved all the buttons so they apply to all messages -->             
              {#if !isAudioMessage(message) && !isImageUrl(message.content)}
                <button class="copyButton w-5" title="Copy Chat Content" aria-label="Copy Chat Content" on:click={() => copyTextToClipboard(message.content)}>
                  <img class="copy-icon" alt="Copy" src={CopyIcon} title="Copy Chat Content" />
                </button>
              {/if}
              <button class="editButton w-5" title="Edit Chat" aria-label="Edit Chat" on:click={() => startEditMessage(i)}>
                <img class="edit-icon" alt="edit" src={EditIcon} title="Edit Chat" />
              </button>
              <button class="deleteButton w-5" title="Delete this Chat message" aria-label="Delete this Chat message" on:click={() => deleteMessageFromConversation(i)}>
                <img class="delete-icon" alt="Delete" src={DeleteIcon} title="Delete this Chat message" />
              </button>
              {#if i < $conversations[$chosenConversationId].history.length - 1}
                <button class="deleteAllBelowButton w-5" title="Delete all messages below" aria-label="Delete all messages below" on:click={() => deleteAllMessagesBelow(i)}>
                  <img class="delete-all-below-icon" alt="Delete all below" src={DeleteBelowIcon} title="Delete all messages below" />
                </button>
              {/if}
            </div>

            {/if}

            {#if message.role === 'user'}
              <ReasoningInline convId={$conversations[$chosenConversationId]?.id} anchorIndex={i} />
            {/if}

          </div>
{/if}        
        
          {/each}
      </div>
    </div>
      {:else}
        <div class="flex justify-center items-center h-full">
          <p>No conversation selected. Start a new conversation.</p>
        </div>
      {/if}
    </div>


    <div class="inputbox-container w-full flex justify-center items-center bg-primary">

    <div class="inputbox flex flex-1 bg-primary mt-auto mx-auto max-w-3xl mb-3">
      {#if isVisionMode}  
      <input type="file" id="imageUpload" multiple accept="image/*" on:change={handleImageUpload} bind:this={fileInputElement} class="file-input">  
      <label for="imageUpload" class="file-label bg-chat rounded py-2 px-4 mx-1 cursor-pointer hover:bg-hover2 transition-colors">  
        {#if uploadedFileCount > 0}  
          <span class="fileCount">{uploadedFileCount}</span>  
        {:else}  
          <img src={UploadIcon} alt="Upload" class="upload-icon icon-white">  
        {/if} 
      </label>  

      {#if uploadedFileCount > 0}  
      <button on:click={clearFiles} class="clear-btn">X</button>  
    {/if}  


      {/if}

      <textarea bind:this={textAreaElement}  
  class="w-full min-h-[96px] h-24 rounded-lg p-2 mx-1 mr-0 border-t-2 border-b-2 border-l-2 rounded-r-none bg-primary border-gray-500 resize-none focus:outline-none"   
  placeholder="Type your message..."  
  aria-label="Chat input"
  bind:value={input}   
  on:input={autoExpand}
  style="height: 96px; overflow-y: auto; overflow:visible !important;"
  on:keydown={(event) => {
    if (shouldSendOnEnter({
      behavior: $enterBehavior,
      isStreaming: $isStreaming,
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    })) {
      event.preventDefault();
      processMessage();
    }
  }}
></textarea>  
<button class="bg-chat rounded-lg py-2 px-4 mx-1 ml-0 border-t-2 border-b-2 border-r-2  border-gray-500 rounded-l-none cursor-pointer " aria-label="Send" on:click={() => { if ($isStreaming) { closeStream(); } else { processMessage(); } }} disabled={!$isStreaming && !input.trim().length}>    
  {#if $isStreaming}    
      <img class="icon-white min-w-[24px] w-[24px]" alt="Wait" src={WaitIcon} />    
  {:else}    
      <img class="icon-white min-w-[24px] w-[24px]" alt="Send" src={SendIcon} />    
  {/if}    
</button>  
     
    </div>
  </div>

  <!-- Debug Panel - only show in development -->
  {#if $debugVisible}
    <DebugPanel />
  {/if}

  
</div>
</main>

<style>
  @import './app.css';
</style>
