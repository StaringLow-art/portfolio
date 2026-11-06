import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

/**
 * Les tests tournent sur le site de production (dist/), servi par `astro preview`.
 * Lancer `npm run build` avant `npm run test` (ou utiliser `npm run verify`).
 */
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Firefox : le bug de révélation des images n'apparaissait que dans Firefox
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: /revelation\.spec\.ts/ },
  ],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
