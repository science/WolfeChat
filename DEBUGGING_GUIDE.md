# SmoothGPT Chat Debugging Guide

## Problem Description
SmoothGPT is failing to complete chat messages correctly. The response body to POST requests to `/v1/chat/completions` is null, and there's no streaming follow-up despite `stream: true` in the request body.

## Debugging Tools Created

### 1. Debug Panel (In-App)
- **Location**: `src/lib/DebugPanel.svelte`
- **Usage**: The debug panel will appear in the bottom-right corner when running in development mode
- **Features**:
  - Test Direct API calls
  - Test Streaming API calls
  - Show current configuration
  - Display debug results

### 2. Debug Utilities
- **Location**: `src/utils/debugUtils.ts`
- **Functions**:
  - `testDirectAPI()`: Tests non-streaming chat completions
  - `testStreamingAPI()`: Tests streaming chat completions
  - `getCurrentDebugInfo()`: Gets current app state
  - `logDebugInfo()`: Logs debug info to console

### 3. Node.js Test Script
- **Location**: `test-api.js`
- **Usage**: `node test-api.js` (requires OPENAI_API_KEY environment variable)
- **Features**:
  - Tests models API
  - Tests chat completions with multiple models
  - Tests streaming with multiple models

## Step-by-Step Debugging Process

### Step 1: Test API Directly
```bash
# Set your API key
export OPENAI_API_KEY="your-api-key-here"

# Run the test script
node test-api.js
```

This will help determine if the issue is with:
- API key validity
- Model availability
- API service status

### Step 2: Use In-App Debug Panel
1. Start the development server
2. Open the app in your browser
3. Look for the debug panel in the bottom-right corner
4. Click "Test Direct API" to test non-streaming calls
5. Click "Test Streaming API" to test streaming calls
6. Check the browser console for detailed logs

### Step 3: Check Browser Network Tab
1. Open browser developer tools
2. Go to Network tab
3. Try sending a message in SmoothGPT
4. Look for the POST request to `/v1/chat/completions`
5. Check:
   - Request payload
   - Response status
   - Response body
   - Response headers

### Step 4: Enhanced Logging
The code has been updated with enhanced logging in:
- `parseJSONChunks()` function in `openaiService.ts`
- SSE event handlers
- Error handling

## Potential Issues and Solutions

### Issue 1: Model Availability
**Symptoms**: API calls work but specific models fail
**Solution**: 
- Check if the selected model is available in your account
- Try switching to a different model (gpt-3.5-turbo, gpt-4, etc.)
- Check OpenAI's model availability page

### Issue 2: Streaming Response Format
**Symptoms**: Direct API works but streaming fails
**Solution**:
- The `parseJSONChunks()` function has been improved to handle different response formats
- Check browser console for "Raw SSE data" logs to see actual response format

### Issue 3: SSE Library Issues
**Symptoms**: Network shows successful response but no streaming data
**Solution**:
- Check if the SSE library is compatible with current browser
- Try using native fetch with streaming instead of SSE library

### Issue 4: API Key Permissions
**Symptoms**: Models API works but chat completions fail
**Solution**:
- Check if your API key has the necessary permissions
- Verify account billing status
- Check rate limits

## Code Changes Made

### 1. Enhanced Error Handling
- Improved `parseJSONChunks()` function with better error handling
- Added detailed logging for SSE data
- Better error messages in streaming functions

### 2. Debug Panel
- Added to App.svelte (only shows in development)
- Provides direct API testing capabilities
- Shows current configuration state

### 3. Test Script
- Standalone Node.js script for API testing
- Tests multiple models and both streaming/non-streaming
- Provides detailed error information

## Next Steps

1. **Run the Node.js test script** to verify API functionality
2. **Use the debug panel** to test within the app
3. **Check browser console** for detailed error messages
4. **Monitor network tab** for request/response details
5. **Try different models** to isolate the issue

## Common Error Messages

- `"No API key configured"`: Set your API key in the app settings
- `"Model not available"`: Switch to a different model
- `"Streaming failed"`: Check network connectivity and API status
- `"Parse error"`: The response format may have changed

## Reporting Issues

When reporting issues, include:
1. Results from the Node.js test script
2. Browser console logs
3. Network tab details
4. Selected model and API key status
5. Steps to reproduce the issue
