/** All money is integer PKR minor units (100 paisa = one rupee). */
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
}

export interface BudgetTemplate {
  id: string;
  /** Persistent edit order; database row order is never meaningful. */
  version: number;
  categoryId: string;
  amount: number;
  effectiveMonth: string;
  enabled: boolean;
}

export interface MonthlyBudget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  status: "open" | "closed";
  funding: "funded" | "unfunded";
}

export type JournalKind =
  | "income"
  | "expense"
  | "allocation"
  | "release"
  | "refund"
  | "reversal"
  | "adjustment";

export interface JournalEntry {
  id: string;
  kind: JournalKind;
  date: string;
  month: string;
  amount: number;
  note: string;
  categoryId?: string;
  budgetId?: string;
  savingsDelta: number;
  budgetDelta: number;
  spentDelta: number;
  reversesId?: string;
  refundOfId?: string;
  legacyId?: string;
}

export interface LegacyInput {
  transactions: unknown[];
  budgets: unknown[];
  savings: unknown[];
}

export interface MigrationIssue {
  source: "transactions" | "budgets" | "savings" | "reconciliation";
  index: number;
  message: string;
}

export interface MigrationReport {
  sourceTransactions: number;
  importedTransactions: number;
  linkedTransfers: number;
  ambiguousTransactions: number;
  sourceSavings: number;
  sourceBudgets: number;
  earnings: number;
  expenses: number;
  netFunds: number;
  availableSavings: number;
  allocated: number;
  issues: MigrationIssue[];
}

export interface LegacyArchive {
  importedAt: string;
  raw: LegacyInput;
  report: MigrationReport;
}

export interface FinanceState {
  schemaVersion: 1;
  id: string;
  currency: "PKR";
  revision: number;
  createdAt: string;
  updatedAt: string;
  activeMonth: string;
  categories: Category[];
  templates: BudgetTemplate[];
  budgets: MonthlyBudget[];
  journal: JournalEntry[];
  legacy?: LegacyArchive;
}

export type FinanceCommand =
  | { type: "add-income"; amount: number; date: string; note?: string }
  | {
      type: "update-income";
      entryId: string;
      amount: number;
      date: string;
      note?: string;
    }
  | {
      type: "add-expense";
      categoryId: string;
      amount: number;
      date: string;
      note?: string;
    }
  | {
      type: "set-budget";
      categoryId: string;
      month: string;
      amount: number;
      scope?: "month" | "future" | "month-and-future";
    }
  | { type: "fund-budget"; budgetId: string }
  | { type: "archive-budget"; budgetId: string; stopRecurrence?: boolean }
  | { type: "reopen-budget"; budgetId: string }
  | { type: "reverse-entry"; entryId: string; date?: string }
  | {
      type: "refund-expense";
      entryId: string;
      amount: number;
      date: string;
      note?: string;
    }
  | {
      type: "update-expense";
      entryId: string;
      categoryId: string;
      amount: number;
      date: string;
      note?: string;
    }
  | { type: "add-category"; name: string; color?: string; icon?: string }
  | {
      type: "update-category";
      id: string;
      name?: string;
      color?: string;
      icon?: string;
      archived?: boolean;
    }
  | { type: "rollover"; month: string };

export interface CommandContext {
  now?: string;
  id?: () => string;
}
