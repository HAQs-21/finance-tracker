import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FinanceState } from "../src/domain/types.ts";

async function openApp(page: Page) {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /A place for every possibility/i }),
  ).toBeVisible();
}

async function navigate(
  page: Page,
  tab: "My plan" | "Activity" | "Insights" | "My space",
) {
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
    includeHidden: true,
  });
  await expect(navigation).toBeAttached();
  if (await navigation.isVisible())
    await navigation.getByRole("button", { name: tab, exact: true }).click();
  else
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", {
        name: tab === "My plan" ? "Plan" : tab,
        exact: true,
      })
      .click();
}

async function addEarnings(
  page: Page,
  rupees: string,
  note = "A project well done",
) {
  await page
    .locator(".savings-card")
    .getByRole("button", { name: "Add earnings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Something came your way.",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Amount in PKR", exact: true })
    .fill(rupees);
  await dialog
    .getByRole("textbox", { name: "Transaction note", exact: true })
    .fill(note);
  await dialog
    .getByRole("button", { name: "Add to Savings", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

async function createBudget(page: Page, category: string, rupees: string) {
  await page.getByRole("button", { name: "New budget", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Give it a place.",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Budget category" })
    .selectOption({ label: category });
  await dialog
    .getByRole("textbox", { name: "Monthly budget amount" })
    .fill(rupees);
  await dialog
    .getByRole("button", { name: "Create budget", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

const categoryCard = (page: Page, category: string) =>
  page.locator(".budget-card").filter({
    has: page.getByRole("button", {
      name: `Open ${category} budget`,
      exact: true,
    }),
  });

async function openExpense(page: Page, category = "Food") {
  await categoryCard(page, category)
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  return page.getByRole("dialog", { name: "A little everyday.", exact: true });
}

async function addExpense(
  page: Page,
  rupees: string,
  note: string,
  category = "Food",
) {
  const dialog = await openExpense(page, category);
  await dialog
    .getByRole("textbox", { name: "Amount in PKR", exact: true })
    .fill(rupees);
  await dialog
    .getByRole("textbox", { name: "Transaction note", exact: true })
    .fill(note);
  await dialog
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

async function readLedger(page: Page): Promise<FinanceState> {
  return page.evaluate(async () => {
    const request = <T>(value: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        value.onsuccess = () => resolve(value.result);
        value.onerror = () => reject(value.error);
      });
    const database = await request(indexedDB.open("MorrowFinance"));
    const names = [
      "metadata",
      "categories",
      "templates",
      "budgets",
      "journal",
      "archives",
    ];
    const transaction = database.transaction(names, "readonly");
    const values = await Promise.all(
      names.map((name) => request(transaction.objectStore(name).getAll())),
    );
    database.close();
    const metadata = values[0][0] as Record<string, unknown>;
    const header = { ...metadata };
    delete header.key;
    const archive = values[5].find((value) => value.id === "legacy") as
      { data?: unknown } | undefined;
    return {
      ...header,
      categories: values[1],
      templates: values[2],
      budgets: values[3],
      journal: values[4],
      ...(archive?.data ? { legacy: archive.data } : {}),
    } as unknown as FinanceState;
  });
}

function netSavings(state: FinanceState) {
  return state.journal.reduce((sum, entry) => sum + entry.savingsDelta, 0);
}
function foodAmounts(state: FinanceState, month = state.activeMonth) {
  const category = state.categories.find(
    (item) => item.name.toLowerCase() === "food",
  )!;
  const budget = state.budgets.find(
    (item) => item.categoryId === category.id && item.month === month,
  )!;
  const entries = state.journal.filter((entry) => entry.budgetId === budget.id);
  return {
    budget,
    available: entries.reduce((sum, entry) => sum + entry.budgetDelta, 0),
    spent: entries.reduce((sum, entry) => sum + entry.spentDelta, 0),
  };
}

function records(state: FinanceState) {
  const sort = <T extends { id: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: state.id,
    schemaVersion: state.schemaVersion,
    currency: state.currency,
    createdAt: state.createdAt,
    activeMonth: state.activeMonth,
    categories: sort(state.categories),
    templates: sort(state.templates),
    budgets: sort(state.budgets),
    journal: sort(state.journal),
    legacy: state.legacy,
  };
}

async function takePreview(page: Page, testInfo: TestInfo, filename: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(filename),
    fullPage: true,
    animations: "disabled",
  });
  await testInfo.attach(filename, {
    path: testInfo.outputPath(filename),
    contentType: "image/png",
  });
}

test("funded envelopes enforce the cap, reserve only increases, and keep next month uncharged", async ({
  page,
}) => {
  await openApp(page);
  await addEarnings(page, "40000", "October salary");
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*40,000/,
  );
  await createBudget(page, "Food", "8000");
  await addExpense(page, "1200", "Lunch with the family");
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*32,000/,
  );
  await expect(categoryCard(page, "Food").locator(".budget-amount")).toHaveText(
    /Rs\s*6,800/,
  );

  const before = await readLedger(page);
  const blocked = await openExpense(page);
  await blocked
    .getByRole("textbox", { name: "Amount in PKR", exact: true })
    .fill("7000");
  await blocked
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await expect(blocked.getByRole("alert")).toContainText("Increase its limit");
  expect(records(await readLedger(page))).toEqual(records(before));
  await blocked
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Adjust Food budget", exact: true })
    .click();
  const adjustment = page.getByRole("dialog", {
    name: "A little more room.",
    exact: true,
  });
  await adjustment
    .getByRole("textbox", { name: "Monthly budget amount" })
    .fill("10000");
  await adjustment
    .getByRole("button", { name: "Save budget", exact: true })
    .click();
  await expect(adjustment).toBeHidden();
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*30,000/,
  );
  await expect(categoryCard(page, "Food").locator(".budget-amount")).toHaveText(
    /Rs\s*8,800/,
  );
  await addExpense(page, "7000", "A stocked pantry");
  await expect(categoryCard(page, "Food").locator(".budget-amount")).toHaveText(
    /Rs\s*1,800/,
  );

  await page
    .getByRole("button", { name: "Preview next month", exact: true })
    .click();
  await expect(
    page.getByText("Recurring plans are ready for next month.", {
      exact: false,
    }),
  ).toBeVisible();
  const after = await readLedger(page);
  const future = after.budgets.find(
    (item) => item.categoryId === "food" && item.month > after.activeMonth,
  )!;
  expect(future.limit).toBe(1_000_000);
  expect(future.funding).toBe("unfunded");
  expect(netSavings(after)).toBe(3_000_000);
  expect(
    after.journal.filter((entry) => entry.budgetId === future.id),
  ).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*30,000/,
  );
});

test("legacy IndexedDB migration preserves raw records and reconciles historical transfers without double counting", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!location.pathname.endsWith("/__morrow_seed__")) return;
    const local = new Date();
    const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const month = date.slice(0, 7);
    local.setMonth(local.getMonth() - 1, 1);
    const previous = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}`;
    const ready = new Promise<void>((resolve, reject) => {
      const opened = indexedDB.open("FinanceTrackerApp", 1);
      opened.onupgradeneeded = () => {
        opened.result.createObjectStore("transactions", {
          keyPath: "id",
          autoIncrement: true,
        });
        opened.result.createObjectStore("budgets", { keyPath: "category" });
        opened.result.createObjectStore("savings", {
          keyPath: "id",
          autoIncrement: true,
        });
      };
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const database = opened.result;
        const transaction = database.transaction(
          ["transactions", "budgets", "savings"],
          "readwrite",
        );
        transaction.objectStore("transactions").put({
          id: 71,
          amount: 40000,
          type: "INCOME",
          date,
          category: "Income",
          description: "Exact original earnings note",
        });
        transaction.objectStore("transactions").put({
          id: 93,
          amount: 3000,
          type: "EXPENSE",
          date,
          category: "food",
          description: "Original lunch — اردو",
        });
        transaction
          .objectStore("budgets")
          .put({ category: `Food@${month}`, amount: 8000, month });
        transaction
          .objectStore("budgets")
          .put({ category: `Food@${previous}`, amount: 2000, month: previous });
        transaction.objectStore("savings").put({
          id: 8,
          amount: 20000,
          type: "DEPOSIT",
          date,
          description: "Transfer, not earnings",
        });
        transaction.objectStore("savings").put({
          id: 9,
          amount: 5000,
          type: "WITHDRAW",
          date,
          description: "Transfer back",
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    Object.defineProperty(window, "__legacyReady", { value: ready });
  });
  await page.route("**/__morrow_seed__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Synthetic migration fixture</title>",
    }),
  );
  await page.goto("./__morrow_seed__");
  await page.evaluate(
    () => (window as unknown as { __legacyReady: Promise<void> }).__legacyReady,
  );
  await openApp(page);
  await expect(
    page.getByText("Your history has a new home.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*32,000/,
  );
  await expect(categoryCard(page, "Food").locator(".budget-amount")).toHaveText(
    /Rs\s*5,000/,
  );
  const migrated = await readLedger(page);
  expect(migrated.legacy?.raw.transactions).toHaveLength(2);
  expect(migrated.legacy?.raw.savings).toHaveLength(2);
  expect(migrated.legacy?.raw.budgets).toHaveLength(2);
  expect(migrated.legacy?.report.netFunds).toBe(3_700_000);
  expect(
    migrated.journal.find((entry) => entry.legacyId === "transaction:93")?.note,
  ).toBe("Original lunch — اردو");
  expect(foodAmounts(migrated).spent).toBe(300_000);
  expect(
    migrated.budgets.find((budget) => budget.month < migrated.activeMonth)
      ?.limit,
  ).toBe(200_000);
  await page.reload();
  expect(records(await readLedger(page))).toEqual(records(migrated));
  const originalCount = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("FinanceTrackerApp");
        request.onsuccess = () => {
          const count = request.result
            .transaction("transactions", "readonly")
            .objectStore("transactions")
            .count();
          count.onsuccess = () => {
            request.result.close();
            resolve(count.result);
          };
          count.onerror = () => reject(count.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(originalCount).toBe(2);
  await navigate(page, "Activity");
  await page.getByRole("textbox", { name: "Search transactions" }).fill("اردو");
  await expect(
    page.getByRole("button", { name: /Original lunch — اردو/ }),
  ).toBeVisible();
});

test("complete JSON download and reviewed restore reproduce exact financial records and preserve a recovery copy", async ({
  page,
}, testInfo) => {
  await openApp(page);
  await addEarnings(page, "40000");
  await createBudget(page, "Food", "8000");
  await addExpense(page, "1200", "A record to recover");
  const original = await readLedger(page);
  await navigate(page, "My space");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Complete JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const file = testInfo.outputPath("verified-recovery.json");
  await download.saveAs(file);
  const backup = await readFile(file, "utf8");
  expect(JSON.parse(backup).state.journal).toHaveLength(
    original.journal.length,
  );
  await navigate(page, "My plan");
  await addEarnings(page, "1000", "Change after the checkpoint");
  expect(netSavings(await readLedger(page))).toBe(3_300_000);
  await navigate(page, "My space");
  await page.getByRole("button", { name: "Restore JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Restore a little certainty.",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Or paste backup JSON" })
    .fill(backup);
  await dialog
    .getByRole("button", { name: "Verify and preview", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Review before restoring." }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Restore this backup", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const restored = await readLedger(page);
  expect(records(restored)).toEqual(records(original));
  expect(restored.revision).toBeGreaterThan(original.revision);
  const copies = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const opened = indexedDB.open("MorrowFinance");
        opened.onsuccess = () => {
          const request = opened.result
            .transaction("recoveries", "readonly")
            .objectStore("recoveries")
            .getAll();
          request.onsuccess = () => {
            opened.result.close();
            resolve(
              request.result.map((value: { reason: string }) => value.reason),
            );
          };
          request.onerror = () => reject(request.error);
        };
        opened.onerror = () => reject(opened.error);
      }),
  );
  expect(copies).toContain("Before restoring a backup");
  await navigate(page, "My plan");
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*32,000/,
  );
});

test("closing and reopening an envelope keeps every expense and restores only its unused funds", async ({
  page,
}) => {
  await openApp(page);
  await addEarnings(page, "40000");
  await createBudget(page, "Food", "8000");
  await addExpense(page, "1200", "History that must survive");
  await page
    .getByRole("button", { name: "Open Food budget", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "Food", exact: true });
  await detail
    .getByRole("button", { name: "Close this envelope", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Confirm close", exact: true })
    .click();
  await expect(detail).toBeHidden();
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*38,800/,
  );
  const closed = await readLedger(page);
  expect(foodAmounts(closed).spent).toBe(120_000);
  expect(foodAmounts(closed).budget.status).toBe("closed");
  await page
    .getByText("Closed envelopes · history preserved", { exact: true })
    .click();
  await page
    .locator(".archived-budgets")
    .getByRole("button", { name: /Food/ })
    .click();
  await detail
    .getByRole("button", { name: "Reopen this envelope", exact: true })
    .click();
  await expect(
    detail.getByText("History that must survive", { exact: true }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*32,000/,
  );
  expect(foodAmounts(await readLedger(page)).available).toBe(680_000);
});

test("night preferences persist, dialogs support Escape, and populated layouts fit both target screens", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openApp(page);
  await addEarnings(page, "40000", "October salary");
  await createBudget(page, "Food", "8000");
  await createBudget(page, "Transport", "5000");
  await createBudget(page, "Utilities", "7000");
  await addExpense(page, "1200", "A very good lunch");
  await addExpense(page, "850", "The way home", "Transport");
  await expect(page.locator(".budget-card")).toHaveCount(3);
  await expect(page.locator(".savings-amount-button")).toHaveText(
    /Rs\s*20,000/,
  );
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(fits).toBe(true);
  await takePreview(page, testInfo, `morrow-plan-${testInfo.project.name}.png`);
  await page
    .locator(".savings-card")
    .getByRole("button", { name: "Add earnings", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.getByRole("button", { name: "Hide amounts", exact: true }).click();
  await expect(page.locator(".savings-amount-button")).toHaveText("••••••");
  await navigate(page, "My space");
  await page.getByRole("button", { name: "Charcoal", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "charcoal");
  await navigate(page, "My plan");
  await expect(page.locator(".savings-amount-button")).toHaveText("••••••");
  await page.getByRole("button", { name: "Show amounts", exact: true }).click();
  await navigate(page, "Insights");
  await expect(page.locator("main h1")).toBeVisible();
  await takePreview(
    page,
    testInfo,
    `morrow-insights-${testInfo.project.name}.png`,
  );
  expect(errors).toEqual([]);
});

test("expense corrections and refund reversals preserve audit history and recalculate the envelope", async ({
  page,
}) => {
  await openApp(page);
  await addEarnings(page, "40000");
  await createBudget(page, "Food", "8000");
  await addExpense(page, "1200", "Lunch to correct");
  await navigate(page, "Activity");
  await page.getByRole("button", { name: /Lunch to correct/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Correct record", exact: true })
    .click();
  const correction = page.getByRole("dialog", {
    name: "A small correction.",
    exact: true,
  });
  await correction
    .getByRole("textbox", { name: "Amount in PKR", exact: true })
    .fill("1500");
  await correction
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(correction).toBeHidden();
  expect(foodAmounts(await readLedger(page)).spent).toBe(150_000);
  await page.getByRole("button", { name: /Lunch to correct/ }).click();
  const transaction = page.getByRole("dialog", {
    name: "Lunch to correct",
    exact: true,
  });
  await transaction
    .getByRole("button", { name: "Record a refund", exact: true })
    .click();
  await transaction
    .getByRole("textbox", { name: "Refund amount · PKR", exact: true })
    .fill("300");
  await transaction
    .getByRole("button", { name: "Save refund", exact: true })
    .click();
  await expect(transaction).toBeHidden();
  expect(foodAmounts(await readLedger(page)).available).toBe(680_000);
  await page.getByRole("button", { name: /Refund · Lunch to correct/ }).click();
  const refund = page.getByRole("dialog", {
    name: "Refund · Lunch to correct",
    exact: true,
  });
  await refund.getByRole("button", { name: "Reverse", exact: true }).click();
  await refund
    .getByRole("button", { name: "Confirm reversal", exact: true })
    .click();
  await expect(refund).toBeHidden();
  const after = await readLedger(page);
  expect(foodAmounts(after).spent).toBe(150_000);
  expect(foodAmounts(after).available).toBe(650_000);
  expect(
    after.journal.filter((entry) => entry.kind === "reversal"),
  ).toHaveLength(2);
  expect(
    after.journal.filter((entry) => entry.kind === "expense"),
  ).toHaveLength(2);
});

test("navigation keeps Activity filters and motion-enabled sheets dismiss cleanly", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openApp(page);
  await addEarnings(page, "40000");
  await createBudget(page, "Food", "8000");
  await addExpense(page, "500", "A coffee to remember");
  await navigate(page, "Activity");
  await page
    .getByRole("textbox", { name: "Search transactions" })
    .fill("coffee");
  await navigate(page, "Insights");
  await navigate(page, "Activity");
  await expect(
    page.getByRole("textbox", { name: "Search transactions" }),
  ).toHaveValue("coffee");
  await expect(
    page.getByRole("button", { name: /A coffee to remember/ }),
  ).toBeVisible();
  await navigate(page, "My plan");
  await page
    .getByRole("button", { name: "Open Food budget", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Food", exact: true });
  await expect(dialog).toBeVisible();
  if (testInfo.project.name === "android-layout") {
    const handle = await dialog
      .getByRole("button", { name: "Dismiss sheet", exact: true })
      .boundingBox();
    expect(handle).not.toBeNull();
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2 + 150,
      { steps: 12 },
    );
    await page.mouse.up();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toBeHidden();
  expect(foodAmounts(await readLedger(page)).available).toBe(750_000);
});
