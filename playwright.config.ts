import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --config tests/browser/vite.config.ts",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
})
