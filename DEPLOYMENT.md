# Production Build & Static Hosting Deployment

This project is a Svelte + Vite single-page application (SPA). It builds to a fully static site you can deploy to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, etc.).

Important note about API keys:
- This application calls APIs directly from the browser. Understand the risks of exposing any secrets in client-side code.
- Recommended: use environment-specific keys with least privileges and consider rate limits.

## 1) Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm (or pnpm/yarn; examples below use npm)

## 2) Build for production

```bash
npm ci
npm run build
```

The production build outputs to the `dist/` directory.

## 3) Local preview (optional)

Serve the built site locally to verify:

```bash
npx serve -s dist -l 4173
```

Then open http://localhost:4173

Alternatively:
```bash
python3 -m http.server --directory dist 4173
```

## 4) Deploy options

### A. GitHub Pages (with CI/CD)

This repo includes a workflow `.github/workflows/deploy-pages.yml` that:
- Builds the app on pushes to `main`
- Publishes the `dist/` folder to GitHub Pages

Setup steps:
1. In GitHub, go to Settings → Pages → Build and deployment → Source: GitHub Actions.
2. Push/merge to `main`. The workflow will build and deploy automatically.
3. Your site will be available at https://<your-username>.github.io/<your-repo>/ or your configured custom domain.

If your site is deployed under a subpath (project pages), you may need to set `base` in your Vite config to `"/<REPO_NAME>/"` to ensure asset paths resolve correctly.

For SPAs using client-side routing on GitHub Pages, consider adding a `404.html` fallback that mirrors `index.html`.

### B. Netlify (zero-config with SPA routing)

This repo includes:
- `netlify.toml` (build + publish settings and SPA fallback)
- `public/_redirects` (ensures SPA routes work: `/* /index.html 200`)

Two common ways:

- Connect your Git repo in Netlify UI:
  - Build command: `npm run build`
  - Publish directory: `dist`

- Or via CLI:
  ```bash
  npx netlify deploy --dir=dist --prod
  ```

### C. Vercel

Vercel auto-detects Vite:
- Connect your Git repo in Vercel.
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

This repo includes a `vercel.json` that sets the output directory. SPA fallback is usually handled automatically; if you use custom routes with subpaths, configure rewrites in Vercel Project Settings.

### D. Cloudflare Pages

- Project settings:
  - Build command: `npm run build`
  - Build output directory: `dist`
- Deploy via connected repo or CF Pages CLI.

### E. Generic static hosts (S3, Azure Static Web Apps, Nginx, etc.)

Upload the contents of `dist/` to your bucket or server. For SPAs, configure a fallback to `index.html`:
- Nginx (example):
  ```
  location / {
    try_files $uri /index.html;
  }
  ```

## 5) CI/CD Notes

- The GitHub Pages workflow focuses on deployment. If you want CI to also run smoke tests in a browser context, you can:
  - Use Playwright or Puppeteer to open the site and invoke `window.SmoothGPTTestHarness.runAll()` (ensure your API key is available in the environment/UI).
  - Export results as artifacts or emit logs for your CI to parse.
- Keep type-only imports for test harness types to avoid runtime import errors in the browser.

## 6) Troubleshooting

- Blank page or 404s on refresh with nested routes:
  - Ensure your static host serves SPA fallback to `index.html`.
  - For GitHub Pages under subpath, set Vite `base` to `"/<REPO_NAME>/"` and rebuild.
- 404s for assets after deploy:
  - Check that your build artifact contains `dist/assets/...`.
  - Verify the publish/output directory is set to `dist`.
- API errors in production:
  - Confirm the API key is configured in the UI and the selected model is valid.
  - Open the Debug Panel and use "Show Debug Info" for quick diagnostics.
