<script lang="ts">
  import { testResponsesAPI, testResponsesStreamingAPI, testReasoningStreamingAPI, logDebugInfo } from '../utils/debugUtils';
  import { selectedModel, apiKey, debugVisible } from '../stores/stores';
  import { createEventDispatcher } from 'svelte';
  import CloseIcon from '../assets/close.svg';
  import { runAllTests, formatSuiteResultsText as formatSuiteResultsTextAll, clearTests } from '../tests/testHarness';
  
  const dispatch = createEventDispatcher();
  
  let debugResults = '';
  let isTesting = false;
  let currentTest = '';

  // Ensure that all test modules are attached (imported) before running the non-API harness.
  // This dynamically imports every *.test.ts under src/tests so newly added tests are included without manual wiring.
  async function ensureAllNonApiTestsLoaded() {
    const modules = import.meta.glob('../tests/nonapi/**/*.test.ts');
    const loaders = Object.values(modules);
    await Promise.all(loaders.map((load: any) => load()));
  }

  // Ensure only live API tests are loaded. Any new test placed under src/tests/live will be discovered automatically.
  async function ensureAllLiveApiTestsLoaded() {
    const modules = import.meta.glob('../tests/live/**/*.test.ts');
    const loaders = Object.values(modules);
    await Promise.all(loaders.map((load: any) => load()));
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

  async function runAllApiTests() {
    isTesting = true;
    currentTest = 'All Tests';
    debugResults = 'Running comprehensive test suite...\n\n';
    
    try {
      // Test: Responses API (non-stream)
      debugResults += '=== Test: Responses API (non-stream) ===\n';
      const nonStream = await testResponsesAPI();
      if (nonStream && nonStream.success) {
        debugResults += `✅ Responses API: PASSED\n`;
        debugResults += `Model: ${nonStream.model}\n`;
        debugResults += `Output: ${nonStream.outputText}\n`;
      } else {
        debugResults += `❌ Responses API: FAILED\n`;
        if (nonStream?.error) debugResults += `Error: ${nonStream.error}\n`;
      }

      // Test: Responses API (stream)
      debugResults += '\n=== Test: Responses API (stream) ===\n';
      const stream = await testResponsesStreamingAPI();
      if (stream && stream.success) {
        debugResults += `✅ Responses streaming: PASSED\n`;
        debugResults += `Model: ${stream.model}\n`;
        debugResults += `Events received: ${stream.eventsCount}\n`;
        debugResults += `Final text: ${stream.finalText}\n`;
      } else {
        debugResults += `❌ Responses streaming: FAILED\n`;
        if (stream?.error) debugResults += `Error: ${stream.error}\n`;
      }

      // Test: Reasoning Streaming
      debugResults += '\n=== Test: Reasoning Streaming ===\n';
      const reasoning = await testReasoningStreamingAPI();
      if (reasoning && reasoning.success) {
        debugResults += `✅ Reasoning streaming: PASSED\n`;
        debugResults += `Model: ${reasoning.model}\n`;
        if (reasoning.reasoningSummaryText) {
          debugResults += `Reasoning summary (first 300 chars):\n${reasoning.reasoningSummaryText.slice(0, 300)}\n`;
        }
        if (reasoning.reasoningText) {
          debugResults += `Reasoning text (first 300 chars):\n${reasoning.reasoningText.slice(0, 300)}\n`;
        }
      } else {
        debugResults += `❌ Reasoning streaming: FAILED\n`;
        if (reasoning?.error) debugResults += `Error: ${reasoning.error}\n`;
      }

      debugResults += '\n=== Test Summary ===\n';
      const tests = [nonStream, stream, reasoning];
      const passed = tests.filter(t => t && t.success).length;
      debugResults += `Tests passed: ${passed}/${tests.length}\n`;
      
    } catch (error) {
      debugResults += `❌ Test suite error: ${error}\n`;
    }
    
    isTesting = false;
  }
  
  async function runTestHarness() {
    isTesting = true;
    currentTest = 'Test Harness (API)';
    debugResults = 'Running test harness (API tests)...\n';

    // Reset registry and load only live API tests from src/tests/live
    clearTests();
    await ensureAllLiveApiTestsLoaded();

    try {
      const suite = await runAllTests();
      debugResults = formatSuiteResultsTextAll(suite);
    } catch (error) {
      debugResults = `❌ Test harness error: ${error}\n`;
    }

    isTesting = false;
  }

  async function runNonApiTestHarness() {
    isTesting = true;
    currentTest = 'Test Harness (non-API)';
    debugResults = 'Running non-API test harness...\n';

    // Ensure all non-API tests are loaded before running
    await ensureAllNonApiTestsLoaded();

    try {
      const suite = await runAllTests();
      debugResults = formatSuiteResultsTextAll(suite);
    } catch (error) {
      debugResults = `❌ Non-API test harness error: ${error}\n`;
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
      {isTesting && currentTest === 'Reasoning Streaming' ? 'Testing...' : 'Test Reasoning Stream'}
    </button>
    
    <button 
      class="w-full bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runAllApiTests}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'All Tests' ? 'Running...' : 'Run All Tests'}
    </button>
    
    <button 
      class="w-full bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runNonApiTestHarness}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Test Harness (non-API)' ? 'Running...' : 'Run Test Harness (non-API)'}
    </button>
    
    <button 
      class="w-full bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded text-sm disabled:opacity-50"
      on:click={runTestHarness}
      disabled={isTesting}
    >
      {isTesting && currentTest === 'Test Harness (API)' ? 'Running...' : 'Run Test Harness (API)'}
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
