import {
  getActiveEntries,
  projectFinance,
  serializeBackup,
} from "../domain/index.ts";
import type { FinanceState } from "../domain/index.ts";

const decimal = (minor: number) => (minor / 100).toFixed(2);
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  // Text fields must not execute formulas when opened in a spreadsheet.
  const safe = /^[-=+@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function exportCsv(state: FinanceState): string {
  const rows: unknown[][] = [
    ["Date", "Type", "Amount", "Category", "Note", "Record ID"],
  ];
  for (const entry of getActiveEntries(state)
    .filter((item) => item.kind === "income" || item.kind === "expense")
    .sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      entry.date,
      entry.kind,
      decimal(entry.amount),
      state.categories.find((category) => category.id === entry.categoryId)
        ?.name || "Earnings",
      entry.note,
      entry.id,
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function exportText(state: FinanceState): string {
  return getActiveEntries(state)
    .filter((item) => item.kind === "income" || item.kind === "expense")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (entry) =>
        `${entry.date} ${entry.kind} ${decimal(entry.amount)} ${entry.note.replace(/[\r\n]+/g, " ")} [${state.categories.find((category) => category.id === entry.categoryId)?.name || "Earnings"}]`,
    )
    .join("\n");
}

/** Android uses its native share sheet; browser uses a standard file download. */
export async function downloadFile(
  filename: string,
  content: string | Uint8Array,
  mime = "application/json",
): Promise<void> {
  const safeName = filename.replace(/[^\p{L}\p{N}._ -]/gu, "_");
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    let data: string;
    if (typeof content === "string") data = content;
    else {
      let binary = "";
      for (let offset = 0; offset < content.length; offset += 8192)
        binary += String.fromCharCode(
          ...content.subarray(offset, offset + 8192),
        );
      data = btoa(binary);
    }
    const result = await Filesystem.writeFile({
      path: `exports/${safeName}`,
      data,
      directory: Directory.Cache,
      recursive: true,
      ...(typeof content === "string" ? { encoding: Encoding.UTF8 } : {}),
    });
    await Share.share({
      title: safeName,
      files: [result.uri],
      dialogTitle: "Save a copy of your Morrow records",
    });
    return;
  }
  const blob = new Blob(
    [typeof content === "string" ? content : new Uint8Array(content).buffer],
    { type: mime },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function buildExcelWorkbook(state: FinanceState) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const categories = new Map(
    state.categories.map((category) => [category.id, category.name]),
  );
  const active = getActiveEntries(state);
  const transactions: unknown[][] = [
    ["Date", "Type", "Category", "Description", "Amount (PKR)", "Record ID"],
  ];
  for (const entry of active.filter(
    (item) => item.kind === "income" || item.kind === "expense",
  ))
    transactions.push([
      entry.date,
      entry.kind,
      categories.get(entry.categoryId || "") || "Earnings",
      entry.note,
      entry.amount / 100,
      entry.id,
    ]);
  const ledger: unknown[][] = [
    [
      "Date",
      "Type",
      "Amount (PKR)",
      "Category",
      "Note",
      "Savings change",
      "Budget change",
      "Spending change",
      "Month",
      "ID",
      "Budget ID",
      "Reversal of",
      "Earnings change",
    ],
  ];
  const journalById = new Map(state.journal.map((entry) => [entry.id, entry]));
  const monthlyTotals = new Map<
    string,
    { income: number; spending: number; savings: number; budget: number }
  >();
  const categoryTotals = new Map<string, number>();
  for (const entry of state.journal) {
    const income =
      entry.kind === "income"
        ? entry.amount
        : entry.kind === "reversal" &&
            journalById.get(entry.reversesId || "")?.kind === "income"
          ? -entry.amount
          : 0;
    ledger.push([
      entry.date,
      entry.kind,
      entry.amount / 100,
      categories.get(entry.categoryId || "") || "",
      entry.note,
      entry.savingsDelta / 100,
      entry.budgetDelta / 100,
      entry.spentDelta / 100,
      entry.month,
      entry.id,
      entry.budgetId || "",
      entry.reversesId || "",
      income / 100,
    ]);
    const totals = monthlyTotals.get(entry.month) || {
      income: 0,
      spending: 0,
      savings: 0,
      budget: 0,
    };
    totals.income += income;
    totals.spending += entry.spentDelta;
    totals.savings += entry.savingsDelta;
    totals.budget += entry.budgetDelta;
    monthlyTotals.set(entry.month, totals);
    if (entry.categoryId)
      categoryTotals.set(
        entry.categoryId,
        (categoryTotals.get(entry.categoryId) || 0) + entry.spentDelta,
      );
  }
  const last = Math.max(2, ledger.length);
  const monthNames = [
    ...new Set(state.journal.map((entry) => entry.month)),
  ].sort();
  const monthly: unknown[][] = [
    ["Month", "Earnings", "Net spending", "Savings change", "Allocated change"],
  ];
  monthNames.forEach((month) => {
    const totals = monthlyTotals.get(month)!;
    const row = monthly.length + 1;
    monthly.push([
      month,
      {
        t: "n",
        f: `SUMIF(Journal!I2:I${last},A${row},Journal!M2:M${last})`,
        v: totals.income / 100,
      },
      {
        t: "n",
        f: `SUMIF(Journal!I2:I${last},A${row},Journal!H2:H${last})`,
        v: totals.spending / 100,
      },
      {
        t: "n",
        f: `SUMIF(Journal!I2:I${last},A${row},Journal!F2:F${last})`,
        v: totals.savings / 100,
      },
      {
        t: "n",
        f: `SUMIF(Journal!I2:I${last},A${row},Journal!G2:G${last})`,
        v: totals.budget / 100,
      },
    ]);
  });
  const breakdown: unknown[][] = [["Category", "Net spending (PKR)"]];
  for (const category of state.categories) {
    const row = breakdown.length + 1;
    breakdown.push([
      category.name,
      {
        t: "n",
        f: `SUMIF(Journal!D2:D${last},A${row},Journal!H2:H${last})`,
        v: (categoryTotals.get(category.id) || 0) / 100,
      },
    ]);
  }
  const budgets: unknown[][] = [
    [
      "Month",
      "Category",
      "Limit (PKR)",
      "Spent (PKR)",
      "Available (PKR)",
      "Status",
      "Funding",
    ],
  ];
  const projection = projectFinance(state);
  for (const budget of state.budgets)
    budgets.push([
      budget.month,
      categories.get(budget.categoryId),
      budget.limit / 100,
      (projection.budgets[budget.id]?.spent || 0) / 100,
      (projection.budgets[budget.id]?.available || 0) / 100,
      budget.status,
      budget.funding,
    ]);
  const savings: unknown[][] = [
    ["Date", "Type", "Description", "Savings change (PKR)"],
  ];
  for (const entry of state.journal.filter((item) => item.savingsDelta !== 0))
    savings.push([
      entry.date,
      entry.kind,
      entry.note,
      entry.savingsDelta / 100,
    ]);
  for (const [name, rows] of [
    ["Transactions", transactions],
    ["Monthly Summary", monthly],
    ["Category Breakdown", breakdown],
    ["Savings Log", savings],
    ["Budgets", budgets],
    ["Journal", ledger],
  ] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = rows[0].map((_, column) => ({
      wch: column === 4 ? 36 : 23,
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  workbook.Workbook = {
    CalcPr: { calcId: "191029", fullCalcOnLoad: true },
  } as typeof workbook.Workbook;
  return workbook;
}

export async function exportExcel(state: FinanceState): Promise<void> {
  const [XLSX, workbook] = await Promise.all([
    import("xlsx"),
    buildExcelWorkbook(state),
  ]);
  const binary = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  await downloadFile(
    `Morrow-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Uint8Array(binary),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export async function downloadBackup(state: FinanceState): Promise<void> {
  await downloadFile(
    `Morrow-backup-${new Date().toISOString().slice(0, 10)}.json`,
    serializeBackup(state),
  );
}
