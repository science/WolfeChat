<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    settingsVisible,
    helpVisible,
    debugVisible,
    conversations,
    chosenConversationId,
    menuVisible,
    apiKey,
    defaultAssistantRole,
    type Conversation,
    type DefaultAssistantRole,
    selectedModel,
    showTokens,
  } from "../stores/stores.js";
  import { draftsStore } from "../stores/draftsStore.js";
  import CloseIcon from "../assets/close.svg";
  import NewChat from "../assets/NewChat.svg";
  import EditIcon from "../assets/edit.svg";

  const dispatch = createEventDispatcher();
  let placeholder = `You are a helpful assistant.`;

   import ClearChat from "../assets/ClearChat.svg";

   function newChat() {
    dispatch("new-chat");
  }

   function clearChat() {
    // Create fresh conversation then delete current
    const idx = $chosenConversationId;
    const convs = $conversations;
    const newConv = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, history: [], conversationTokens: 0, assistantRole: convs[idx]?.assistantRole ?? "Don't provide compliments or enthusiastic compliments at the start of your responses. Don't provide offers for follow up at the end of your responses.", title: '' };
    conversations.set([...convs, newConv]);
    chosenConversationId.set($conversations.length); // select newly appended index
    // remove old index
    conversations.set($conversations.filter((_, i) => i !== idx));
    dispatch("clear-chat");
  }

  function openSettings() {
    helpVisible.set(false);
    debugVisible.set(false);
    settingsVisible.set(true);
  }
  function openHelp() {
    settingsVisible.set(false);
    helpVisible.set(true);
    debugVisible.set(false);
  }

  function openDebug() {
    settingsVisible.set(false);
    helpVisible.set(false);
    debugVisible.set(true);
  }

  async function deleteConversation(i: number) {
  console.log("Attempting to delete conversation at index:", i);

  // Check if there's only one conversation in the list
  if ($conversations.length <= 1) {
    console.log("Deletion aborted: Cannot delete the last conversation.");
    return; // Abort deletion if it's the last conversation
  }

  const deleted = $conversations[i];
   let conv = $conversations.filter((value, index) => index !== i);
   console.log("Updated conversations list after deletion attempt:", conv);
   if (deleted?.id) {
     draftsStore.deleteDraft(deleted.id);
     try { (window as any).conversationQuickSettings?.deleteSettings?.(deleted.id); } catch {}
   }
 
   // Adjust the selected conversation index if necessary now doesn't gate on there already existing a new chat window. Free the new chats.)
  if (i === $chosenConversationId) {
    // If deleting the current conversation, switch to another conversation (preceding one if possible)
    chosenConversationId.set(i > 0 ? i - 1 : 0);
    console.log("Selected conversation index adjusted to:", i > 0 ? i - 1 : 0);
  } else if (i < $chosenConversationId) {
    // If deleting a conversation before the current one, adjust the index of the selected conversation
    chosenConversationId.set($chosenConversationId - 1);
    console.log("Selected conversation index adjusted due to deletion before it. New index:", $chosenConversationId - 1);
  }

  conversations.set(conv); // Update the conversations list
}
let editingTitleId = null;
  let editedTitle = "";

  // Function to handle starting the edit of a conversation title
  function startEditConversationTitle(id: number, title: string) {
  editingTitleId = id;
  editedTitle = title;
}


  // Function to handle saving the edited conversation title
  function saveEditedTitle(id: number) {
    conversations.update((allConvs) => {
      let convs = [...allConvs];
      convs[id].title = editedTitle;
      return convs;
    });
    editingTitleId = null; // Reset editing state
  }

  function exportSession() {
    let data = {
      conversations: $conversations,
      chosenConversationId: $chosenConversationId,
      defaultAssistantRole: $defaultAssistantRole,
      selectedModel: $selectedModel,
      showTokens: $showTokens,
    };
    let json = JSON.stringify(data);
    let blob = new Blob([json], {type: "application/json"});
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = "wolfechat-session.json";
    a.click();
    URL.revokeObjectURL(url);
  
  }

  function importSession() {
    let input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      let file = input.files[0];
      let reader = new FileReader();
      reader.onload = async (e) => {
        let contents = e.target.result;
        let data = JSON.parse(contents as string);
        conversations.set(data.conversations);
        chosenConversationId.set(data.chosenConversationId);
        defaultAssistantRole.set(data.defaultAssistantRole);
        selectedModel.set(data.selectedModel);
        showTokens.set(data.showTokens);
      };
      reader.readAsText(file);
    };
    input.click();
  
  }

</script>

<div class="flex flex-col text-white/90">
  <div class="{$menuVisible == true ? 'translate-x-0' : '-translate-x-[100%] md:translate-x-0'} duration-200 h-full fixed md:flex w-[260px] flex-col bg-secondary z-40">
    <nav class="flex h-full fle-1 flex-col space-y-1 p-2 bg-secondary">
     
      <button on:click={() => {menuVisible.set(false);}} class="md:hidden z-20 flex py-3 px-3 items-center gap-3 rounded-md hover:bg-hover hover:opacity-hover transition-colors duration-200 cursor-pointer text-sm mb-2 flex-shrink-0 border border-white/50">
        Close menu
      </button>
      <div class="flex justify-between items-center py-3 px-3 w-full rounded-lg z-20">
        <p class="text-center font-bold text-2xl m-0">WolfeChat</p>
        <div class="flex items-center gap-2">
          <button title="Clear Conversation" aria-label="Clear Conversation" class="w-6 h-6 flex items-center justify-center hover:opacity-80" on:click={clearChat}>
            <img src={ClearChat} alt="Clear Conversation" class="w-6 h-6 filter-white" />
          </button>
          <button class="hover:bg-gray-700 rounded-lg p-1" title="New Conversation" aria-label="New Conversation" on:click={newChat}>
            <img src={NewChat} alt="New chat" class="w-6 h-6 filter-white z-20">
          </button>
        </div>
      </div>

    
     
     
      <div class="py-1 select-none z-20">
        <p class="text-xs text-gray-400 z-20">System Role:</p>
      </div>
      {#if $conversations[$chosenConversationId]}
      <textarea bind:value={$conversations[$chosenConversationId].assistantRole} {placeholder} class="bg-primary px-2 pt-1 pb-3 resize-none rounded focus:outline-none focus:outline-primary z-20"></textarea>
      {:else}
      <textarea placeholder="Select a conversation or start a new one..." class="bg-primary px-2 pt-1 pb-3 resize-none rounded focus:outline-none focus:outline-primary z-20"></textarea>
      {/if}
      
        <div class="flex flex-col h-40 my-2 flex-grow overflow-y-auto convo-container">
          <!-- Conversation listing starts here -->
          {#each $conversations.slice().reverse() as conv, i}

          <div class="{$chosenConversationId === $conversations.length - i - 1 ? 'bg-hover2 hover:bg-hover2' : ''} title-container conversation flex justify-between min-h-[50px] py-1 pl-3 items-center rounded-md hover:bg-hover cursor-pointer text-sm transition-colors duration-200" tabindex="-1" on:click={() => {let id = $conversations.length - i - 1; chosenConversationId.set(id);}} on:keydown={(e) => {if (e.key === 'Enter') {e.preventDefault(); let id = $conversations.length - i - 1; chosenConversationId.set(id);}}} >


              {#if editingTitleId === $conversations.length - i - 1}
              <input type="text" class="edit-input" bind:value={editedTitle} on:blur={() => saveEditedTitle($conversations.length - i - 1)} on:keydown={(e) => {if (e.key === 'Enter') {saveEditedTitle($conversations.length - i - 1); e.preventDefault();}}}/>
              {:else}
              <p class="text-left text-sm flex-grow title-text {$showTokens ? '' : ''}">
                {conv.title === "" ? "New conversation" : conv.title}
              </p>
              
              {/if}


            <div class="flex items-center gap-2">
              <button tabindex="0" on:click|stopPropagation={(e) => {let id = $conversations.length - i - 1; startEditConversationTitle(id, conv.title);}} on:keydown|stopPropagation={(e) => {if (e.key === 'Enter') {e.preventDefault(); let id = $conversations.length - i - 1; startEditConversationTitle(id, conv.title);}}} class="edit hidden rounded w-7 h-7 font-bold flex justify-center items-center hover:bg-blue-600">
                <img src={EditIcon} alt="Edit" class="icon-white min-w-4 w-4 h-4"/>
              </button>

              {#if $conversations.length >=2 }

              <button tabindex="0" on:click|stopPropagation={(e) => {let id = $conversations.length - i - 1; deleteConversation(id);}} on:keydown|stopPropagation={(e) => {if (e.key === 'Enter') {e.preventDefault(); let id = $conversations.length - i - 1; deleteConversation(id);}}} class="delete hidden rounded w-7 h-7 font-bold flex justify-center items-center hover:bg-warning">
                <img src={CloseIcon} alt="Delete" class="icon-white min-w-5 w-5 h-5"/>
              </button>
{/if}
            </div>
            {#if $showTokens === true}

            <p class="text-blue-200 tokens z-20 ml-5">
              {(Number(conv.conversationTokens ?? 0)).toFixed(0)}
            </p>
            {/if}

          </div>

          {/each}
        </div>
<div class="flex flex-row gap-2">
  <button on:click={exportSession} class="flex flex-1 border border-white/20 py-3 px-3 items-center text-gray-400 font-bold gap-3 rounded-md hover:bg-hover transition-colors duration-200 cursor-pointer text-sm mt-auto z-20">
    Export
  </button>
  <button on:click={importSession} class="flex flex-1 border border-white/20 py-3 px-3 items-center text-gray-400 font-bold gap-3 rounded-md hover:bg-hover transition-colors duration-200 cursor-pointer text-sm mt-auto z-20">
    Import
  </button>
</div>

        <div class="flex flex-row gap-2">
          <button on:click={openHelp} class="flex flex-1 border border-white/50 py-3 px-3 items-center font-bold gap-3 rounded-md hover:bg-hover transition-colors duration-200 cursor-pointer text-sm mt-auto z-20">
            Help
          </button>
          <button on:click={openDebug} class="flex flex-1 border border-white/50 py-3 px-3 items-center font-bold gap-3 rounded-md hover:bg-hover transition-colors duration-200 cursor-pointer text-sm mt-auto z-20">
            Debug
          </button>
        </div>
        <button on:click={openSettings} class="flex border border-white/50 py-3 px-3 items-center font-bold gap-3 rounded-md hover:bg-hover transition-colors duration-200 cursor-pointer text-sm mt-auto z-20">
          Settings {$apiKey === null ? "(Insert API key)" : ""}
        </button>
    </nav>
  </div>
</div>



<style>


.conversation .edit,
.conversation .delete {
  display: none;
}

.conversation:hover .tokens {
  display: none;
}
.conversation:hover .edit,
.conversation:hover .delete {
  display: flex;
}
.edit-input {
  background-color: #333; /* Dark gray background */
  color: white; /* Light text color for visibility */
  width: auto; /* Adjust width as needed */
  max-width: 145px; /* Maximum width to fit the sidebar */
  padding: 8px; /* Padding for aesthetics */
  border-radius: 4px; /* Optional: rounded corners */
  border: 1px solid #555; /* Slightly lighter border for some depth */
}
.title-container {
  overflow: hidden;
}
.title-container:hover {
  z-index: 20;
}

.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  display: inline-block;
  max-width: 100%;
  vertical-align: top;
}

.convo-container::after {
  content: '';
  position: absolute;
  top: 0;
  right: 3px;
  bottom: 0;
  width: 3em; /* Or as much as you need for the fade effect */
  background: linear-gradient(to right, rgb(33, 37, 43, 0), #21252b 80%, #21252b);

  z-index: 10;
}
.convo-container::after .title-container:hover {
  background: linear-gradient(to right, rgb(33, 37, 43, 0), #333943 80%, #333943);

}



</style>
