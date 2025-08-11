<script lang="ts">
  import { testDirectAPI, testStreamingAPI, testSmoothGPTChatFlow, testModelSpecificBehavior, testSSEParsing, testSSEJSImplementation, testResponsesAPI, testResponsesStreamingAPI, testReasoningStreamingAPI, logDebugInfo } from '../utils/debugUtils';
  import { selectedModel, apiKey, debugVisible } from '../stores/stores';
  import { createEventDispatcher } from 'svelte';
  import CloseIcon from '../assets/close.svg';
  
  const dispatch = createEventDispatcher();
  
  let debugResults = '';
  let isTesting = false;
  let currentTest = '';
  
  async function runDirectAPITest() {
    isTesting = true;
    currentTest = 'Direct API';
    debugResults = 'Running direct API test...\n';
    
    try {
      const result = await testDirectAPI();
      if (result) {
        debugResults += `✅ Direct API test successful!\n`;
        debugResults += `Selected model: ${result.selectedModel}\n`;
        debugResults += `Available models: ${result.models.length}\n`;
        debugResults += `Chat response: ${JSON.stringify(result.chatTest, null, 2)}\n`;
      } else {
        debugResults += `❌ Direct API test failed!\n`;
      }
    } catch (error) {
      debugResults += `❌ Direct API test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runStreamingAPITest() {
    isTesting = true;
    currentTest = 'Streaming API';
    debugResults = 'Running streaming API test...\n';
    
    try {
      const result = await testStreamingAPI();
      if (result) {
        debugResults += `✅ Streaming API test successful!\n`;
        debugResults += `Chunks received: ${result.chunkCount}\n`;
        debugResults += `Stream data: ${result.streamData}\n`;
      } else {
        debugResults += `❌ Streaming API test failed!\n`;
      }
    } catch (error) {
      debugResults += `❌ Streaming API test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runSmoothGPTChatFlowTest() {
    isTesting = true;
    currentTest = 'SmoothGPT Chat Flow';
    debugResults = 'Running SmoothGPT chat flow test...\n';
    
    try {
      const result = await testSmoothGPTChatFlow();
      if (result && result.success) {
        debugResults += `✅ SmoothGPT chat flow test successful!\n`;
        debugResults += `Chunks received: ${result.chunkCount}\n`;
        debugResults += `Final message: "${result.finalMessage}"\n`;
        debugResults += `Parsed chunks: ${result.parsedChunks.length}\n`;
        debugResults += `Raw data length: ${result.rawData.length} characters\n`;
      } else {
        debugResults += `❌ SmoothGPT chat flow test failed!\n`;
      }
    } catch (error) {
      debugResults += `❌ SmoothGPT chat flow test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runModelSpecificTest() {
    isTesting = true;
    currentTest = 'Model Specific';
    debugResults = 'Running model-specific behavior test...\n';
    
    try {
      const result = await testModelSpecificBehavior();
      if (result && result.success) {
        debugResults += `✅ Model-specific test successful!\n`;
        debugResults += `Model: ${result.model}\n`;
        debugResults += `Chunks received: ${result.chunkCount}\n`;
        debugResults += `Parse success: ${result.parseSuccess}\n`;
        debugResults += `Parsed chunks: ${result.parsedChunks.length}\n`;
      } else {
        debugResults += `❌ Model-specific test failed!\n`;
      }
    } catch (error) {
      debugResults += `❌ Model-specific test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runSSEParsingTest() {
    isTesting = true;
    currentTest = 'SSE Parsing';
    debugResults = 'Running SSE parsing test...\n';
    
    try {
      const result = await testSSEParsing();
      if (result && result.success) {
        debugResults += `✅ SSE parsing test successful!\n`;
        debugResults += `Sample data: ${result.sampleData}\n`;
        debugResults += `Parsed count: ${result.parseCount}\n`;
        debugResults += `Parsed result: ${JSON.stringify(result.parsed, null, 2)}\n`;
      } else {
        debugResults += `❌ SSE parsing test failed!\n`;
      }
    } catch (error) {
      debugResults += `❌ SSE parsing test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runSSEJSTest() {
    isTesting = true;
    currentTest = 'SSE.js Implementation';
    debugResults = 'Running SSE.js implementation test...\n';
    
    try {
      const result = await testSSEJSImplementation();
      if (result && result.success) {
        debugResults += `✅ SSE.js implementation test successful!\n`;
        debugResults += `Chunks received: ${result.chunkCount}\n`;
        debugResults += `Parse success: ${result.parseSuccess}\n`;
        debugResults += `Stream data length: ${result.streamData.length} characters\n`;
      } else {
        debugResults += `❌ SSE.js implementation test failed!\n`;
        if (result && result.error) {
          debugResults += `Error: ${result.error}\n`;
        }
      }
    } catch (error) {
      debugResults += `❌ SSE.js implementation test error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runResponsesAPITest() {
    isTesting = true;
    currentTest = 'Responses API';
    debugResults = 'Running Responses API (non-streaming) test...\n';

    try {
      const result = await testResponsesAPI();
      if (result && result.success) {
        debugResults += `✅ Responses API test successful!\n`;
        debugResults += `Model: ${result.model}\n`;
        debugResults += `Output: ${result.outputText}\n`;
      } else {
        debugResults += `❌ Responses API test failed!\n`;
        if (result?.error) debugResults += `Error: ${result.error}\n`;
      }
    } catch (error) {
      debugResults += `❌ Responses API test error: ${error}\n`;
    }

    isTesting = false;
  }

  async function runResponsesStreamingTest() {
    isTesting = true;
    currentTest = 'Responses Streaming';
    debugResults = 'Running Responses API (streaming) test...\n';

    try {
      const result = await testResponsesStreamingAPI();
      if (result && result.success) {
        debugResults += `✅ Responses streaming test successful!\n`;
        debugResults += `Model: ${result.model}\n`;
        debugResults += `Events received: ${result.eventsCount}\n`;
        debugResults += `Final text: ${result.finalText}\n`;
      } else {
        debugResults += `❌ Responses streaming test failed!\n`;
        if (result?.error) debugResults += `Error: ${result.error}\n`;
      }
    } catch (error) {
      debugResults += `❌ Responses streaming test error: ${error}\n`;
    }

    isTesting = false;
  }

  async function runReasoningStreamingTest() {
    isTesting = true;
    currentTest = 'Reasoning Streaming';
    debugResults = 'Running reasoning streaming test...\n';

    try {
      const result = await testReasoningStreamingAPI();
      if (result && result.success) {
        debugResults += `✅ Reasoning streaming test successful!\n`;
        debugResults += `Model: ${result.model}\n`;
        debugResults += `Seen types (${result.seenTypes.length}): ${result.seenTypes.join(', ')}\n`;
        debugResults += `Missing types (${result.missingTypes.length}): ${result.missingTypes.join(', ') || 'none'}\n`;
        debugResults += `Event order:\n${result.order.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`;
        if (result.reasoningSummaryText) {
          debugResults += `\nReasoning summary (first 300 chars):\n${result.reasoningSummaryText.slice(0, 300)}\n`;
        }
        if (result.reasoningText) {
          debugResults += `\nReasoning text (first 300 chars):\n${result.reasoningText.slice(0, 300)}\n`;
        }
      } else {
        debugResults += `❌ Reasoning streaming test failed!\n`;
        if (result?.error) debugResults += `Error: ${result.error}\n`;
        if (result?.seenTypes) debugResults += `Seen types: ${result.seenTypes.join(', ')}\n`;
        if (result?.missingTypes) debugResults += `Missing types: ${result.missingTypes.join(', ')}\n`;
      }
    } catch (error) {
      debugResults += `❌ Reasoning streaming test error: ${error}\n`;
    }

    isTesting = false;
  }

  async function runAllTests() {
    isTesting = true;
    currentTest = 'All Tests';
    debugResults = 'Running comprehensive test suite...\n\n';
    
    try {
      // Test 1: Direct API
      debugResults += '=== Test 1: Direct API ===\n';
      const directResult = await testDirectAPI();
      if (directResult) {
        debugResults += `✅ Direct API: PASSED\n`;
      } else {
        debugResults += `❌ Direct API: FAILED\n`;
      }
      
      // Test 2: Streaming API
      debugResults += '\n=== Test 2: Streaming API ===\n';
      const streamingResult = await testStreamingAPI();
      if (streamingResult) {
        debugResults += `✅ Streaming API: PASSED\n`;
      } else {
        debugResults += `❌ Streaming API: FAILED\n`;
      }
      
      // Test 3: SmoothGPT Chat Flow
      debugResults += '\n=== Test 3: SmoothGPT Chat Flow ===\n';
      const chatFlowResult = await testSmoothGPTChatFlow();
      if (chatFlowResult && chatFlowResult.success) {
        debugResults += `✅ SmoothGPT Chat Flow: PASSED\n`;
        debugResults += `Final message: "${chatFlowResult.finalMessage}"\n`;
      } else {
        debugResults += `❌ SmoothGPT Chat Flow: FAILED\n`;
      }
      
      // Test 4: Model Specific
      debugResults += '\n=== Test 4: Model Specific ===\n';
      const modelResult = await testModelSpecificBehavior();
      if (modelResult && modelResult.success) {
        debugResults += `✅ Model Specific: PASSED\n`;
      } else {
        debugResults += `❌ Model Specific: FAILED\n`;
      }
      
      // Test 5: SSE Parsing
      debugResults += '\n=== Test 5: SSE Parsing ===\n';
      const sseResult = await testSSEParsing();
      if (sseResult && sseResult.success) {
        debugResults += `✅ SSE Parsing: PASSED\n`;
      } else {
        debugResults += `❌ SSE Parsing: FAILED\n`;
      }
      
      // Test 6: SSE.js Implementation
      debugResults += '\n=== Test 6: SSE.js Implementation ===\n';
      const ssejsResult = await testSSEJSImplementation();
      if (ssejsResult && ssejsResult.success) {
        debugResults += `✅ SSE.js Implementation: PASSED\n`;
      } else {
        debugResults += `❌ SSE.js Implementation: FAILED\n`;
      }
      
      debugResults += '\n=== Test Summary ===\n';
      const tests = [directResult, streamingResult, chatFlowResult, modelResult, sseResult, ssejsResult];
      const passed = tests.filter(t => t && (t.success !== false)).length;
      debugResults += `Tests passed: ${passed}/${tests.length}\n`;
      
      if (passed === tests.length) {
        debugResults += '🎉 All tests passed! The issue is likely in the UI integration.\n';
      } else {
        debugResults += '⚠️ Some tests failed. Check the results above.\n';
      }
      
    } catch (error) {
      debugResults += `❌ Test suite error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  function showDebugInfo() {
    logDebugInfo();
    debugResults = 'Debug info logged to console. Check browser console for details.\n';
  }
  
  function clearResults() {
    debugResults = '';
    currentTest = '';
  }

  function closeDebugPanel() {
    debugVisible.set(false);
  }
</script>

<div class="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-lg z-50 max-h-96 overflow-y-auto">
  <div class="flex justify-between items-center mb-2">
    <h3 class="text-lg font-bold">Debug Panel</h3>
    <button on:click={closeDebugPanel}>
      <img src={CloseIcon} alt="Close" class="w-5 h-5" />
    </button>
  </div>
  
  <div class="mb-4 text-sm">
    <p class="mb-1">Current Model: {$selectedModel}</p>
    <p class="mb-1">API Key: {$apiKey ? '✅ Configured' : '❌ Missing'}</p>
    {#if currentTest}
      <p class="mb-1">Current Test: {currentTest}</p>
    {/if}
  </div>
  
  <div class="space-y-2 mb-4">
    <button 
      class="w-full bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runDirectAPITest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Direct API' ? 'Testing...' : 'Test Direct API'}
    </button>
    
    <button 
      class="w-full bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runStreamingAPITest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Streaming API' ? 'Testing...' : 'Test Streaming API'}
    </button>
    
    <button 
      class="w-full bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runSmoothGPTChatFlowTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'SmoothGPT Chat Flow' ? 'Testing...' : 'Test Chat Flow'}
    </button>
    
    <button 
      class="w-full bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runModelSpecificTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Model Specific' ? 'Testing...' : 'Test Model'}
    </button>
    
    <button 
      class="w-full bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runSSEParsingTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'SSE Parsing' ? 'Testing...' : 'Test SSE Parsing'}
    </button>
    
    <button 
      class="w-full bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runSSEJSTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'SSE.js Implementation' ? 'Testing...' : 'Test SSE.js'}
    </button>

    <button 
      class="w-full bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runResponsesAPITest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Responses API' ? 'Testing...' : 'Test Responses API (non-stream)'}
    </button>

    <button 
      class="w-full bg-cyan-700 hover:bg-cyan-800 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runResponsesStreamingTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Responses Streaming' ? 'Testing...' : 'Test Responses API (stream)'}
    </button>

    <button 
      class="w-full bg-fuchsia-600 hover:bg-fuchsia-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runReasoningStreamingTest}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Reasoning Streaming' ? 'Testing...' : 'Test Reasoning Streaming'}
    </button>
    
    <button 
      class="w-full bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runAllTests}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'All Tests' ? 'Running...' : 'Run All Tests'}
    </button>
    
    <button 
      class="w-full bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
      on:click={showDebugInfo}
    >
      Show Debug Info
    </button>
    
    <button 
      class="w-full bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
      on:click={clearResults}
    >
      Clear Results
    </button>
  </div>
  
  {#if debugResults}
    <div class="mt-4 p-2 bg-gray-700 rounded text-xs max-h-40 overflow-y-auto">
      <pre>{debugResults}</pre>
    </div>
  {/if}
</div>
