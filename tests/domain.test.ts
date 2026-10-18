import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  applyCommands,
  backupChecksum,
  budgetBalance,
  budgetSpent,
  createEmptyState,
  FinanceError,
  getActiveEntries,
  migrateLegacy,
  nextMonth,
  parseBackup,
  projectFinance,
  savingsBalance,
  serializeBackup,
  templateForMonth,
  toMinor,
  validateState,
} from "../src/domain/index.ts";
import type { FinanceCommand, FinanceState } from "../src/domain/types.ts";

let sequence = 0;
const run = (state: FinanceState, command: FinanceCommand) =>
  applyCommand(state, command, {
    now: `${state.activeMonth}-17T12:00:00Z`,
    id: () => `test-${++sequence}`,
  });
const empty = () => createEmptyState("2026-10-17");
const income = (state = empty(), amount = 4_000_000) =>
  run(state, {
    type: "add-income",
    amount,
    date: "2026-10-17",
    note: "Salary",
  });
const planned = () =>
  run(income(), {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 800_000,
  });
const food = (state: FinanceState, month = "2026-10") =>
  state.budgets.find((b) => b.categoryId === "food" && b.month === month)!;
const expense = (state: FinanceState, amount = 120_000) =>
  run(state, {
    type: "add-expense",
    categoryId: "food",
    amount,
    date: "2026-10-17",
    note: "Lunch",
  });
const error = (code: string) => (value: unknown) =>
  value instanceof FinanceError && value.code === code;

test("earnings go to Savings; category creation reserves money once; spending uses only category funds", () => {
  const state = expense(planned());
  assert.equal(savingsBalance(state), 3_200_000);
  assert.equal(budgetBalance(state, food(state).id), 680_000);
  assert.equal(budgetSpent(state, food(state).id), 120_000);
  assert.equal(
    savingsBalance(state) + projectFinance(state).allocated,
    3_880_000,
  );
  validateState(state);
});

test("commands are immutable, including commands that fail midway", () => {
  const state = planned();
  const before = JSON.stringify(state);
  assert.throws(() => expense(state, 800_001), error("BUDGET_EXCEEDED"));
  assert.equal(JSON.stringify(state), before);
  const next = expense(state);
  assert.equal(JSON.stringify(state), before);
  assert.notEqual(next, state);
});

test("strict category cap applies at exact paisa precision", () => {
  const state = expense(planned(), 800_000);
  assert.equal(budgetBalance(state, food(state).id), 0);
  assert.throws(() => expense(state, 1), error("BUDGET_EXCEEDED"));
});

test("expenses require an open funded category rather than drawing directly from Savings", () => {
  assert.throws(() => expense(income()), error("BUDGET_REQUIRED"));
});

test("budget increases reserve only the difference, decreases release only the difference", () => {
  let state = expense(planned());
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 1_000_000,
  });
  assert.equal(savingsBalance(state), 3_000_000);
  assert.equal(budgetBalance(state, food(state).id), 880_000);
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 200_000,
  });
  assert.equal(savingsBalance(state), 3_800_000);
  assert.equal(budgetBalance(state, food(state).id), 80_000);
  assert.throws(
    () =>
      run(state, {
        type: "set-budget",
        categoryId: "food",
        month: "2026-10",
        amount: 119_999,
      }),
    error("BELOW_SPENT"),
  );
});

test("insufficient Savings rolls back both budget and template changes", () => {
  const state = income(empty(), 100);
  assert.throws(
    () =>
      run(state, {
        type: "set-budget",
        categoryId: "food",
        month: "2026-10",
        amount: 101,
      }),
    error("INSUFFICIENT_SAVINGS"),
  );
  assert.equal(state.budgets.length, 0);
  assert.equal(state.templates.length, 0);
});

test("next month is a plan, not a second upfront allocation", () => {
  const state = planned();
  assert.equal(food(state, "2026-11").limit, 800_000);
  assert.equal(food(state, "2026-11").funding, "unfunded");
  assert.equal(budgetBalance(state, food(state, "2026-11").id), 0);
  assert.equal(savingsBalance(state), 3_200_000);
});

test("future-only edits leave the current monthly limit and balance untouched", () => {
  const state = run(planned(), {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 900_000,
    scope: "future",
  });
  assert.equal(food(state).limit, 800_000);
  assert.equal(food(state, "2026-11").limit, 900_000);
  assert.equal(savingsBalance(state), 3_200_000);
});

test("one-month exceptions leave the recurring template unchanged", () => {
  const state = run(planned(), {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 900_000,
    scope: "month",
  });
  assert.equal(food(state).limit, 900_000);
  assert.equal(food(state, "2026-11").limit, 800_000);
  assert.equal(templateForMonth(state, "food", "2027-01")?.amount, 800_000);
});

test("latest applicable template revision supersedes older scheduled changes, never prior months", () => {
  let state = planned();
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-12",
    amount: 1_000_000,
  });
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 900_000,
  });
  assert.equal(templateForMonth(state, "food", "2026-12")?.amount, 900_000);
  assert.equal(templateForMonth(state, "food", "2026-09"), undefined);
  assert.equal(food(state, "2026-12").limit, 900_000);
});

test("rollover releases leftovers, preserves spending, and funds the next month exactly once", () => {
  let state = expense(planned());
  const oldBudget = food(state).id;
  state = run(state, { type: "rollover", month: "2026-11" });
  assert.equal(state.activeMonth, "2026-11");
  assert.equal(budgetBalance(state, oldBudget), 0);
  assert.equal(budgetSpent(state, oldBudget), 120_000);
  assert.equal(state.budgets.find((b) => b.id === oldBudget)?.status, "closed");
  assert.equal(budgetBalance(state, food(state, "2026-11").id), 800_000);
  assert.equal(savingsBalance(state), 3_080_000);
  assert.equal(run(state, { type: "rollover", month: "2026-11" }), state);
  validateState(state);
});

test("rollover shortage creates unfunded plans with no arbitrary category preference or negative Savings", () => {
  let state = income(empty(), 100_000);
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-11",
    amount: 80_000,
  });
  state = run(state, {
    type: "set-budget",
    categoryId: "transport",
    month: "2026-11",
    amount: 80_000,
  });
  state = run(state, { type: "rollover", month: "2026-11" });
  assert.equal(savingsBalance(state), 100_000);
  assert.equal(
    state.budgets
      .filter((b) => b.month === "2026-11")
      .every((b) => b.funding === "unfunded"),
    true,
  );
  state = run(state, {
    type: "fund-budget",
    budgetId: food(state, "2026-11").id,
  });
  assert.equal(savingsBalance(state), 20_000);
  assert.equal(budgetBalance(state, food(state, "2026-11").id), 80_000);
  validateState(state);
});

test("skipping months applies close/generation consistently without repeated allocations", () => {
  const state = run(expense(planned()), { type: "rollover", month: "2027-01" });
  assert.equal(savingsBalance(state), 3_080_000);
  assert.equal(
    state.budgets
      .filter((b) => b.categoryId === "food" && b.month < "2027-01")
      .every((b) => b.status === "closed"),
    true,
  );
  assert.equal(budgetBalance(state, food(state, "2027-01").id), 800_000);
  assert.equal(nextMonth("2026-12"), "2027-01");
});

test("archiving releases only unspent money and never deletes expenses", () => {
  const initial = expense(planned());
  const budgetId = food(initial).id;
  const state = run(initial, { type: "archive-budget", budgetId });
  assert.equal(budgetBalance(state, budgetId), 0);
  assert.equal(budgetSpent(state, budgetId), 120_000);
  assert.equal(savingsBalance(state), 3_880_000);
  assert.equal(
    getActiveEntries(state).filter((e) => e.kind === "expense").length,
    1,
  );
  const reopened = run(state, { type: "reopen-budget", budgetId });
  assert.equal(budgetBalance(reopened, budgetId), 680_000);
  assert.equal(savingsBalance(reopened), 3_200_000);
  validateState(reopened);
});

test("stop recurrence is explicit and leaves the current historical record intact", () => {
  const initial = expense(planned());
  const state = run(initial, {
    type: "archive-budget",
    budgetId: food(initial).id,
    stopRecurrence: true,
  });
  assert.equal(templateForMonth(state, "food", "2026-11")?.enabled, false);
});

test("reversing an expense restores its original category with an immutable audit trail", () => {
  let state = expense(planned());
  const target = state.journal.find((e) => e.kind === "expense")!;
  state = run(state, { type: "reverse-entry", entryId: target.id });
  assert.equal(budgetBalance(state, food(state).id), 800_000);
  assert.equal(budgetSpent(state, food(state).id), 0);
  assert.equal(
    state.journal.some((e) => e.id === target.id),
    true,
  );
  assert.equal(
    getActiveEntries(state).some((e) => e.id === target.id),
    false,
  );
  assert.throws(
    () => run(state, { type: "reverse-entry", entryId: target.id }),
    error("ALREADY_REVERSED"),
  );
  validateState(state);
});

test("editing an expense transfers its charge atomically and rejects an unfunded destination", () => {
  let state = expense(planned());
  const target = state.journal.find((e) => e.kind === "expense")!;
  assert.throws(
    () =>
      run(state, {
        type: "update-expense",
        entryId: target.id,
        categoryId: "transport",
        amount: 200_000,
        date: "2026-10-17",
      }),
    error("BUDGET_REQUIRED"),
  );
  assert.equal(budgetSpent(state, food(state).id), 120_000);
  state = run(state, {
    type: "set-budget",
    categoryId: "transport",
    month: "2026-10",
    amount: 300_000,
  });
  state = run(state, {
    type: "update-expense",
    entryId: target.id,
    categoryId: "transport",
    amount: 200_000,
    date: "2026-10-17",
  });
  assert.equal(budgetSpent(state, food(state).id), 0);
  const transport = state.budgets.find(
    (b) => b.categoryId === "transport" && b.month === "2026-10",
  )!;
  assert.equal(budgetBalance(state, transport.id), 100_000);
  validateState(state);
});

test("reversing allocated earnings is blocked; editing allocated earnings uses only the net difference", () => {
  let state = run(income(empty(), 800_000), {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 800_000,
  });
  const target = state.journal.find((e) => e.kind === "income")!;
  assert.throws(
    () => run(state, { type: "reverse-entry", entryId: target.id }),
    error("INSUFFICIENT_SAVINGS"),
  );
  state = run(state, {
    type: "update-income",
    entryId: target.id,
    amount: 900_000,
    date: "2026-10-17",
  });
  assert.equal(savingsBalance(state), 100_000);
  assert.equal(
    getActiveEntries(state).filter((e) => e.kind === "income").length,
    1,
  );
  validateState(state);
});

test("partial refunds return to an open category and cannot exceed the original expense", () => {
  let state = expense(planned());
  const target = state.journal.find((e) => e.kind === "expense")!;
  state = run(state, {
    type: "refund-expense",
    entryId: target.id,
    amount: 50_000,
    date: "2026-10-17",
  });
  assert.equal(budgetSpent(state, food(state).id), 70_000);
  assert.equal(budgetBalance(state, food(state).id), 730_000);
  assert.throws(
    () =>
      run(state, {
        type: "refund-expense",
        entryId: target.id,
        amount: 70_001,
        date: "2026-10-17",
      }),
    error("REFUND_TOO_LARGE"),
  );
  assert.throws(
    () => run(state, { type: "reverse-entry", entryId: target.id }),
    error("HAS_REFUNDS"),
  );
  validateState(state);
});

test("refunds after month close go to Savings without reopening the old budget", () => {
  let state = expense(planned());
  const target = state.journal.find((e) => e.kind === "expense")!;
  const budgetId = food(state).id;
  state = run(state, { type: "rollover", month: "2026-11" });
  const savings = savingsBalance(state);
  state = run(state, {
    type: "refund-expense",
    entryId: target.id,
    amount: 120_000,
    date: "2026-11-02",
  });
  assert.equal(savingsBalance(state), savings + 120_000);
  assert.equal(budgetBalance(state, budgetId), 0);
  assert.equal(budgetSpent(state, budgetId), 0);
  validateState(state);
});

test("categories have stable identities; case-insensitive duplicates and destructive archives are blocked", () => {
  assert.throws(
    () => run(empty(), { type: "add-category", name: " food " }),
    error("CATEGORY_EXISTS"),
  );
  let state = run(empty(), {
    type: "update-category",
    id: "food",
    name: "Groceries",
  });
  assert.equal(
    state.categories.find((c) => c.id === "food")?.name,
    "Groceries",
  );
  state = planned();
  assert.throws(
    () => run(state, { type: "update-category", id: "food", archived: true }),
    error("CATEGORY_IN_USE"),
  );
});

test("all entry paths reject invalid calendar dates, noninteger money, zero amounts, and future income", () => {
  assert.throws(
    () => run(empty(), { type: "add-income", amount: 100, date: "2026-02-30" }),
    error("INVALID_DATE"),
  );
  assert.throws(() => income(empty(), 0.5), error("INVALID_AMOUNT"));
  assert.throws(() => income(empty(), 0), error("INVALID_AMOUNT"));
  assert.throws(
    () => run(empty(), { type: "add-income", amount: 100, date: "2026-11-01" }),
    error("MONTH_NOT_ACTIVE"),
  );
  assert.equal(toMinor("1,234.05"), 123405);
  assert.throws(() => toMinor("0.001"), error("INVALID_AMOUNT"));
});

test("oversized combined amounts cannot silently lose integer precision", () => {
  const state = income(empty(), Number.MAX_SAFE_INTEGER);
  assert.throws(() => income(state, 1), error("AMOUNT_OVERFLOW"));
});

test("readable complete backups round-trip every financial record and reject corruption", () => {
  const state = expense(planned());
  const serialized = serializeBackup(state);
  assert.match(serialized, /Lunch/);
  assert.deepEqual(parseBackup(serialized), state);
  const broken = JSON.parse(serialized);
  broken.state.journal[0].amount++;
  assert.throws(() => parseBackup(broken), error("INVALID_BACKUP"));
  assert.throws(() => parseBackup("{no"), error("INVALID_BACKUP"));
});

test("backup validation rejects missing references, duplicate IDs, fake deltas, and negative envelope balances", () => {
  const state = expense(planned());
  const corrupted = structuredClone(state);
  corrupted.journal.find((e) => e.kind === "expense")!.categoryId = "missing";
  assert.throws(() => validateState(corrupted), error("INVALID_BACKUP"));
  const duplicate = structuredClone(state);
  duplicate.journal.push(duplicate.journal[0]);
  assert.throws(() => validateState(duplicate), error("INVALID_BACKUP"));
  const fake = structuredClone(state);
  fake.journal.find((e) => e.kind === "income")!.savingsDelta++;
  assert.throws(() => validateState(fake), error("INVALID_BACKUP"));
  const overdrawn = structuredClone(state);
  const originalExpense = overdrawn.journal.find((e) => e.kind === "expense")!;
  originalExpense.amount = 900_000;
  originalExpense.budgetDelta = -900_000;
  originalExpense.spentDelta = 900_000;
  assert.throws(() => validateState(overdrawn), error("INVALID_BACKUP"));
  const envelope = JSON.parse(serializeBackup(state));
  envelope.state.journal[0].id = "";
  envelope.checksum = backupChecksum(envelope.state);
  assert.throws(() => parseBackup(envelope), error("INVALID_BACKUP"));
});

const legacy = () => ({
  transactions: [
    {
      id: 1,
      type: "INCOME",
      amount: 40_000,
      date: "2026-10-01",
      category: "Income",
      description: "October salary",
    },
    {
      id: 2,
      type: "EXPENSE",
      amount: 3_000,
      date: "2026-10-06",
      category: "food",
      description: "Original note",
    },
  ],
  budgets: [{ category: "Food@2026-10", amount: 8_000, month: "2026-10" }],
  savings: [
    {
      id: 1,
      type: "DEPOSIT",
      amount: 20_000,
      date: "2026-10-01",
      description: "Move to vault",
    },
    {
      id: 2,
      type: "WITHDRAW",
      amount: 5_000,
      date: "2026-10-02",
      description: "Move back",
    },
  ],
});

test("migration preserves all source arrays and reserves only the unspent old limit without counting transfers as earnings", () => {
  const original = legacy();
  const { state, report } = migrateLegacy(original, "2026-10-17");
  assert.deepEqual(state.legacy?.raw, original);
  assert.equal(report.netFunds, 3_700_000);
  assert.equal(savingsBalance(state), 3_200_000);
  assert.equal(budgetBalance(state, food(state).id), 500_000);
  assert.equal(budgetSpent(state, food(state).id), 300_000);
  assert.equal(report.earnings, 4_000_000);
  assert.equal(
    state.journal.filter((e) => e.legacyId?.startsWith("savings:")).length,
    2,
  );
  assert.equal(
    state.journal.find((e) => e.legacyId === "transaction:2")?.note,
    "Original note",
  );
  validateState(state);
  assert.deepEqual(parseBackup(serializeBackup(state)), state);
});

test("migration normalizes category case, preserves hidden Savings ambiguities, invalid rows, and linked transfers", () => {
  const input = legacy();
  input.transactions.push({
    id: 3,
    type: "EXPENSE",
    amount: 20,
    date: "2026-10-07",
    category: "Savings",
    description: "Ambiguous",
  });
  input.transactions.push({
    id: 4,
    type: "EXPENSE",
    amount: 10,
    date: "bad",
    category: "Food",
    description: "Invalid date",
  });
  (input.transactions as unknown[]).push({
    id: 5,
    type: "EXPENSE",
    amount: 20_000,
    date: "2026-10-01",
    category: "Savings",
    savingsRecordId: 1,
  });
  const { state, report } = migrateLegacy(input, "2026-10-17");
  assert.equal(
    state.categories.filter((c) => c.name.toLowerCase() === "food").length,
    1,
  );
  assert.equal(report.ambiguousTransactions, 1);
  assert.equal(report.linkedTransfers, 1);
  assert.equal(report.issues.length, 2);
  assert.equal(state.legacy?.raw.transactions.length, 5);
  assert.equal(report.netFunds, 3_700_000);
  validateState(state);
});

test("migration preserves deficits and historical overages instead of inventing money or changing limits", () => {
  const input = legacy();
  input.transactions[0].amount = 1_000;
  const { state, report } = migrateLegacy(input, "2026-10-17");
  assert.equal(savingsBalance(state), -200_000);
  assert.equal(food(state).limit, 800_000);
  assert.equal(food(state).funding, "unfunded");
  assert.equal(budgetSpent(state, food(state).id), 300_000);
  assert.ok(report.issues.some((issue) => issue.source === "reconciliation"));
  validateState(state);
});

test("refund and reversal of migrated current expenses restore funding to the current envelope", () => {
  let state = migrateLegacy(legacy(), "2026-10-17").state;
  const target = state.journal.find((e) => e.legacyId === "transaction:2")!;
  state = run(state, {
    type: "refund-expense",
    entryId: target.id,
    amount: 50_000,
    date: "2026-10-17",
  });
  assert.equal(budgetBalance(state, food(state).id), 550_000);
  assert.equal(savingsBalance(state), 3_200_000);
  validateState(state);
  let reversed = migrateLegacy(legacy(), "2026-10-17").state;
  reversed = run(reversed, { type: "reverse-entry", entryId: target.id });
  assert.equal(budgetBalance(reversed, food(reversed).id), 800_000);
  assert.equal(savingsBalance(reversed), 3_200_000);
  validateState(reversed);
});

test("migrated historical months retain their own limits and spend without reserving historical funds", () => {
  const input = legacy();
  input.transactions.push({
    id: 3,
    type: "EXPENSE",
    amount: 1_000,
    date: "2026-09-01",
    category: "Food",
    description: "September",
  });
  input.budgets.push({
    category: "Food@2026-09",
    amount: 2_000,
    month: "2026-09",
  });
  const { state } = migrateLegacy(input, "2026-10-17");
  const september = food(state, "2026-09");
  assert.equal(september.status, "closed");
  assert.equal(september.limit, 200_000);
  assert.equal(budgetBalance(state, september.id), 0);
  assert.equal(budgetSpent(state, september.id), 100_000);
  assert.equal(savingsBalance(state), 3_100_000);
  validateState(state);
});

test("template revisions survive database primary-key reordering and full backup reload", () => {
  let state = planned();
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-11",
    amount: 1_000_000,
  });
  state = run(state, {
    type: "set-budget",
    categoryId: "food",
    month: "2026-10",
    amount: 900_000,
  });
  const loaded = { ...state, templates: [...state.templates].reverse() };
  assert.equal(templateForMonth(loaded, "food", "2026-11")?.amount, 900_000);
  assert.equal(
    templateForMonth(parseBackup(serializeBackup(loaded)), "food", "2026-11")
      ?.amount,
    900_000,
  );
});

test("same-month future money and expenses cannot change available funds early", () => {
  assert.throws(
    () => run(empty(), { type: "add-income", amount: 100, date: "2026-10-31" }),
    error("FUTURE_DATE"),
  );
  assert.throws(
    () =>
      run(planned(), {
        type: "add-expense",
        categoryId: "food",
        amount: 100,
        date: "2026-10-31",
      }),
    error("FUTURE_DATE"),
  );
});

test("projection selectors share one immutable cached projection and commands update it incrementally", () => {
  const initial = planned();
  const projection = projectFinance(initial);
  assert.equal(projectFinance(initial), projection);
  assert.throws(() => {
    projection.budgets[food(initial).id].available = 0;
  }, TypeError);
  const next = expense(initial);
  assert.equal(
    projectFinance(initial).budgets[food(initial).id].available,
    800_000,
  );
  assert.equal(projectFinance(next).budgets[food(next).id].available, 680_000);
});

test("an atomic import batch validates against prior rows and rolls back completely on a later failure", () => {
  const initial = planned();
  const commands: FinanceCommand[] = [
    {
      type: "add-expense",
      categoryId: "food",
      amount: 400_000,
      date: "2026-10-17",
    },
    {
      type: "add-expense",
      categoryId: "food",
      amount: 400_001,
      date: "2026-10-17",
    },
  ];
  assert.throws(
    () => applyCommands(initial, commands),
    error("BUDGET_EXCEEDED"),
  );
  assert.equal(budgetBalance(initial, food(initial).id), 800_000);
  commands[1].amount = 400_000;
  const next = applyCommands(initial, commands);
  assert.equal(budgetBalance(next, food(next).id), 0);
  assert.equal(next.revision, initial.revision + 1);
  validateState(next);
});

test("a 50,000-entry batch obeys caps and preserves totals without per-row journal replay", () => {
  const commands: FinanceCommand[] = Array.from({ length: 50_000 }, () => ({
    type: "add-expense",
    categoryId: "food",
    amount: 1,
    date: "2026-10-17",
  }));
  const next = applyCommands(planned(), commands);
  assert.equal(next.journal.length, 50_002);
  assert.equal(budgetBalance(next, food(next).id), 750_000);
  assert.equal(budgetSpent(next, food(next).id), 50_000);
  assert.equal(savingsBalance(next), 3_200_000);
  validateState(next);
});

test("refunds of migrated over-budget spending split correctly between the category cap and Savings", () => {
  const input = legacy();
  input.transactions[1].amount = 9_000;
  let state = migrateLegacy(input, "2026-10-17").state;
  const target = state.journal.find((e) => e.legacyId === "transaction:2")!;
  state = run(state, {
    type: "refund-expense",
    entryId: target.id,
    amount: 200_000,
    date: "2026-10-17",
  });
  assert.equal(budgetSpent(state, food(state).id), 700_000);
  assert.equal(budgetBalance(state, food(state).id), 100_000);
  assert.equal(savingsBalance(state), 3_200_000);
  validateState(state);
  let reversed = migrateLegacy(input, "2026-10-17").state;
  reversed = run(reversed, { type: "reverse-entry", entryId: target.id });
  assert.equal(budgetBalance(reversed, food(reversed).id), 800_000);
  assert.equal(savingsBalance(reversed), 3_200_000);
  validateState(reversed);
});

test("migration recurring limits follow the current default rather than a prior-month exception", () => {
  const input = legacy();
  input.budgets = [
    { category: "Food", amount: 8_000, month: "DEFAULT" },
    { category: "Food@2026-09", amount: 2_000, month: "2026-09" },
  ];
  const { state } = migrateLegacy(input, "2026-10-17");
  assert.equal(food(state).limit, 800_000);
  assert.equal(food(state, "2026-09").limit, 200_000);
  assert.equal(templateForMonth(state, "food", "2026-11")?.amount, 800_000);
  validateState(state);
});

test("migration reconciles the old whitespace exclusion behavior without losing actual recorded spending", () => {
  const input = legacy();
  input.transactions.push({
    id: 3,
    type: "EXPENSE",
    amount: 50,
    date: "2026-10-08",
    category: " Savings ",
    description: "Old app counted this expense",
  });
  const { state, report } = migrateLegacy(input, "2026-10-17");
  assert.equal(report.expenses, 305_000);
  assert.equal(report.ambiguousTransactions, 0);
  assert.equal(
    state.journal.find((e) => e.legacyId === "transaction:3")?.amount,
    5_000,
  );
  validateState(state);
});
