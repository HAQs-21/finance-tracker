import { FinanceError } from "./index.ts";
import type { FinanceState } from "./types.ts";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value);
const month = (value: unknown) =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const date = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
function invalid(message: string): never {
  throw new FinanceError("INVALID_BACKUP", `Backup rejected: ${message}`);
}
function uniqueIds(rows: ObjectValue[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.id !== "string" || !row.id || ids.has(row.id))
      invalid(`${label} contains a missing or duplicate ID.`);
    ids.add(row.id);
  }
  return ids;
}

/** Strict at the trust boundary. No table replacement is safe until this succeeds. */
export function validateState(input: unknown): asserts input is FinanceState {
  if (
    !object(input) ||
    input.schemaVersion !== 1 ||
    input.currency !== "PKR" ||
    typeof input.id !== "string" ||
    !input.id
  )
    invalid("unsupported format or currency.");
  if (
    !integer(input.revision) ||
    (input.revision as number) < 0 ||
    !month(input.activeMonth)
  )
    invalid("invalid revision or active month.");
  if (
    typeof input.createdAt !== "string" ||
    Number.isNaN(Date.parse(input.createdAt)) ||
    typeof input.updatedAt !== "string" ||
    Number.isNaN(Date.parse(input.updatedAt))
  )
    invalid("invalid timestamps.");
  const keys = ["categories", "templates", "budgets", "journal"] as const;
  for (const key of keys)
    if (!Array.isArray(input[key]) || !(input[key] as unknown[]).every(object))
      invalid(`${key} must be an array of records.`);
  const categories = input.categories as ObjectValue[];
  const budgets = input.budgets as ObjectValue[];
  const journal = input.journal as ObjectValue[];
  const categoryIds = uniqueIds(categories, "Categories");
  const budgetIds = uniqueIds(budgets, "Budgets");
  const entryIds = uniqueIds(journal, "Journal");
  uniqueIds(input.templates as ObjectValue[], "Templates");
  const categoryNames = new Set<string>();
  for (const c of categories) {
    if (
      typeof c.name !== "string" ||
      !c.name.trim() ||
      typeof c.color !== "string" ||
      typeof c.icon !== "string" ||
      typeof c.archived !== "boolean"
    )
      invalid("invalid category record.");
    const name = c.name.trim().toLocaleLowerCase();
    if (categoryNames.has(name)) invalid("category names must be unique.");
    categoryNames.add(name);
  }
  const budgetKeys = new Set<string>();
  const budgetMap = new Map(budgets.map((b) => [b.id, b]));
  for (const b of budgets) {
    if (
      typeof b.categoryId !== "string" ||
      !categoryIds.has(b.categoryId) ||
      !month(b.month) ||
      !integer(b.limit) ||
      (b.limit as number) < 0 ||
      !["open", "closed"].includes(String(b.status)) ||
      !["funded", "unfunded"].includes(String(b.funding))
    )
      invalid("invalid monthly budget.");
    const key = `${b.categoryId}|${b.month}`;
    if (budgetKeys.has(key)) invalid("duplicate category/month budget.");
    budgetKeys.add(key);
  }
  const templateVersions = new Set<number>();
  for (const t of input.templates as ObjectValue[]) {
    if (
      typeof t.categoryId !== "string" ||
      !categoryIds.has(t.categoryId) ||
      !month(t.effectiveMonth) ||
      !integer(t.amount) ||
      (t.amount as number) < 0 ||
      typeof t.enabled !== "boolean" ||
      (t.enabled && t.amount === 0) ||
      !integer(t.version) ||
      (t.version as number) < 1 ||
      templateVersions.has(t.version as number)
    )
      invalid("invalid budget template.");
    templateVersions.add(t.version as number);
  }
  const reversalTargets = new Set<string>();
  const journalMap = new Map(journal.map((e) => [e.id, e]));
  for (const e of journal) {
    if (
      ![
        "income",
        "expense",
        "allocation",
        "release",
        "refund",
        "reversal",
        "adjustment",
      ].includes(String(e.kind)) ||
      !date(e.date) ||
      e.month !== String(e.date).slice(0, 7) ||
      !integer(e.amount) ||
      (e.amount as number) < 0 ||
      typeof e.note !== "string"
    )
      invalid("invalid journal record.");
    if (![e.savingsDelta, e.budgetDelta, e.spentDelta].every(integer))
      invalid("journal amounts must be integer minor units.");
    if (
      e.categoryId !== undefined &&
      (typeof e.categoryId !== "string" || !categoryIds.has(e.categoryId))
    )
      invalid("journal refers to a missing category.");
    if (
      e.budgetId !== undefined &&
      (typeof e.budgetId !== "string" || !budgetIds.has(e.budgetId))
    )
      invalid("journal refers to a missing budget.");
    if (
      e.legacyId !== undefined &&
      (typeof e.legacyId !== "string" ||
        !e.legacyId ||
        input.legacy === undefined)
    )
      invalid("legacy journal record has no original archive.");
    if (
      e.budgetId !== undefined &&
      budgetMap.get(e.budgetId)?.categoryId !== e.categoryId
    )
      invalid("journal category does not match its budget.");
    if (e.budgetDelta !== 0 && !e.budgetId)
      invalid("allocation has no budget.");
    if (
      ["expense", "allocation", "release"].includes(String(e.kind)) &&
      !e.categoryId
    )
      invalid("financial record has no category.");
    if (["allocation", "release"].includes(String(e.kind)) && !e.budgetId)
      invalid("allocation or release has no budget.");
    if (e.kind === "expense" && !e.legacyId && !e.budgetId)
      invalid("expense has no funded category.");
    if (e.kind === "reversal" && typeof e.reversesId !== "string")
      invalid("reversal has no source record.");
    if (e.kind === "refund" && typeof e.refundOfId !== "string")
      invalid("refund has no source expense.");
    const amount = e.amount as number;
    const savings = e.savingsDelta as number;
    const available = e.budgetDelta as number;
    const spent = e.spentDelta as number;
    if (
      e.kind === "income" &&
      (savings !== amount || available !== 0 || spent !== 0)
    )
      invalid("earnings have inconsistent financial effects.");
    if (
      e.kind === "expense" &&
      (spent !== amount ||
        (e.legacyId
          ? savings !== -amount || available !== 0
          : savings !== 0 || available !== -amount))
    )
      invalid("expense has inconsistent financial effects.");
    if (
      e.kind === "allocation" &&
      (savings !== -amount || available !== amount || spent !== 0)
    )
      invalid("allocation has inconsistent financial effects.");
    if (
      e.kind === "release" &&
      (savings !== amount || available !== -amount || spent !== 0)
    )
      invalid("release has inconsistent financial effects.");
    if (
      e.kind === "adjustment" &&
      (savings !== 0 || available !== 0 || spent !== 0)
    )
      invalid("legacy review records must not change funds.");
    if (
      e.kind === "refund" &&
      (spent !== -amount ||
        savings < 0 ||
        available < 0 ||
        savings + available !== amount)
    )
      invalid("refund has inconsistent financial effects.");
    if (e.reversesId !== undefined) {
      if (
        e.kind !== "reversal" ||
        !entryIds.has(String(e.reversesId)) ||
        e.reversesId === e.id ||
        reversalTargets.has(String(e.reversesId))
      )
        invalid("invalid or duplicate reversal.");
      const target = journalMap.get(e.reversesId);
      if (
        !target ||
        !["income", "expense", "refund"].includes(String(target.kind)) ||
        e.amount !== target.amount ||
        e.spentDelta !== -(target.spentDelta as number) ||
        e.categoryId !== target.categoryId ||
        e.budgetId !== target.budgetId
      )
        invalid("reversal does not match its source.");
      if (
        savings + available !==
        -((target.savingsDelta as number) + (target.budgetDelta as number))
      )
        invalid("reversal does not restore the original amount.");
      if (target.kind === "expense" && (savings < 0 || available < 0))
        invalid("expense reversal must restore funds.");
      if (
        ["income", "refund"].includes(String(target.kind)) &&
        (savings > 0 || available > 0)
      )
        invalid("earnings/refund reversal must remove funds.");
      reversalTargets.add(String(e.reversesId));
    }
    if (e.refundOfId !== undefined) {
      const target = journalMap.get(e.refundOfId);
      if (
        e.kind !== "refund" ||
        target?.kind !== "expense" ||
        e.categoryId !== target.categoryId ||
        e.budgetId !== target.budgetId
      )
        invalid("invalid refund reference.");
    }
  }
  let savings = 0;
  const budgetBalances = new Map<string, number>();
  const budgetSpending = new Map<string, number>();
  const refunded = new Map<string, number>();
  for (const e of journal) {
    savings += e.savingsDelta as number;
    if (!Number.isSafeInteger(savings))
      invalid("savings amount exceeds safe integer precision.");
    if (e.budgetId)
      budgetBalances.set(
        String(e.budgetId),
        (budgetBalances.get(String(e.budgetId)) ?? 0) +
          (e.budgetDelta as number),
      );
    if (e.budgetId)
      budgetSpending.set(
        String(e.budgetId),
        (budgetSpending.get(String(e.budgetId)) ?? 0) +
          (e.spentDelta as number),
      );
    if (e.kind === "refund" && !reversalTargets.has(String(e.id))) {
      if (reversalTargets.has(String(e.refundOfId)))
        invalid("a reversed expense still has active refunds.");
      refunded.set(
        String(e.refundOfId),
        (refunded.get(String(e.refundOfId)) ?? 0) + (e.amount as number),
      );
    }
  }
  if (
    [...budgetBalances.values()].some(
      (amount) => amount < 0 || !Number.isSafeInteger(amount),
    )
  )
    invalid("a category balance is negative or exceeds safe precision.");
  if (
    budgets.some(
      (b) =>
        b.status === "closed" && (budgetBalances.get(String(b.id)) ?? 0) !== 0,
    )
  )
    invalid("a closed budget still contains money.");
  if (
    [...budgetSpending.values()].some(
      (amount) => amount < 0 || !Number.isSafeInteger(amount),
    )
  )
    invalid("category spending is inconsistent.");
  for (const [id, amount] of refunded)
    if (amount > (journalMap.get(id)?.amount as number))
      invalid("refunds exceed the original expense.");
  for (const budget of budgets) {
    if (
      String(budget.month) < String(input.activeMonth) &&
      budget.status !== "closed"
    )
      invalid("a historical month is still open.");
    if (
      String(budget.month) > String(input.activeMonth) &&
      (budgetBalances.get(String(budget.id)) ?? 0) !== 0
    )
      invalid("a future plan has been charged early.");
    if (
      budget.month === input.activeMonth &&
      budget.status === "open" &&
      budget.funding === "funded" &&
      (budgetBalances.get(String(budget.id)) ?? 0) !==
        Math.max(
          0,
          (budget.limit as number) -
            (budgetSpending.get(String(budget.id)) ?? 0),
        )
    )
      invalid("funded category does not reconcile to its limit and spending.");
  }
  if (savings < 0 && input.legacy === undefined)
    invalid("Savings cannot be negative.");
  if (input.legacy !== undefined) {
    if (
      !object(input.legacy) ||
      !object(input.legacy.raw) ||
      !Array.isArray(input.legacy.raw.transactions) ||
      !Array.isArray(input.legacy.raw.budgets) ||
      !Array.isArray(input.legacy.raw.savings) ||
      !object(input.legacy.report) ||
      !Array.isArray(input.legacy.report.issues)
    )
      invalid("original migration archive is incomplete.");
    const report = input.legacy.report;
    if (
      ![
        "sourceTransactions",
        "importedTransactions",
        "linkedTransfers",
        "ambiguousTransactions",
        "sourceSavings",
        "sourceBudgets",
        "earnings",
        "expenses",
        "netFunds",
        "availableSavings",
        "allocated",
      ].every((key) => integer(report[key]))
    )
      invalid("migration reconciliation amounts are invalid.");
    if (
      report.sourceTransactions !== input.legacy.raw.transactions.length ||
      report.sourceSavings !== input.legacy.raw.savings.length ||
      report.sourceBudgets !== input.legacy.raw.budgets.length ||
      (report.earnings as number) - (report.expenses as number) !==
        report.netFunds ||
      (report.availableSavings as number) + (report.allocated as number) !==
        report.netFunds
    )
      invalid("original migration report does not reconcile.");
    if (
      savings < 0 &&
      (!((report.netFunds as number) < 0) ||
        savings < (report.netFunds as number))
    )
      invalid("negative Savings is not explained by the original deficit.");
  }
}

/** Detect accidental damage. This is an integrity checksum, not cryptographic authentication. */
export function backupChecksum(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function serializeBackup(state: FinanceState): string {
  validateState(state);
  return JSON.stringify(
    {
      format: "morrow-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      money: "Integer paisa; divide amounts by 100 for PKR rupees.",
      checksum: backupChecksum(state),
      state,
    },
    null,
    2,
  );
}
export function parseBackup(source: string | unknown): FinanceState {
  let parsed: unknown;
  try {
    parsed = typeof source === "string" ? JSON.parse(source) : source;
  } catch {
    invalid(
      "the file is not valid JSON. Your current records have not been changed.",
    );
  }
  if (object(parsed) && parsed.format === "morrow-backup") {
    if (
      parsed.version !== 1 ||
      parsed.checksum !== backupChecksum(parsed.state)
    )
      invalid("integrity check failed. Use an earlier recovery copy.");
    parsed = parsed.state;
  }
  validateState(parsed);
  return structuredClone(parsed);
}
