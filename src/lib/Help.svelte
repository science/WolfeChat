<script lang="ts">
    import CloseIcon from "../assets/close.svg";
    import { helpVisible } from "../stores/stores.js";
  
    // Function to close the help modal
    function handleClose() {
      helpVisible.set(false);
    }
  </script>
  
  <div class="fixed z-50 inset-0 overflow-y-auto animate-fade-in">
    <div class="flex items-center justify-center min-h-screen">
      <div class="bg-primary text-white rounded-lg shadow-xl p-8 relative max-w-lg mx-4">
        <button
          class="absolute top-0 right-0 mt-2 mr-2 text-gray-500 hover:text-gray-600"
          on:click={handleClose}
        >
          <img class="icon-white w-8" alt="Close" src={CloseIcon} />
        </button>
        <h2 class="text-xl font-bold mb-4">WolfeChat Help & FAQ</h2>
        <div class="text-left">
          <h1 class="text-3xl font-bold mb-4">What is WolfeChat?</h1>
          <p class="mb-4">WolfeChat is a browser-based chat UI for <strong>OpenAI</strong> (GPT-4, o1) and <strong>Anthropic</strong> (Claude) models. Use your own API keys with a clean interface—no subscriptions, just pay-as-you-go rates.</p>
          <p class="mb-4">Configure one or both providers in Settings, then switch between models seamlessly in any conversation.</p>
  
          <h2 class="text-2xl font-bold mb-3">Key Features:</h2>
            <ul class="list-disc list-inside mb-4">
              <li><strong>Multi-Provider:</strong> OpenAI (GPT-4, o1, vision, TTS, DALL-E) and Anthropic (Claude Sonnet, Opus, Haiku)</li>
              <li><strong>Reasoning Models:</strong> o1/o3 and Claude reasoning with dedicated display windows</li>
              <li><strong>Quick Settings:</strong> Switch models and adjust parameters mid-conversation</li>
              <li><strong>Image Vision:</strong> Upload images for GPT-4 Vision and Claude analysis</li>
              <li><strong>Message Management:</strong> Copy, delete, or fork conversations at any point</li>
              <li><strong>Browser-Based:</strong> Direct API calls—no backend, all data stored locally</li>
              <li><strong>Mobile-Friendly:</strong> Responsive design for phones and tablets</li>
          </ul>

          <h3 class="text-xl font-bold mb-2 mt-4">Credits</h3>
            <p class="mb-3">Built on great open-source projects:</p>
            <ul class="list-disc list-inside mb-4">
              <li><a href="https://github.com/patrikzudel/PatrikZeros-ChatGPT-API-UI" target="_blank" rel="noreferrer" class="underline">PatrikZeros-ChatGPT-API-UI</a> by patrikzudel</li>
              <li><a href="https://github.com/agambon/SmoothGPT" target="_blank" rel="noreferrer" class="underline">SmoothGPT</a> and its contributors</li>
            </ul>
  
          <h3 class="text-xl font-bold mb-2 mt-4">Get API Keys</h3>
          <div class="mb-1">
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"  class="text-blue-500 hover:text-blue-700">OpenAI API Keys</a>
          </div>
          <div class="mb-4">
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"  class="text-blue-500 hover:text-blue-700">Anthropic API Keys</a>
          </div>

          <div class="mb-4 mt-4">
              <a href="https://github.com/science/WolfeChat" target="_blank" rel="noreferrer"  class="text-blue-500 hover:text-blue-700">View source on GitHub</a>
          </div>
  
          <p class="mb-4"><strong>Data Storage:</strong> Conversations stored in browser localStorage. Clear browser data = lost conversations. Download/restore sessions via Settings. DALL-E images expire in 60 minutes.</p>
    
        </div>
        <button class="bg-good hover:bg-good2 transition-colors duration-200 text-white py-2 px-4 mt-4 rounded" on:click={handleClose}>Got it!</button>
      </div>
    </div>
  </div>
  
  <style>
    @import '../styles/settings.css'; 
  </style>
  
