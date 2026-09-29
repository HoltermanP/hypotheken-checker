import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_PORT ?? 3100)

/**
 * E2E-tests draaien tegen `next dev` in E2E_TEST_MODE: inloggen via een testcookie (geen Clerk),
 * een verse lokale PGlite-database, lokale documentopslag en geen AI-sleutel (de app valt terug op
 * handmatig invullen en standaardteksten). Er zijn dus geen externe accounts nodig.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "nl-NL",
    trace: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/e2e-prepare.mjs && pnpm exec next dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      E2E_TEST_MODE: "1",
      DATABASE_URL: "pglite:./.pglite-e2e",
      ENCRYPTION_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
      CRON_SECRET: "e2e-cron-secret-0123456789",
      ANTHROPIC_API_KEY: "",
      BLOB_READ_WRITE_TOKEN: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
})
