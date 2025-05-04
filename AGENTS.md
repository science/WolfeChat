# Repository Guidelines

## Project Structure & Module Organization
- `src/lib/`: Svelte UI components (e.g., `Sidebar.svelte`, `Settings.svelte`).
- `src/managers/`: Feature logic and orchestration (conversations, images, PDFs).
- `src/services/`: External APIs and network calls (`openaiService.ts`).
- `src/stores/`: Svelte stores for app state.
- `src/renderers/`: Markdown/HTML renderers and code blocks.
- `src/utils/`: Small helpers; keep pure and tested by usage.
- `public/`: Static assets copied as-is. `dist/`: Vite build output committed for Pages deploy.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server on your network (`--host`).
- `npm run build`: Production build to `dist/` (required before merging UI changes).
- `npm run preview`: Preview the production build locally.
- `npm run check`: Type-check Svelte/TS via `svelte-check`.

## Coding Style & Naming Conventions
- Indent with 2 spaces; keep imports ordered (libs → local).
- Components: PascalCase (`Topbar.svelte`), variables/functions: camelCase, assets: kebab-case.
- Keep UI in `lib/`, side effects in `managers/` and `services/`; state in `stores/`.
- Tailwind is available; prefer utility classes over ad-hoc CSS. Place shared styles in `src/styles/` when needed.

## Testing Guidelines
- No unit test framework is configured. Validate changes by:
  - Running `npm run check` (types) and `npm run dev` (manual flows: chat, PDFs, TTS, Vision, streaming stop/resume).
  - Checking console for warnings and ensuring no regressions in mobile layout.
- If introducing tests, group under `src/__tests__/` and discuss tooling in the PR before adding dependencies.

## Commit & Pull Request Guidelines
- Commits: concise, imperative mood; reference issues (`Fix #123`) when relevant.
- PRs must include: summary, user impact, test steps, and screenshots/GIFs for UI changes.
- For any UI/behavior change, run `npm run build` and commit updated `dist/`. The GitHub Action publishes `dist/` from `main` to `gh-pages`.

## Security & Configuration Tips
- Do not commit secrets. API keys are entered via Settings and kept client-side; never hardcode them.
- This is a static client app. Avoid adding server code; if needed, keep secrets server-side and document the change.
