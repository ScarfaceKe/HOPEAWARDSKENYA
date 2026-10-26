import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level tests for the voting UI.
 *
 * Each spec drives the real client in Chromium against the Vite dev server and
 * answers every `/api` call itself, so the suite needs no Postgres and can never
 * send a real M-Pesa prompt or spend money.
 *
 * Run: `npm run test:browser`
 * On a fresh machine install the browser once: `npx playwright install chromium`
 */
const PORT = 5199;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // `retain-on-failure`, not `on-first-retry`: these tests run with no
    // retries, so a retry-only trace would never be written and a failure would
    // leave nothing to inspect.
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    // The client only: the vote dialog talks to /api, and the tests own those
    // responses. Booting the Express app would need a database for no gain.
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
