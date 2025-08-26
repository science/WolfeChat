# Wolfechat Development Guidelines

## Build & Development Commands
- `npm run dev`: Start dev server with hot reload (Vite on network with `--host`)
- `npm run build`: Build to `dist/` (commit `dist/` for UI changes before merge)
- `npm run check`: Type-check all TypeScript/Svelte files
- **Tests**: Custom test harness in `src/tests/`. Run individual test: import in `App.svelte` during dev

## Code Style & Structure
- **Formatting**: 2-space indents, no tabs. Imports: external libs → local modules
- **Naming**: Components `PascalCase.svelte`, functions/vars `camelCase`, assets `kebab-case.svg`
- **Types**: TypeScript strict mode. Define interfaces for all API responses and component props
- **Imports**: Use absolute paths from `src/`. Group: `svelte` → `openai`/libs → stores → utils → components
- **Error Handling**: Try-catch async operations, log errors to console, show user-friendly messages via stores

## Architecture Patterns
- `src/lib/`: Svelte components (UI only, no business logic)
- `src/managers/`: Feature orchestration, side effects, complex state updates
- `src/services/`: External API calls (OpenAI, PDFs). Keep network logic here
- `src/stores/`: Svelte stores for global state. Use `writable()` and `derived()`
- `src/utils/`: Pure functions, no side effects or store dependencies
- **Tailwind CSS**: Use utility classes. Custom styles go in `src/styles/` only when needed
- **State Management**: Prefer stores over props drilling. Update conversation via `conversationManager.ts`
- **Security**: Never commit API keys. Keys stored client-side only via Settings UI
