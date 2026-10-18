import {
  createEmptyState,
  FinanceError,
  localDate,
  nextMonth,
} from "./index.ts";
import type {
  Category,
  FinanceState,
  JournalEntry,
  LegacyInput,
  MigrationReport,
} from "./types.ts";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const normalized = (name: string) => name.trim().toLocaleLowerCase();
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Source arrays remain byte-equivalent JSON in legacy.raw, including invalid or ambiguous records. */
export function migrateLegacy(
  input: LegacyInput,
  date = localDate(),
): { state: FinanceState; report: MigrationReport } {
  if (
    !input ||
    !Array.isArray(input.transactions) ||
    !Array.isArray(input.budgets) ||
    !Array.isArray(input.savings)
  ) {
    throw new FinanceError(
      "INVALID_LEGACY",
      "The legacy backup must contain transactions, budgets, and savings arrays.",
    );
  }
  const raw: LegacyInput = JSON.parse(JSON.stringify(input));
  const state = createEmptyState(date);
  const report: MigrationReport = {
    sourceTransactions: raw.transactions.length,
    importedTransactions: 0,
    linkedTransfers: 0,
    ambiguousTransactions: 0,
    sourceSavings: raw.savings.length,
    sourceBudgets: raw.budgets.length,
    earnings: 0,
    expenses: 0,
    netFunds: 0,
    availableSavings: 0,
    allocated: 0,
    issues: [],
  };
  const addIssue = (
    source: "transactions" | "budgets" | "savings" | "reconciliation",
    index: number,
    message: string,
  ) => report.issues.push({ source, index, message });
  const money = (value: unknown): number | undefined => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isSafeInteger(Math.round(value * 100))
    )
      return undefined;
    return Math.round(value * 100);
  };
  const dateValue = (value: unknown): string | undefined => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
      ? value
      : undefined;
  };
  const category = (name: unknown): Category => {
    const text =
      typeof name === "string" && name.trim() ? name.trim() : "General";
    let found = state.categories.find(
      (c) => normalized(c.name) === normalized(text),
    );
    if (!found) {
      found = {
        id: `legacy-category-${state.categories.length}`,
        name: text,
        color: "#99b5aa",
        icon: "circle",
        archived: false,
      };
      state.categories.push(found);
    }
    return found;
  };
  const push = (entry: Omit<JournalEntry, "id">, id: string) =>
    state.journal.push(
      Object.fromEntries(
        Object.entries({ ...entry, id }).filter(
          ([, value]) => value !== undefined,
        ),
      ) as unknown as JournalEntry,
    );
  const budgetRows: Array<{
    categoryId: string;
    month: string;
    amount: number;
    index: number;
  }> = [];
  raw.budgets.forEach((value, index) => {
    if (
      !object(value) ||
      typeof value.category !== "string" ||
      money(value.amount) === undefined
    ) {
      addIssue(
        "budgets",
        index,
        "Invalid budget retained unchanged in the original archive.",
      );
      return;
    }
    const suffix = value.category.match(/@([0-9]{4}-[0-9]{2})$/);
    const name = suffix
      ? value.category.slice(0, -suffix[0].length)
      : value.category;
    const sourceMonth =
      typeof value.month === "string" && value.month !== "DEFAULT"
        ? value.month
        : (suffix?.[1] ?? "DEFAULT");
    if (sourceMonth !== "DEFAULT" && !monthPattern.test(sourceMonth)) {
      addIssue(
        "budgets",
        index,
        "Invalid budget month retained in the original archive.",
      );
      return;
    }
    const categoryId = category(name).id;
    if (
      budgetRows.some(
        (b) => b.categoryId === categoryId && b.month === sourceMonth,
      )
    )
      addIssue(
        "budgets",
        index,
        "Case-variant budget collision preserved in archive; the last source limit wins.",
      );
    budgetRows.push({
      categoryId,
      month: sourceMonth,
      amount: money(value.amount)!,
      index,
    });
  });

  const validTransactions: Array<{
    row: Row;
    index: number;
    amount: number;
    date: string;
    categoryId: string;
    income: boolean;
  }> = [];
  raw.transactions.forEach((value, index) => {
    if (!object(value)) {
      addIssue(
        "transactions",
        index,
        "Invalid record retained in the original archive.",
      );
      return;
    }
    const amount = money(value.amount);
    const validDate = dateValue(value.date);
    if (
      amount === undefined ||
      !validDate ||
      !["INCOME", "EXPENSE"].includes(String(value.type))
    ) {
      addIssue(
        "transactions",
        index,
        "Invalid amount, type, or date retained unchanged in the original archive.",
      );
      return;
    }
    const name =
      typeof value.category === "string" ? value.category : "General";
    // Reconcile to the old app's actual exclusion rule, including its whitespace
    // behavior. Category normalization must not change what counted as spending.
    const linked = Boolean(value.savingsRecordId);
    const referencedSavings =
      linked &&
      raw.savings.some((s) => object(s) && s.id === value.savingsRecordId);
    const reserved = name.toLocaleLowerCase() === "savings";
    if (referencedSavings) {
      report.linkedTransfers++;
      return;
    }
    if (reserved || linked) {
      report.ambiguousTransactions++;
      addIssue(
        "transactions",
        index,
        "Legacy Savings/linked record was excluded by the old app. Preserved in archive for review; it is not invented income or spending.",
      );
      push(
        {
          kind: "adjustment",
          date: validDate,
          month: validDate.slice(0, 7),
          amount,
          note: `Legacy record requiring review: ${String(value.description ?? name)}`,
          categoryId: category(name).id,
          savingsDelta: 0,
          budgetDelta: 0,
          spentDelta: 0,
          legacyId: `transaction:${String(value.id ?? index)}`,
        },
        `legacy-review-${index}`,
      );
      return;
    }
    validTransactions.push({
      row: value,
      index,
      amount,
      date: validDate,
      categoryId: category(name).id,
      income: value.type === "INCOME",
    });
    if (value.amount !== amount / 100)
      addIssue(
        "transactions",
        index,
        "Amount rounded to paisa; its exact original representation is preserved in the archive.",
      );
  });

  const historicalMonths = [
    ...new Set(validTransactions.map((t) => t.date.slice(0, 7))),
  ];
  for (const source of budgetRows) {
    const months =
      source.month === "DEFAULT"
        ? [...new Set([...historicalMonths, state.activeMonth])]
        : [source.month];
    for (const month of months) {
      const applicable = budgetRows.filter(
        (b) =>
          b.categoryId === source.categoryId &&
          (b.month === month || b.month === "DEFAULT"),
      );
      const chosen =
        applicable.filter((b) => b.month === month).at(-1) ?? applicable.at(-1);
      if (
        !chosen ||
        state.budgets.some(
          (b) => b.categoryId === source.categoryId && b.month === month,
        )
      )
        continue;
      state.budgets.push({
        id: `legacy-budget-${source.categoryId}-${month}`,
        categoryId: source.categoryId,
        month,
        limit: chosen.amount,
        status: month < state.activeMonth ? "closed" : "open",
        funding: "unfunded",
      });
    }
  }
  validTransactions.forEach(
    ({ row, index, amount, date: transactionDate, categoryId, income }) => {
      const budget = state.budgets.find(
        (b) =>
          b.categoryId === categoryId &&
          b.month === transactionDate.slice(0, 7),
      );
      push(
        {
          kind: income ? "income" : "expense",
          date: transactionDate,
          month: transactionDate.slice(0, 7),
          amount,
          note: typeof row.description === "string" ? row.description : "",
          categoryId,
          budgetId: income ? undefined : budget?.id,
          savingsDelta: income ? amount : -amount,
          budgetDelta: 0,
          spentDelta: income ? 0 : amount,
          legacyId: `transaction:${String(row.id ?? index)}`,
        },
        `legacy-transaction-${index}`,
      );
      report.importedTransactions++;
      if (income) report.earnings += amount;
      else report.expenses += amount;
    },
  );
  raw.savings.forEach((value, index) => {
    if (
      !object(value) ||
      money(value.amount) === undefined ||
      !dateValue(value.date) ||
      !["DEPOSIT", "WITHDRAW"].includes(String(value.type))
    ) {
      addIssue(
        "savings",
        index,
        "Invalid savings transfer retained unchanged in the original archive.",
      );
      return;
    }
    push(
      {
        kind: "adjustment",
        date: String(value.date),
        month: String(value.date).slice(0, 7),
        amount: money(value.amount)!,
        note: `Legacy savings ${value.type === "DEPOSIT" ? "deposit" : "withdrawal"}: ${String(value.description ?? "")}`.trim(),
        savingsDelta: 0,
        budgetDelta: 0,
        spentDelta: 0,
        legacyId: `savings:${String(value.id ?? index)}`,
      },
      `legacy-savings-${index}`,
    );
  });

  // The old wallet and savings are one real pool: historical transfers do not change net funds.
  report.netFunds = report.earnings - report.expenses;
  if (report.netFunds < 0)
    addIssue(
      "reconciliation",
      -1,
      "Historical spending exceeds recorded earnings. The exact deficit is preserved; reconcile missing earnings before new funding.",
    );
  const current = state.budgets.filter(
    (b) => b.month === state.activeMonth && b.status === "open",
  );
  const spentByBudget = new Map<string, number>();
  for (const entry of state.journal)
    if (entry.budgetId)
      spentByBudget.set(
        entry.budgetId,
        (spentByBudget.get(entry.budgetId) ?? 0) + entry.spentDelta,
      );
  const needed = current.reduce(
    (sum, b) => sum + Math.max(0, b.limit - (spentByBudget.get(b.id) ?? 0)),
    0,
  );
  const canFundAll = report.netFunds >= needed;
  for (const budget of current) {
    const spent = spentByBudget.get(budget.id) ?? 0;
    if (spent > budget.limit)
      addIssue(
        "reconciliation",
        -1,
        `${categoryById(state, budget.categoryId).name} has historical spending above its old limit. Its spending and original limit are both preserved.`,
      );
    const remaining = Math.max(0, budget.limit - spent);
    if (canFundAll && remaining > 0)
      push(
        {
          kind: "allocation",
          date,
          month: state.activeMonth,
          amount: remaining,
          note: "Migration: reserve only the unspent portion of the old limit",
          budgetId: budget.id,
          categoryId: budget.categoryId,
          savingsDelta: -remaining,
          budgetDelta: remaining,
          spentDelta: 0,
        },
        `migration-allocation-${budget.id}`,
      );
    budget.funding = canFundAll ? "funded" : "unfunded";
  }
  if (!canFundAll && needed > 0)
    addIssue(
      "reconciliation",
      -1,
      "Current limits exceed available funds. Plans and expenses are preserved; select budgets to fund after reviewing the shortfall.",
    );
  for (const cat of state.categories) {
    const candidates = budgetRows.filter(
      (b) =>
        b.categoryId === cat.id &&
        (b.month === "DEFAULT" || b.month <= state.activeMonth),
    );
    const currentOverride = candidates
      .filter((b) => b.month === state.activeMonth)
      .at(-1);
    const latest = candidates
      .filter((b) => b.month !== "DEFAULT")
      .sort((a, b) => a.month.localeCompare(b.month))
      .at(-1);
    const selected =
      currentOverride ??
      candidates.filter((b) => b.month === "DEFAULT").at(-1) ??
      latest;
    if (selected && selected.amount > 0)
      state.templates.push({
        id: `migration-template-${cat.id}`,
        version: state.templates.length + 1,
        categoryId: cat.id,
        amount: selected.amount,
        effectiveMonth: nextMonth(state.activeMonth),
        enabled: true,
      });
    for (const future of budgetRows
      .filter(
        (b) =>
          b.categoryId === cat.id &&
          b.month !== "DEFAULT" &&
          b.month > state.activeMonth,
      )
      .sort((a, b) => a.month.localeCompare(b.month))) {
      state.templates.push({
        id: `migration-template-${cat.id}-${future.index}`,
        version: state.templates.length + 1,
        categoryId: cat.id,
        amount: future.amount,
        effectiveMonth: future.month,
        enabled: future.amount > 0,
      });
    }
  }
  // Create next month's readable plans without reserving its money a second time.
  const next = nextMonth(state.activeMonth);
  for (const cat of state.categories) {
    const template = state.templates
      .filter((t) => t.categoryId === cat.id && t.effectiveMonth <= next)
      .at(-1);
    if (
      template?.enabled &&
      !state.budgets.some((b) => b.categoryId === cat.id && b.month === next)
    )
      state.budgets.push({
        id: `migration-next-${cat.id}`,
        categoryId: cat.id,
        month: next,
        limit: template.amount,
        status: "open",
        funding: "unfunded",
      });
  }
  report.allocated = state.journal.reduce((sum, e) => sum + e.budgetDelta, 0);
  report.availableSavings = report.netFunds - report.allocated;
  state.legacy = { importedAt: new Date().toISOString(), raw, report };
  return { state, report };
}

function categoryById(state: FinanceState, id: string): Category {
  return state.categories.find((c) => c.id === id)!;
}
