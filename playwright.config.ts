import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const browsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter((path): path is string => Boolean(path));
const executablePath = browsers.find((path) => existsSync(path));

export default defineConfig({
  testDir: "./tests",
  testMatch: "app.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:4173/finance-tracker/",
    browserName: "chromium",
    launchOptions: executablePath ? { executablePath } : {},
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    serviceWorkers: "block",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "android-layout",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/finance-tracker/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
