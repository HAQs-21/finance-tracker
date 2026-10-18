import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import {
  applyCommands,
  createEmptyState,
  localDate,
} from "../src/domain/index.ts";

const label = process.argv[2] || "profile";
const date = localDate();
let state = createEmptyState(date);
const commands = [
  { type: "add-income", amount: 40_000_000, date, note: "Performance fixture" },
];
for (const category of state.categories.slice(0, 8))
  commands.push({
    type: "set-budget",
    categoryId: category.id,
    month: date.slice(0, 7),
    amount: 4_000_000,
    scope: "month-and-future",
  });
for (let index = 0; index < 5000; index++)
  commands.push({
    type: "add-expense",
    categoryId: state.categories[0].id,
    amount: 100,
    date,
    note: `Fixture ${index}`,
  });
state = applyCommands(state, commands);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { stdio: "ignore", windowsHide: true },
);
let browser;
try {
  const url = "http://127.0.0.1:4174/finance-tracker/";
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Server is starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const executablePath = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => path && existsSync(path));
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator(".mobile-nav").waitFor();
  await page.evaluate(async (fixture) => {
    const request = (operation) =>
      new Promise((resolve, reject) => {
        operation.onsuccess = () => resolve(operation.result);
        operation.onerror = () => reject(operation.error);
      });
    const db = await request(indexedDB.open("MorrowFinance"));
    const tx = db.transaction(
      ["metadata", "categories", "templates", "budgets", "journal"],
      "readwrite",
    );
    for (const name of ["categories", "templates", "budgets", "journal"]) {
      const table = tx.objectStore(name);
      table.clear();
      fixture[name].forEach((row) => table.put(row));
    }
    const { categories, templates, budgets, journal, ...header } = fixture;
    tx.objectStore("metadata").put({ key: "state", ...header });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, state);
  await page.reload();
  await page.locator(".budget-card").first().waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.evaluate(() => {
    window.__profile = { gaps: [], longTasks: [], running: true };
    let last;
    const frame = (time) => {
      if (last) window.__profile.gaps.push(time - last);
      last = time;
      if (window.__profile.running) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new PerformanceObserver((list) =>
      window.__profile.longTasks.push(
        ...list.getEntries().map((entry) => entry.duration),
      ),
    ).observe({ type: "longtask" });
  });
  const navigation = [];
  for (let round = 0; round < 3; round++) {
    for (const index of [1, 2, 3, 0]) {
      const start = performance.now();
      await page.locator(".mobile-nav button").nth(index).click();
      await page
        .locator(
          [".plan-page", ".activity-page", ".insights-page", ".settings-page"][
            index
          ],
        )
        .waitFor();
      navigation.push(performance.now() - start);
      await page.waitForTimeout(180);
    }
  }
  for (let round = 0; round < 5; round++) {
    await page
      .getByRole("button", { name: "Open Food budget", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Food", exact: true });
    await dialog.waitFor();
    await dialog.locator(".sheet-header button").click();
    await dialog.waitFor({ state: "hidden" });
  }
  await page.evaluate(async () => {
    for (let index = 0; index < 40; index++) {
      window.scrollBy(0, index < 20 ? 45 : -45);
      await new Promise(requestAnimationFrame);
    }
  });
  const measurements = await page.evaluate(() => {
    window.__profile.running = false;
    return {
      ...window.__profile,
      words: document.querySelector("main").innerText.split(/\s+/).length,
      elements: document.querySelectorAll("*").length,
    };
  });
  const percentile = (values, fraction) =>
    values.toSorted((a, b) => a - b)[
      Math.min(values.length - 1, Math.floor(values.length * fraction))
    ] || 0;
  const report = {
    label,
    fixtureEntries: 5000,
    cpuThrottle: 6,
    frames: measurements.gaps.length,
    p50FrameMs: percentile(measurements.gaps, 0.5),
    p95FrameMs: percentile(measurements.gaps, 0.95),
    p99FrameMs: percentile(measurements.gaps, 0.99),
    framesOver20msPercent:
      (measurements.gaps.filter((gap) => gap > 20).length /
        measurements.gaps.length) *
      100,
    longTaskCount: measurements.longTasks.length,
    longTaskTotalMs: measurements.longTasks.reduce(
      (sum, duration) => sum + duration,
      0,
    ),
    longestTaskMs: Math.max(0, ...measurements.longTasks),
    navigationMedianMs: percentile(navigation, 0.5),
    wordsOnPlan: measurements.words,
    DOMElements: measurements.elements,
    errors,
  };
  await writeFile(
    `.android-tools/perf-${label}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
