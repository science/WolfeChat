# Live Regression Test Suite

**Purpose**: Comprehensive, slower tests for full production regression testing before releases.

## Overview

This directory contains E2E tests that:
- Make real API calls to external services (OpenAI, Anthropic)
- Are slower to execute (serialized, single worker)
- May have rate limiting constraints
- Test complete end-to-end workflows
- Are run before major releases, not during regular development

## When to Run

- **Before production releases**: Full regression validation
- **Weekly/nightly builds**: Automated comprehensive testing
- **Major feature changes**: Validate nothing broke
- **NOT during active development**: Too slow for fast feedback

## Running Regression Tests

```bash
# Run full regression suite (slow, ~10+ minutes)
npx playwright test tests-e2e/live-regression

# Run specific regression test
npx playwright test tests-e2e/live-regression/anthropic-sdk-streaming.spec.ts

# Run with debugging
DEBUG_E2E=2 VITE_E2E_TEST=true npx playwright test tests-e2e/live-regression --headed
```

## Test Organization

Regression tests are configured to run:
- **Serial mode**: Tests run one at a time within each file
- **Single worker**: Only one test file runs at a time
- **Higher timeouts**: More lenient timing for API rate limits
- **Full isolation**: Complete localStorage/state reset between tests

## API Requirements

Regression tests require:
- `OPENAI_API_KEY` environment variable
- `ANTHROPIC_API_KEY` environment variable (for Anthropic tests)

## Test Categories

### Anthropic SDK Tests
- `anthropic-sdk-streaming.spec.ts`: Anthropic API streaming, reasoning windows, progressive text

## Adding New Regression Tests

Add tests here if they:
1. Require external API calls with rate limits
2. Test slow, complex end-to-end workflows
3. Would slow down regular development if run frequently
4. Need serialized execution to avoid race conditions

## Fast Daily Driver Tests

For regular development, use `tests-e2e/live/` which:
- Runs with parallel workers (faster)
- Suitable for frequent execution
- Optimized for quick feedback
