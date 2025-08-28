# CLI Testing Architecture for Wolfechat

## Overview
This document describes the testing architecture that enables running tests from the CLI and CI/CD pipelines using automatic test discovery based on folder structure.

## Architecture

### Test Organization
Tests are organized into three main suites based on their requirements:

- **`src/tests/unit/`** - Unit tests that run in Node.js with JSDOM (formerly nonapi)
- **`src/tests/browser-nonlive/`** - Tests that require a real browser but no internet (future)
- **`src/tests/live/`** - Tests that interact with external services (OpenAI API, etc.)

### Automatic Test Registration
Simply placing a `*.test.ts` file in the appropriate folder automatically registers it with the test harness. No manual imports or registration required.

### Components

#### 1. Test Runner (`run-tests.mjs`)
- Pure ES module runner with suite-based test discovery
- Uses esbuild for fast TypeScript compilation
- Sets up JSDOM environment for DOM APIs
- Provides mock implementations for browser-specific globals
- Automatically bundles and executes tests based on selected suite

#### 2. Test Harness (`src/tests/testHarness.ts`)
- Provides test registration and execution framework
- Simple assertion API with `Assert` class
- Test filtering by tags and names
- Result formatting and reporting

#### 3. Mock System (`src/tests/mocks/`)
- **svelte.js** - Mock Svelte store implementations (writable, derived, readable, get)
- **svelte-code-shim.js** - Lightweight component mock for Code renderer
- **svelte-markdown.js** - Mock for svelte-markdown component

#### 4. Build Pipeline
- **esbuild** - Fast TypeScript to JavaScript compilation
- Creates a single bundle per suite for efficient execution
- Handles external dependencies and Svelte file loading

## Implementation Steps

### Step 1: Install Dependencies
```bash
npm install --save-dev esbuild jsdom fast-glob
```

### Step 2: Create Mock System
- Implement Svelte store mocks that work in Node.js
- Create component shims for tests that import Svelte components
- Mock browser APIs (localStorage, requestAnimationFrame, etc.)

### Step 3: Build Pipeline
- Use esbuild to compile TypeScript tests to JavaScript
- Bundle with proper external declarations to avoid bundling node_modules
- Output to `.test-build/` directory for execution

### Step 4: Test Runner
- Load compiled test files dynamically
- Execute test harness with proper filtering support
- Support for tags (live, smoke) and name filtering

## Usage

### Running Tests

The test runner uses a suite-based approach where tests are automatically discovered based on their location:

```bash
# Run unit tests (default)
node run-tests.mjs
# or
node run-tests.mjs --suite unit

# Run browser tests (not yet implemented)
node run-tests.mjs --suite browser-nonlive

# Run live/API tests
node run-tests.mjs --suite live
# or
node run-tests.mjs --live

# Run all tests
node run-tests.mjs --suite all

# Filter by tag within a suite
node run-tests.mjs --suite unit --tag keyboard

# Filter by test name (substring match)
node run-tests.mjs --suite unit --name "scroll"

# Show help
node run-tests.mjs --help

# Legacy support (deprecated)
node run-tests.mjs --suite nonapi  # Maps to 'unit' suite
```

### NPM Scripts
```bash
# Run unit tests
npm run test

# Run live tests (requires API keys)
npm run test:live

# Run all tests
npm run test:all
```

### Adding New Tests

1. **For unit tests**: Create a `*.test.ts` file in `src/tests/unit/`
2. **For browser tests**: Create a `*.test.ts` file in `src/tests/browser-nonlive/` (future)
3. **For live/API tests**: Create a `*.test.ts` file in `src/tests/live/`
4. Use the test harness to register your tests:

```typescript
import { test } from '../testHarness.js';

test({
  id: 'unique-test-id',
  name: 'Descriptive test name',
  tags: ['optional', 'tags'],
  timeoutMs: 30000, // optional timeout
  fn: async (assert) => {
    // Your test logic
    assert.that(condition, 'Error message if fails');
  }
});
```

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
- name: Run Non-API Tests
  run: |
    npm ci
    npm run test
    
- name: Run API Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    npm run test:live
```

## Architecture Benefits

1. **Automatic test discovery** - Tests are discovered based on folder placement
2. **No manual registration** - Simply add test files to the appropriate folder
3. **Suite-based organization** - Clear separation between API and non-API tests
4. **Fast compilation** - esbuild provides fast TypeScript compilation
5. **Isolated environment** - Tests run in controlled Node.js environment
6. **CI/CD ready** - Can run in any Node.js environment without browser
7. **Maintainable** - Clear folder structure and consistent patterns

## Future Enhancements

1. **Code Coverage** - Integrate c8 or nyc for coverage reports
2. **Parallel Execution** - Run tests in worker threads for speed
3. **Watch Mode** - Auto-rerun tests on file changes
4. **Better Reporting** - JUnit XML output for CI integration
5. **Performance Metrics** - Track test execution times over time

## Troubleshooting

### Common Issues

1. **Tests not being discovered**
   - Ensure test files follow naming convention (`*.test.ts`)
   - Verify the file is in the correct folder (`nonapi/` or `live/`)
   - Check that the test file imports and uses the test harness

2. **Module not found errors**
   - External dependencies should be mocked or listed in esbuild externals
   - Svelte components need mock implementations

3. **DOM API errors**
   - JSDOM environment is set up automatically
   - Add missing global mocks to `run-tests.mjs` if needed

4. **Compilation errors**
   - Check TypeScript syntax in test files
   - Ensure all imports use `.js` extensions (even for TypeScript files)

## Test Organization Guide

### Folder Structure
```
src/tests/
├── unit/             # Unit tests (Node.js + JSDOM)
│   ├── *.test.ts     # Logic tests, utilities, mocked components
│   └── __mocks__/    # Component mocks
├── browser-nonlive/  # Browser tests without internet (future)
│   └── *.test.ts     # Full UI tests, real Svelte mounting
├── live/             # Tests that use external APIs
│   └── *.test.ts     # API integration tests
├── testHarness.ts    # Core test framework
└── mocks/            # Shared mock implementations
```

### When to Use Each Suite

**Unit Tests (`src/tests/unit/`)**
- Unit tests for utilities and helpers
- Simple DOM manipulation tests (with JSDOM)
- Store and state management tests
- Component logic tests (mocked)
- Tests that don't need accurate layout/scrolling

**Browser Tests (`src/tests/browser-nonlive/`)** *(Future)*
- Full UI interaction tests
- Tests requiring real Svelte component mounting
- Scroll behavior with accurate measurements
- CSS layout-dependent tests
- Visual regression tests

**Live Tests (`src/tests/live/`)**
- OpenAI API integration tests
- End-to-end workflow tests
- Tests requiring real API responses
- Performance tests with actual services

## Conclusion

This refactored architecture provides a robust, maintainable solution for CLI-based testing that integrates seamlessly with modern CI/CD pipelines while maintaining compatibility with the existing test suite.