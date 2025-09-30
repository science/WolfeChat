# Live Test Categories

## Model & Provider Tests
- `provider-model-management.spec.ts` - Provider switching & model lists
- `provider-quick-settings.spec.ts` - Quick Settings with providers
- `model-selection-payload.spec.ts` - Model selection drives API payload
- `provider-switching.spec.ts` - Provider dropdown and configuration
- `provider-api-validation.spec.ts` - API key validation

## Reasoning Tests
- `reasoning-windows-placement.spec.ts` - Reasoning window UI behavior

## Core Functionality Tests
- `browser-live-smoke.spec.ts` - Basic live API functionality
- `clear-new-chat-input.spec.ts` - Input preservation during navigation
- `new-chat-preserves-input.spec.ts` - New chat button behavior

## Debug Tests (can be deleted once stable)
- `debug-model-data-flow.spec.ts` - Model data flow verification
- `debug-api-fetch.spec.ts` - API interaction verification

## Migration Notes

These tests were migrated from `tests-e2e/nonlive/` to `tests-e2e/live/` to eliminate complex mocking and test real API integration:

### Before Migration (Nonlive Issues):
- Models seeded without `provider` field causing QuickSettings filtering to fail
- Complex localStorage manipulation to simulate API state
- Browser API limitations (e.g., `getEventListeners` not available)
- Mock/stub complexity fighting against multi-provider architecture

### After Migration (Live Benefits):
- Real models fetched with proper structure automatically
- No need to understand internal model object format
- Tests validate actual user experience
- API key validation tests use real authentication
- Minimal cost (tests use tiny API quota)

### Environment Requirements:
- `OPENAI_API_KEY` environment variable required
- Tests skip gracefully if API key not available
- Can add `ANTHROPIC_API_KEY` for dual-provider tests

### Cost Considerations:
- Tests send minimal messages ("Hello", "Test message")
- Primarily test model selection and UI interactions
- Actual API usage is very small (pennies per run)
- Much more reliable than complex mocking alternatives