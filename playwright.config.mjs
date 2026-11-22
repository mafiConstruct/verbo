import { defineConfig } from '@playwright/test';

// UI regression tests: every check asserts a VISIBLE change after a tap,
// not just that a click executed. Runs against a local static server.
// Uses installed Playwright browsers by default; set CHROME_PATH to point
// at a system Chrome/Chromium instead (no browser download needed).

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8787',
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] }
      : {},
  },
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:8787/index.html',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
