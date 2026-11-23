import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5179",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5179 --strictPort",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
  },
});
