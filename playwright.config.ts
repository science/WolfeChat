import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests-e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'nonlive',
      testMatch: 'tests-e2e/nonlive/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live',
      testMatch: 'tests-e2e/live/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      timeout: 60_000,
    },
    {
      name: 'live-regression',
      testMatch: 'tests-e2e/live-regression/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      timeout: 60_000,
      fullyParallel: false,
      workers: 1,
      dependencies: ['live'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
