import type {
  BudgetTemplate,
  Category,
  CommandContext,
  FinanceCommand,
  FinanceState,
  JournalEntry,
  MonthlyBudget,
} from "./types.ts";

export type * from "./types.ts";
export { migrateLegacy } from "./migration.ts";
export {
  validateState,
  serializeBackup,
  parseBackup,
  backupChecksum,
} from "./backup.ts";

export class FinanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new FinanceError(code, message);
}
function newId(): string {
  return globalThis.crypto.randomUUID();
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function nextMonth(month: string): string {
  assertMonth(month);
  const [year, number] = month.split("-").map(Number);
  return number === 12
    ? `${year + 1}-01`
    : `${year}-${String(number + 1).padStart(2, "0")}`;
}
function assertMonth(month: unknown): asserts month is string {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    fail("INVALID_MONTH", "Choose a valid month.");
}
function assertDate(date: unknown): asserts date is string {
  if (typeof date !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date))
    fail("INVALID_DATE", "Choose a valid date.");
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    fail("INVALID_DATE", "Choose a valid calendar date.");
}
function assertAmount(
  amount: unknown,
  allowZero = false,
): asserts amount is number {
  if (!Number.isSafeInteger(amount) || (amount as number) < (allowZero ? 0 : 1))
    fail(
      "INVALID_AMOUNT",
      "Enter a positive amount with at most two decimal places.",
    );
}
export function toMinor(amount: number | string): number {
  const text = String(amount).trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/.test(text))
    fail("INVALID_AMOUNT", "Enter an amount with at most two decimal places.");
  const normalized = text.replace(/,/g, "");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value))
    fail("INVALID_AMOUNT", "This amount is too large.");
  return negative ? -value : value;
}
const formatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
export function formatMoney(amount: number): string {
  return `Rs ${formatter.format(amount / 100)}`;
}

const defaults: Array<[string, string, string, string]> = [
  ["food", "Food", "#e9b67b", "utensils"],
  ["transport", "Transport", "#9bb9cb", "car"],
  ["shopping", "Shopping", "#c2a5d8", "shopping-bag"],
  ["utilities", "Utilities", "#d2cb8b", "zap"],
  ["rent", "Rent", "#a3b997", "house"],
  ["health", "Health", "#df9e9e", "heart"],
  ["entertainment", "Entertainment", "#b4a8dd", "play"],
  ["tax", "Tax", "#b3b7bf", "receipt"],
  ["other", "Other", "#99b5aa", "circle"],
];

export function createEmptyState(date = localDate()): FinanceState {
  assertDate(date);
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: newId(),
    currency: "PKR",
    revision: 0,
    createdAt: now,
    updatedAt: now,
    activeMonth: date.slice(0, 7),
    categories: defaults.map(([id, name, color, icon]) => ({
      id,
      name,
      color,
      icon,
      archived: false,
    })),
    templates: [],
    budgets: [],
    journal: [],
  };
}

export function savingsBalance(state: FinanceState): number {
  return projectFinance(state).savings;
}
export function budgetBalance(state: FinanceState, budgetId: string): number {
  return projectFinance(state).budgets[budgetId]?.available ?? 0;
}
export function budgetSpent(state: FinanceState, budgetId: string): number {
  return projectFinance(state).budgets[budgetId]?.spent ?? 0;
}
export function getMonthlyBudgets(
  state: FinanceState,
  month: string,
): MonthlyBudget[] {
  return state.budgets.filter((budget) => budget.month === month);
}
export function isReversed(state: FinanceState, entryId: string): boolean {
  return state.journal.some((entry) => entry.reversesId === entryId);
}
export function getActiveEntries(state: FinanceState): JournalEntry[] {
  const reversed = new Set(
    state.journal
      .filter((entry) => entry.reversesId)
      .map((entry) => entry.reversesId),
  );
  return state.journal.filter(
    (entry) =>
      !reversed.has(entry.id) &&
      (entry.kind === "income" ||
        entry.kind === "expense" ||
        entry.kind === "refund"),
  );
}
export function templateForMonth(
  state: FinanceState,
  categoryId: string,
  month: string,
): BudgetTemplate | undefined {
  // Templates are append-only revisions. The newest applicable edit wins, including
  // over older scheduled changes, while edits never apply before effectiveMonth.
  return state.templates
    .filter(
      (template) =>
        template.categoryId === categoryId && template.effectiveMonth <= month,
    )
    .reduce<BudgetTemplate | undefined>(
      (latest, candidate) =>
        !latest || candidate.version > latest.version ? candidate : latest,
      undefined,
    );
}
export function availableMonths(state: FinanceState): string[] {
  return [
    ...new Set([
      state.activeMonth,
      nextMonth(state.activeMonth),
      ...state.budgets.map((b) => b.month),
      ...state.journal.map((e) => e.month),
    ]),
  ]
    .sort()
    .reverse();
}

interface FinanceProjection {
  savings: number;
  budgets: Record<string, { available: number; spent: number }>;
  allocated: number;
}
const projectionCache = new WeakMap<FinanceState, FinanceProjection>();
function cacheProjection(
  state: FinanceState,
  projection: FinanceProjection,
): FinanceProjection {
  Object.values(projection.budgets).forEach(Object.freeze);
  Object.freeze(projection.budgets);
  Object.freeze(projection);
  projectionCache.set(state, projection);
  return projection;
}

/** One pass on load, then constant-time selectors. Immutable command results update it incrementally. */
export function projectFinance(state: FinanceState) {
  const cached = projectionCache.get(state);
  if (cached) return cached;
  const budgets: Record<string, { available: number; spent: number }> =
    Object.fromEntries(
      state.budgets.map((b) => [b.id, { available: 0, spent: 0 }]),
    );
  let savings = 0;
  for (const entry of state.journal) {
    savings += entry.savingsDelta;
    if (entry.budgetId && budgets[entry.budgetId]) {
      budgets[entry.budgetId].available += entry.budgetDelta;
      budgets[entry.budgetId].spent += entry.spentDelta;
    }
  }
  return cacheProjection(state, {
    savings,
    budgets,
    allocated: Object.values(budgets).reduce((sum, b) => sum + b.available, 0),
  });
}

function categoryById(
  state: FinanceState,
  id: string,
  allowArchived = false,
): Category {
  const category = state.categories.find((item) => item.id === id);
  if (!category || (category.archived && !allowArchived))
    fail(
      "CATEGORY_MISSING",
      "This category is unavailable. Choose another category.",
    );
  return category;
}
function budgetById(state: FinanceState, id: string): MonthlyBudget {
  const budget = state.budgets.find((item) => item.id === id);
  if (!budget)
    fail(
      "BUDGET_MISSING",
      "The budget could not be found. Your expenses are still preserved.",
    );
  return budget;
}

/** Commands operate on a fresh draft and return only after all invariants succeed. */
export function applyCommand(
  original: FinanceState,
  command: FinanceCommand,
  context: CommandContext = {},
): FinanceState {
  return applyCommands(original, [command], context);
}

/** One atomic batch without copying or replaying the journal for every imported row. */
export function applyCommands(
  original: FinanceState,
  commands: readonly FinanceCommand[],
  context: CommandContext = {},
): FinanceState {
  if (commands.length === 0) return original;
  const state: FinanceState = {
    ...original,
    categories: original.categories.map((c) => ({ ...c })),
    templates: original.templates.map((t) => ({ ...t })),
    budgets: original.budgets.map((b) => ({ ...b })),
    journal: [...original.journal],
  };
  const id = context.id ?? newId;
  const now = context.now ?? new Date().toISOString();
  const today = localDate(new Date(now));
  const initial = projectFinance(original);
  const projected: FinanceProjection = {
    savings: initial.savings,
    allocated: initial.allocated,
    budgets: Object.fromEntries(
      Object.entries(initial.budgets).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ),
  };
  const available = (budgetId: string) =>
    projected.budgets[budgetId]?.available ?? 0;
  const spent = (budgetId: string) => projected.budgets[budgetId]?.spent ?? 0;
  const reversedIds = new Set(
    original.journal.filter((e) => e.reversesId).map((e) => e.reversesId),
  );
  const append = (entry: Omit<JournalEntry, "id">) => {
    // Canonical JSON-safe records round-trip without undefined optional fields.
    state.journal.push(
      Object.fromEntries(
        Object.entries({ ...entry, id: id() }).filter(
          ([, value]) => value !== undefined,
        ),
      ) as unknown as JournalEntry,
    );
    projected.savings += entry.savingsDelta;
    projected.allocated += entry.budgetDelta;
    if (entry.budgetId) {
      const budget = (projected.budgets[entry.budgetId] ??= {
        available: 0,
        spent: 0,
      });
      budget.available += entry.budgetDelta;
      budget.spent += entry.spentDelta;
      if (
        !Number.isSafeInteger(budget.available) ||
        !Number.isSafeInteger(budget.spent)
      )
        fail(
          "AMOUNT_OVERFLOW",
          "The combined amount is too large to store safely.",
        );
    }
    if (
      !Number.isSafeInteger(projected.savings) ||
      !Number.isSafeInteger(projected.allocated)
    )
      fail(
        "AMOUNT_OVERFLOW",
        "The combined amount is too large to store safely.",
      );
    if (entry.reversesId) reversedIds.add(entry.reversesId);
  };
  const entry = (
    kind: JournalEntry["kind"],
    date: string,
    amount: number,
    note: string,
    extra: Partial<JournalEntry> = {},
  ) => {
    append({
      kind,
      date,
      month: date.slice(0, 7),
      amount,
      note,
      savingsDelta: 0,
      budgetDelta: 0,
      spentDelta: 0,
      ...extra,
    });
  };
  const requireFunds = (amount: number) => {
    if (projected.savings < amount)
      fail(
        "INSUFFICIENT_SAVINGS",
        `Savings needs ${formatMoney(amount - projected.savings)} more to fund this change.`,
      );
  };
  const putTemplate = (
    categoryId: string,
    month: string,
    amount: number,
    enabled = true,
  ) => {
    const version =
      state.templates.reduce(
        (maximum, template) => Math.max(maximum, template.version),
        0,
      ) + 1;
    state.templates.push({
      id: id(),
      version,
      categoryId,
      amount,
      effectiveMonth: month,
      enabled,
    });
  };
  const ensureBudget = (
    categoryId: string,
    month: string,
    amount: number,
  ): MonthlyBudget => {
    let budget = state.budgets.find(
      (b) => b.categoryId === categoryId && b.month === month,
    );
    if (budget?.status === "closed")
      fail(
        "BUDGET_CLOSED",
        "This budget is closed. Its history remains available.",
      );
    if (!budget) {
      budget = {
        id: id(),
        categoryId,
        month,
        limit: amount,
        status: "open",
        funding: "unfunded",
      };
      state.budgets.push(budget);
      projected.budgets[budget.id] = { available: 0, spent: 0 };
    }
    return budget;
  };
  const fund = (budget: MonthlyBudget, strict: boolean) => {
    if (budget.month !== state.activeMonth || budget.status !== "open") return;
    const needed =
      Math.max(0, budget.limit - spent(budget.id)) - available(budget.id);
    if (needed > 0) {
      if (projected.savings < needed) {
        budget.funding = "unfunded";
        if (strict) requireFunds(needed);
        return;
      }
      entry(
        "allocation",
        `${budget.month}-01`,
        needed,
        `Fund ${categoryById(state, budget.categoryId, true).name}`,
        {
          categoryId: budget.categoryId,
          budgetId: budget.id,
          savingsDelta: -needed,
          budgetDelta: needed,
        },
      );
    } else if (needed < 0) {
      entry(
        "release",
        `${budget.month}-01`,
        -needed,
        "Return unused allocation",
        {
          categoryId: budget.categoryId,
          budgetId: budget.id,
          savingsDelta: -needed,
          budgetDelta: needed,
        },
      );
    }
    budget.funding = "funded";
  };
  const syncPlans = (fromMonth: string) => {
    for (const budget of state.budgets) {
      if (
        budget.status !== "open" ||
        budget.month < fromMonth ||
        budget.month <= state.activeMonth
      )
        continue;
      const template = templateForMonth(state, budget.categoryId, budget.month);
      if (template) {
        if (!template.enabled) budget.status = "closed";
        else budget.limit = template.amount;
      }
    }
    for (const category of state.categories.filter((c) => !c.archived)) {
      const month =
        fromMonth > state.activeMonth
          ? fromMonth
          : nextMonth(state.activeMonth);
      const template = templateForMonth(state, category.id, month);
      if (
        template?.enabled &&
        !state.budgets.some(
          (b) => b.month === month && b.categoryId === category.id,
        )
      )
        ensureBudget(category.id, month, template.amount);
    }
  };
  const addExpense = (
    data: Extract<FinanceCommand, { type: "add-expense" | "update-expense" }>,
  ) => {
    assertAmount(data.amount);
    assertDate(data.date);
    if (data.date > today)
      fail(
        "FUTURE_DATE",
        "Future expenses cannot spend today’s category funds.",
      );
    const category = categoryById(state, data.categoryId);
    const month = data.date.slice(0, 7);
    if (month !== state.activeMonth)
      fail(
        "MONTH_NOT_ACTIVE",
        "Expenses belong to the active month. Historical records remain available in Activity.",
      );
    const budget = state.budgets.find(
      (b) =>
        b.categoryId === category.id &&
        b.month === month &&
        b.status === "open",
    );
    if (!budget)
      fail(
        "BUDGET_REQUIRED",
        `Create a funded ${category.name} budget before adding this expense.`,
      );
    const remaining = available(budget.id);
    if (data.amount > remaining)
      fail(
        "BUDGET_EXCEEDED",
        `${category.name} has ${formatMoney(remaining)} available. Increase its limit by ${formatMoney(data.amount - remaining)} first.`,
      );
    entry("expense", data.date, data.amount, data.note?.trim() ?? "", {
      categoryId: category.id,
      budgetId: budget.id,
      budgetDelta: -data.amount,
      spentDelta: data.amount,
    });
  };
  const reverse = (entryId: string, date: string) => {
    assertDate(date);
    if (date > today)
      fail("FUTURE_DATE", "A reversal cannot be dated in the future.");
    const target = state.journal.find((e) => e.id === entryId);
    if (!target || !["income", "expense", "refund"].includes(target.kind))
      fail(
        "ENTRY_NOT_REVERSIBLE",
        "This record cannot be removed directly. Adjust its budget instead.",
      );
    if (reversedIds.has(target.id))
      fail("ALREADY_REVERSED", "This record has already been reversed.");
    if (
      state.journal.some(
        (e) => e.refundOfId === target.id && !reversedIds.has(e.id),
      )
    )
      fail(
        "HAS_REFUNDS",
        "Reverse the refunds on this expense before changing it.",
      );
    let savingsDelta = -target.savingsDelta;
    let budgetDelta = -target.budgetDelta;
    const budget = target.budgetId
      ? budgetById(state, target.budgetId)
      : undefined;
    if (
      budget?.status === "open" &&
      target.kind === "expense" &&
      target.legacyId &&
      target.budgetDelta === 0
    ) {
      // Historical overages must not create an envelope larger than its limit.
      const headroom = Math.max(
        0,
        budget.limit -
          (spent(budget.id) - target.spentDelta) -
          available(budget.id),
      );
      budgetDelta = Math.min(target.amount, headroom);
      savingsDelta = target.amount - budgetDelta;
    }
    if (budget?.status === "closed" && budgetDelta !== 0) {
      savingsDelta += budgetDelta;
      budgetDelta = 0;
    }
    if (savingsDelta < 0) requireFunds(-savingsDelta);
    if (budget && budgetDelta < 0 && available(budget.id) < -budgetDelta)
      fail(
        "REFUND_ALREADY_SPENT",
        "This refund has already been spent. Fund the category before reversing it.",
      );
    entry(
      "reversal",
      date,
      target.amount,
      `Reversal: ${target.note || target.kind}`,
      {
        categoryId: target.categoryId,
        budgetId: target.budgetId,
        reversesId: target.id,
        savingsDelta,
        budgetDelta,
        spentDelta: -target.spentDelta,
      },
    );
  };

  let changed = false;
  for (const command of commands) {
    if (command.type === "rollover" && command.month <= state.activeMonth)
      continue;
    changed = true;
    switch (command.type) {
      case "add-income": {
        assertAmount(command.amount);
        assertDate(command.date);
        if (command.date.slice(0, 7) !== state.activeMonth)
          fail(
            "MONTH_NOT_ACTIVE",
            "Add earnings to the active month. Future money is not available to spend yet.",
          );
        if (command.date > today)
          fail(
            "FUTURE_DATE",
            "Future earnings are not available to fund budgets yet.",
          );
        entry(
          "income",
          command.date,
          command.amount,
          command.note?.trim() ?? "",
          { savingsDelta: command.amount },
        );
        break;
      }
      case "update-income": {
        assertAmount(command.amount);
        assertDate(command.date);
        const target = state.journal.find((e) => e.id === command.entryId);
        if (target?.kind !== "income")
          fail("INCOME_REQUIRED", "Select earnings to edit.");
        if (command.date.slice(0, 7) !== state.activeMonth)
          fail(
            "MONTH_NOT_ACTIVE",
            "Earnings corrections belong to the active month.",
          );
        if (command.date > today)
          fail(
            "FUTURE_DATE",
            "Future earnings are not available to fund budgets yet.",
          );
        // Apply the net correction atomically: editing a fully allocated income to the
        // same/larger amount must not temporarily require the original funds in Savings.
        if (command.amount < target.amount)
          requireFunds(target.amount - command.amount);
        if (reversedIds.has(target.id))
          fail(
            "ALREADY_REVERSED",
            "These earnings have already been reversed.",
          );
        entry(
          "reversal",
          today,
          target.amount,
          `Reversal: ${target.note || "income"}`,
          {
            reversesId: target.id,
            categoryId: target.categoryId,
            budgetId: target.budgetId,
            savingsDelta: -target.savingsDelta,
            budgetDelta: -target.budgetDelta,
            spentDelta: -target.spentDelta,
          },
        );
        entry(
          "income",
          command.date,
          command.amount,
          command.note?.trim() ?? "",
          { savingsDelta: command.amount },
        );
        break;
      }
      case "add-expense":
        addExpense(command);
        break;
      case "set-budget": {
        assertAmount(command.amount);
        assertMonth(command.month);
        categoryById(state, command.categoryId);
        if (command.month < state.activeMonth)
          fail(
            "MONTH_CLOSED",
            "Past monthly limits are preserved. Change the current or a future month.",
          );
        const scope = command.scope ?? "month-and-future";
        if (scope !== "future") {
          const budget = ensureBudget(
            command.categoryId,
            command.month,
            command.amount,
          );
          if (command.amount < spent(budget.id))
            fail(
              "BELOW_SPENT",
              "A limit cannot be lower than expenses already recorded.",
            );
          budget.limit = command.amount;
          fund(budget, true);
        }
        if (scope !== "month") {
          const month =
            scope === "future" && command.month === state.activeMonth
              ? nextMonth(command.month)
              : command.month;
          putTemplate(command.categoryId, month, command.amount);
          syncPlans(month);
        }
        break;
      }
      case "fund-budget": {
        const budget = budgetById(state, command.budgetId);
        if (budget.status !== "open" || budget.month !== state.activeMonth)
          fail(
            "BUDGET_NOT_ACTIVE",
            "Only an open current-month budget can be funded.",
          );
        fund(budget, true);
        break;
      }
      case "archive-budget": {
        const budget = budgetById(state, command.budgetId);
        if (budget.status === "closed")
          fail("BUDGET_CLOSED", "This budget is already closed.");
        const remaining = available(budget.id);
        if (remaining > 0)
          entry(
            "release",
            today,
            remaining,
            "Close budget and return unspent funds",
            {
              categoryId: budget.categoryId,
              budgetId: budget.id,
              savingsDelta: remaining,
              budgetDelta: -remaining,
            },
          );
        budget.status = "closed";
        if (command.stopRecurrence) {
          const month =
            budget.month > state.activeMonth
              ? budget.month
              : nextMonth(state.activeMonth);
          putTemplate(budget.categoryId, month, budget.limit, false);
          syncPlans(month);
        }
        break;
      }
      case "reopen-budget": {
        const budget = budgetById(state, command.budgetId);
        if (budget.status !== "closed" || budget.month !== state.activeMonth)
          fail(
            "BUDGET_NOT_ACTIVE",
            "Only a closed budget in the current month can be reopened.",
          );
        categoryById(state, budget.categoryId);
        budget.status = "open";
        fund(budget, true);
        break;
      }
      case "reverse-entry":
        reverse(command.entryId, command.date ?? today);
        break;
      case "update-expense": {
        const target = state.journal.find((e) => e.id === command.entryId);
        if (target?.kind !== "expense")
          fail("EXPENSE_REQUIRED", "Select an expense to edit.");
        reverse(command.entryId, today);
        addExpense(command);
        break;
      }
      case "refund-expense": {
        assertAmount(command.amount);
        assertDate(command.date);
        if (command.date > today)
          fail("FUTURE_DATE", "A refund cannot be dated in the future.");
        const target = state.journal.find((e) => e.id === command.entryId);
        if (!target || target.kind !== "expense" || reversedIds.has(target.id))
          fail("EXPENSE_REQUIRED", "Select an active expense to refund.");
        const refunded = state.journal
          .filter((e) => e.refundOfId === target.id && !reversedIds.has(e.id))
          .reduce((sum, e) => sum + e.amount, 0);
        if (command.amount + refunded > target.amount)
          fail(
            "REFUND_TOO_LARGE",
            "Refunds cannot exceed the original expense.",
          );
        const budget = target.budgetId
          ? budgetById(state, target.budgetId)
          : undefined;
        const restoredToBudget =
          budget?.status === "open"
            ? Math.min(
                command.amount,
                Math.max(
                  0,
                  budget.limit -
                    (spent(budget.id) - command.amount) -
                    available(budget.id),
                ),
              )
            : 0;
        entry(
          "refund",
          command.date,
          command.amount,
          command.note?.trim() || `Refund: ${target.note || "expense"}`,
          {
            categoryId: target.categoryId,
            budgetId: target.budgetId,
            refundOfId: target.id,
            savingsDelta: command.amount - restoredToBudget,
            budgetDelta: restoredToBudget,
            spentDelta: -command.amount,
          },
        );
        break;
      }
      case "add-category": {
        const name = command.name.trim();
        if (!name || name.length > 60)
          fail(
            "INVALID_CATEGORY",
            "Enter a category name between 1 and 60 characters.",
          );
        if (
          state.categories.some(
            (c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
          )
        )
          fail("CATEGORY_EXISTS", "A category with this name already exists.");
        state.categories.push({
          id: id(),
          name,
          color: command.color ?? "#99b5aa",
          icon: command.icon ?? "circle",
          archived: false,
        });
        break;
      }
      case "update-category": {
        const category = categoryById(state, command.id, true);
        if (command.name !== undefined) {
          const name = command.name.trim();
          if (!name || name.length > 60)
            fail(
              "INVALID_CATEGORY",
              "Enter a category name between 1 and 60 characters.",
            );
          if (
            state.categories.some(
              (c) =>
                c.id !== category.id &&
                c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
            )
          )
            fail(
              "CATEGORY_EXISTS",
              "A category with this name already exists.",
            );
          category.name = name;
        }
        if (command.color) category.color = command.color;
        if (command.icon) category.icon = command.icon;
        if (command.archived !== undefined) {
          if (
            command.archived &&
            state.budgets.some(
              (b) => b.categoryId === category.id && b.status === "open",
            )
          )
            fail(
              "CATEGORY_IN_USE",
              "Close this category’s open budgets before archiving it.",
            );
          category.archived = command.archived;
          if (command.archived)
            putTemplate(category.id, nextMonth(state.activeMonth), 0, false);
        }
        break;
      }
      case "rollover": {
        assertMonth(command.month);
        // A large accidental date jump must not create thousands of monthly records.
        if (
          Number(command.month.slice(0, 4)) -
            Number(state.activeMonth.slice(0, 4)) >
          20
        )
          fail(
            "MONTH_TOO_FAR",
            "Check the device date before advancing more than 20 years.",
          );
        while (state.activeMonth < command.month) {
          for (const budget of state.budgets.filter(
            (b) => b.month === state.activeMonth && b.status === "open",
          )) {
            const remaining = available(budget.id);
            if (remaining > 0)
              entry(
                "release",
                `${nextMonth(state.activeMonth)}-01`,
                remaining,
                "Month close: unused funds returned",
                {
                  budgetId: budget.id,
                  categoryId: budget.categoryId,
                  savingsDelta: remaining,
                  budgetDelta: -remaining,
                },
              );
            budget.status = "closed";
          }
          state.activeMonth = nextMonth(state.activeMonth);
          const active: MonthlyBudget[] = [];
          for (const category of state.categories.filter((c) => !c.archived)) {
            const template = templateForMonth(
              state,
              category.id,
              state.activeMonth,
            );
            let budget = state.budgets.find(
              (b) =>
                b.categoryId === category.id && b.month === state.activeMonth,
            );
            if (!budget && template?.enabled)
              budget = ensureBudget(
                category.id,
                state.activeMonth,
                template.amount,
              );
            if (budget?.status === "open") active.push(budget);
          }
          const needed = active.reduce(
            (sum, b) =>
              sum + Math.max(0, b.limit - spent(b.id) - available(b.id)),
            0,
          );
          // Insufficient funds never silently prioritize one category over another.
          if (projected.savings >= needed)
            active.forEach((b) => fund(b, false));
          else
            active.forEach((b) => {
              b.funding = "unfunded";
            });
        }
        syncPlans(nextMonth(state.activeMonth));
        break;
      }
      default:
        fail(
          "UNKNOWN_COMMAND",
          "This action is not supported by this version of Morrow.",
        );
    }
  }
  if (!changed) return original;
  if (
    !Number.isSafeInteger(projected.savings) ||
    Object.values(projected.budgets).some(
      (b) =>
        !Number.isSafeInteger(b.available) || !Number.isSafeInteger(b.spent),
    )
  ) {
    fail(
      "AMOUNT_OVERFLOW",
      "The combined amount is too large to store safely.",
    );
  }
  if (Object.values(projected.budgets).some((b) => b.available < 0))
    fail("BUDGET_EXCEEDED", "This change would overdraw a category.");
  for (const budget of state.budgets)
    if (budget.status === "open" && budget.month === state.activeMonth) {
      budget.funding =
        available(budget.id) >= Math.max(0, budget.limit - spent(budget.id))
          ? "funded"
          : "unfunded";
    }
  state.revision += 1;
  state.updatedAt = now;
  cacheProjection(state, projected);
  return state;
}
