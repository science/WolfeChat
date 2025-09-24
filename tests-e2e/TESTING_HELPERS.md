# Testing the Test Helpers

## Philosophy
Test helpers are critical infrastructure. They need their own tests to ensure reliability and prevent test failures from propagating across the entire test suite.

## Test Levels

### Level 1: Unit Tests (Fastest)
Location: `src/tests/unit/test-helpers.spec.ts`

**Purpose**: Test that helpers contain correct logic patterns without browser overhead.

Test that helpers:
- Call correct methods in proper sequence
- Handle missing elements gracefully
- Maintain proper sequence of operations
- Return expected data structures
- Filter data correctly

```typescript
describe('Helper Unit Test', () => {
  it('should call correct sequence', async () => {
    // Mock the individual operations
    const openSettings = vi.fn();
    const selectProvider = vi.fn();

    // Simulate helper implementation
    await openSettings();
    await selectProvider('OpenAI');

    // Verify sequence and parameters
    expect(openSettings).toHaveBeenCalledBefore(selectProvider);
    expect(selectProvider).toHaveBeenCalledWith('OpenAI');
  });
});
```

### Level 2: Integration Tests (With Real Browser)
Location: `src/tests/unit/test-helpers-integration.spec.ts`

**Purpose**: Test that helpers work with real DOM and handle timing correctly.

Test that helpers:
- Actually interact with real DOM elements
- Handle timing and animations correctly
- Work with actual Svelte components
- Maintain state between operations
- Handle edge cases and missing elements

```typescript
describe('Helper Integration Test', () => {
  it('should interact with real Settings modal', async () => {
    // Use real browser instance - requires dev server running
    await settingsButton.click();
    const heading = page.getByRole('heading', { name: /settings/i });
    await expect(heading).toBeVisible();
  });
});
```

### Level 3: E2E Validation (In Context)
Location: Existing E2E tests throughout `tests-e2e/`

**Purpose**: Helpers are validated by their usage in actual test scenarios.

Helpers are tested in real application flows where they're used to accomplish actual testing goals.

## Testing Atomic vs Composite Helpers

### Atomic Helper Tests
**Focus**: Single responsibility and state management

```typescript
it('openSettingsAndSelectProvider should only open and select', async () => {
  // Test individual atomic operation
  await openSettingsAndSelectProvider(page, 'OpenAI');

  // Assert Settings is open
  await expect(settingsHeading).toBeVisible();
  // Assert provider is selected
  await expect(providerSelect).toHaveValue('OpenAI');
  // Assert Settings is NOT closed (remains open for further operations)
  await expect(settingsHeading).toBeVisible();
});
```

### Composite Helper Tests
**Focus**: Orchestration and end-to-end completion

```typescript
it('setProviderApiKey should complete full flow', async () => {
  const spy1 = vi.spyOn(helpers, 'openSettingsAndSelectProvider');
  const spy2 = vi.spyOn(helpers, 'fillApiKeyAndWaitForModels');
  const spy3 = vi.spyOn(helpers, 'saveAndCloseSettings');

  await setProviderApiKey(page, 'OpenAI', 'key');

  // Verify orchestration
  expect(spy1).toHaveBeenCalledWith(page, 'OpenAI');
  expect(spy2).toHaveBeenCalledWith(page, 'key', 'OpenAI');
  expect(spy3).toHaveBeenCalledWith(page);

  // Verify final state (Settings closed)
  await expect(settingsHeading).toBeHidden();
});
```

## Running Helper Tests

### Prerequisites
```bash
# For integration tests, dev server must be running
npm run dev &
```

### Test Execution
```bash
# Unit tests only (fastest, no browser required)
npm run test src/tests/unit/test-helpers.spec.ts

# Integration tests (requires dev server running)
npm run test src/tests/unit/test-helpers-integration.spec.ts

# Full validation (includes all E2E tests using helpers)
npm run test        # All unit tests
npx playwright test # All E2E tests
```

## Red Flags in Helper Functions

Watch for these anti-patterns when developing or reviewing helpers:

1. **Unclear State Management**: Helper doesn't document whether modal is left open/closed
   ```typescript
   // ❌ Bad: Unclear final state
   export async function setupProvider(page, provider, key) {
     // ... operations ...
     // Is Settings open or closed at the end?
   }

   // ✅ Good: Clear state documentation
   export async function openSettingsAndSelectProvider(page, provider) {
     // ... operations ...
     // Settings remains open for further operations
   }
   ```

2. **Hidden Dependencies**: Helper assumes prior state without checking
   ```typescript
   // ❌ Bad: Assumes Settings is already open
   export async function selectModel(page, model) {
     const modelSelect = page.locator('#model-selection'); // Might not be visible!
     await modelSelect.selectOption(model);
   }

   // ✅ Good: Ensures required state
   export async function selectModelInSettings(page, model) {
     // Ensure Settings is open first
     const settingsHeading = page.getByRole('heading', { name: /settings/i });
     if (!await settingsHeading.isVisible().catch(() => false)) {
       await openSettings(page);
     }
     // Now safe to interact with Settings elements
   }
   ```

3. **No Error Recovery**: Helper fails without meaningful error messages
   ```typescript
   // ❌ Bad: Silent failure or unclear error
   const modelSelect = page.locator('#model-selection');
   await modelSelect.selectOption(model); // Generic Playwright error

   // ✅ Good: Contextual error message
   const modelSelect = page.locator('#model-selection');
   await modelSelect.waitFor({ timeout: 5000 });
   const options = await modelSelect.locator('option').all();
   if (options.length === 0) {
     throw new Error('No models available in Settings. Check API key configuration.');
   }
   ```

4. **Timing Issues**: Hard-coded waits instead of proper element detection
   ```typescript
   // ❌ Bad: Brittle timing
   await settingsButton.click();
   await page.waitForTimeout(2000); // Arbitrary wait

   // ✅ Good: Condition-based waiting
   await settingsButton.click();
   await expect(settingsHeading).toBeVisible({ timeout: 5000 });
   ```

5. **Mixed Concerns**: Helper does UI interaction AND business logic
   ```typescript
   // ❌ Bad: Mixed concerns
   export async function setupAndTestProvider(page, provider, key) {
     await setProvider(provider);
     await fillKey(key);
     await waitForModels();
     // Also runs assertions??
     expect(models.length).toBeGreaterThan(0);
   }

   // ✅ Good: Separate setup from assertions
   export async function setProviderApiKey(page, provider, key) {
     // Only handles setup, returns state for test to assert on
     await openSettingsAndSelectProvider(page, provider);
     await fillApiKeyAndWaitForModels(page, key, provider);
     await saveAndCloseSettings(page);
   }
   ```

## Helper Test Coverage Goals

### Coverage Requirements
- **Atomic Helpers**: 100% unit test coverage of logic patterns
- **Composite Helpers**: Verify they orchestrate atomics correctly
- **Error Paths**: Test timeout scenarios, missing elements, invalid parameters
- **State Verification**: Ensure modals are in expected state after operations
- **Cross-browser**: Validate in Chromium (minimum), Firefox and WebKit (recommended)

### Coverage Metrics
```bash
# Check unit test coverage
npm run test:coverage src/tests/unit/test-helpers*.spec.ts

# Validate integration coverage
npm run test src/tests/unit/test-helpers-integration.spec.ts

# Full E2E validation (helpers used in context)
npx playwright test --reporter=html
```

## Writing New Helper Tests

### For New Atomic Helpers

1. **Test the Logic Pattern** (Unit Test)
   ```typescript
   describe('newAtomicHelper', () => {
     it('should perform single responsibility correctly', () => {
       // Mock the individual operations
       // Test the sequence and parameters
       // Verify no side effects beyond the single responsibility
     });
   });
   ```

2. **Test Real DOM Interaction** (Integration Test)
   ```typescript
   it('should interact with real elements', async ({ page }) => {
     // Call the helper with real page
     await newAtomicHelper(page, ...args);
     // Verify DOM state changes
     // Confirm expected state is left for next operation
   });
   ```

### For New Composite Helpers

1. **Test Orchestration** (Unit Test)
   ```typescript
   it('should orchestrate atomic helpers correctly', () => {
     // Spy on atomic helper calls
     // Call composite helper
     // Verify atomics called in correct order with correct parameters
   });
   ```

2. **Test End-to-End Result** (Integration Test)
   ```typescript
   it('should achieve complete goal', async ({ page }) => {
     // Call composite helper
     // Verify final application state
     // Confirm all setup is complete and ready for test operations
   });
   ```

## Debugging Helper Test Failures

### Common Failure Patterns

1. **Timing Issues**
   ```bash
   Error: Element not found: #model-selection
   ```
   **Solution**: Check modal state - likely Settings not open when expected.

2. **Selector Mismatches**
   ```bash
   Error: locator.selectOption() no such option "gpt-4"
   ```
   **Solution**: Models not loaded yet. Verify `waitForModelsToLoad()` completed.

3. **State Conflicts**
   ```bash
   Error: Element is not visible
   ```
   **Solution**: Check for modal overlay conflicts (Settings blocking QuickSettings).

### Debug Tools

```bash
# Enable E2E debugging
DEBUG_E2E=2 npm run test src/tests/unit/test-helpers-integration.spec.ts

# Run integration tests with browser visible
npm run test:headed src/tests/unit/test-helpers-integration.spec.ts

# Generate test artifacts
npm run test src/tests/unit/test-helpers-integration.spec.ts -- --reporter=html
```

## Best Practices Summary

1. **Test helpers as seriously as application code** - they're infrastructure
2. **Unit test the logic patterns** - fast feedback on helper design
3. **Integration test with real DOM** - catch timing and browser issues
4. **Keep atomic helpers single-purpose** - easier to test and debug
5. **Make error messages contextual** - help identify which part of flow failed
6. **Document state expectations clearly** - prevent misuse in tests
7. **Prefer condition-based waits** over arbitrary timeouts
8. **Test both success and error paths** - helpers should fail gracefully