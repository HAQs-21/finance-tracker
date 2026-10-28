import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import {
  parseImportText,
  parseImportAmount,
  parseCsv,
  localDate,
} from "../src/data/imports.ts";
import {
  downloadBackup,
  uploadBackup,
  BackupRemoteError,
  parseGithubRepository,
  checkGithubConnection,
} from "../src/data/github.ts";

test("GitHub setup accepts repository URLs and diagnoses invalid credentials without retrying", async () => {
  assert.deepEqual(
    parseGithubRepository(" https://github.com/owner/vault.git "),
    { owner: "owner", repo: "vault" },
  );
  assert.throws(
    () => parseGithubRepository("https://evil.example/owner/vault"),
    /owner\/repository/,
  );
  const original = globalThis.fetch;
  const config = {
    owner: "owner",
    repo: "vault",
    path: "morrow/current.json",
    token: "synthetic",
  };
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ message: "Bad credentials" }, { status: 401 });
    };
    await assert.rejects(
      checkGithubConnection(config),
      /expired or been revoked/,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      Response.json({ message: "denied" }, { status: 403 });
    await assert.rejects(
      checkGithubConnection(config),
      /Contents: read and write/,
    );
    globalThis.fetch = async (input) =>
      String(input).endsWith("/contents")
        ? Response.json({}, { status: 409 })
        : Response.json({ id: 1 });
    await checkGithubConnection(config);
  } finally {
    globalThis.fetch = original;
  }
});
import { FinanceRepository, previewBackup } from "../src/data/store.ts";
import {
  savingsBalance,
  budgetBalance,
  serializeBackup,
} from "../src/domain/index.ts";
import { applyCommand, createEmptyState } from "../src/domain/index.ts";
import { buildExcelWorkbook } from "../src/data/exports.ts";

test("import preserves leading amount, thousands, Unicode, exact dates and category punctuation", () => {
  const parsed = parseImportText(
    "January 2026 (40k)\n1,200 Pizza (300 shared) [Food]\n2026-01-29 expense 99.25 دوا [Health & Care]",
    "2026-01-01",
  );
  assert.deepEqual(
    parsed.rows.map((row) => row.amount),
    [4_000_000, 120_000, 9_925],
  );
  assert.equal(parsed.rows[2].category, "Health & Care");
  assert.equal(parsed.rows[2].date, "2026-01-29");
  assert.equal(parsed.rows[2].inferredDate, false);
  assert.equal(parsed.rows[1].note, "Pizza (300 shared)");
  assert.equal(parseImportAmount("1.25k"), 125_000);
  assert.throws(() => parseImportAmount("1,20"), /Invalid amount/);
  assert.throws(() => parseImportAmount("1.234"), /Invalid amount/);
});

test("CSV handles quoted notes, embedded newline, thousands and exact dates", () => {
  const preview = parseImportText(
    'Date,Type,Amount,Category,Note\r\n2026-02-28,expense,"1,200.50",Food,"Dinner, with\nfamily"',
  );
  assert.equal(preview.issues.length, 0);
  assert.equal(preview.rows[0].amount, 120_050);
  assert.equal(preview.rows[0].note, "Dinner, with\nfamily");
  assert.throws(() => parseCsv('"unfinished'), /closing quote/);
  assert.equal(parseImportText("2026-02-30 expense 10 Food").rows.length, 0);
});

test("savings-only text is represented and unknown lines are retained", () => {
  const parsed = parseImportText(
    "January 2026\n5k Deposit [Savings]\n-2k Withdrawal [Savings]\nnot a financial record",
  );
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].type, "transfer");
  assert.equal(parsed.rows[1].transferDirection, "withdrawal");
  assert.ok(
    parsed.issues.some((issue) => issue.text === "not a financial record"),
  );
});

test("cloud missing-file and conflict responses never cause empty restore or retry", async () => {
  const originalFetch = globalThis.fetch;
  const config = {
    owner: "test",
    repo: "vault",
    path: "morrow/current.json",
    token: "synthetic",
  };
  let requests = 0;
  try {
    globalThis.fetch = async () => {
      requests++;
      return new Response("{}", { status: 404 });
    };
    await assert.rejects(
      downloadBackup(config),
      (error: unknown) =>
        error instanceof BackupRemoteError && error.status === 404,
    );
    assert.equal(requests, 1);
    requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return new Response("{}", { status: 409 });
    };
    await assert.rejects(
      uploadBackup(config, '{"synthetic":true}', "reviewed-sha"),
      /remote backup changed/,
    );
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cloud verifies uploaded Unicode content and handles larger immutable blobs", async () => {
  const originalFetch = globalThis.fetch;
  const config = {
    owner: "test",
    repo: "vault",
    path: "morrow/current.json",
    token: "synthetic",
  };
  const backup = '{"note":"دوا ☕"}';
  const base64 = Buffer.from(backup).toString("base64");
  const calls: { url: string; method: string }[] = [];
  try {
    globalThis.fetch = async (input, options) => {
      calls.push({ url: String(input), method: options?.method || "GET" });
      if (options?.method === "PUT")
        return Response.json({ content: { sha: "immutable" } });
      if (String(input).includes("/git/blobs/"))
        return Response.json({
          sha: "immutable",
          encoding: "base64",
          content: base64,
        });
      return Response.json({
        type: "file",
        sha: "immutable",
        encoding: "none",
        content: "",
        size: 2_000_000,
      });
    };
    assert.equal(await uploadBackup(config, backup, "reviewed"), "immutable");
    assert.equal(calls.length, 3);
    assert.ok(calls[2].url.endsWith("/git/blobs/immutable"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Excel exports actual formulas and adjusted earnings, with a complete journal", async () => {
  let state = applyCommand(createEmptyState(), {
    type: "add-income",
    amount: 4_000_000,
    date: localDate(),
    note: "Salary",
  });
  const original = state.journal.find((entry) => entry.kind === "income")!;
  state = applyCommand(state, {
    type: "update-income",
    entryId: original.id,
    amount: 3_000_000,
    date: localDate(),
    note: "Corrected salary",
  });
  const workbook = await buildExcelWorkbook(state);
  assert.equal(workbook.SheetNames.length, 6);
  const monthly = workbook.Sheets["Monthly Summary"];
  assert.match(monthly.B2.f!, /SUMIF/);
  assert.equal(monthly.B2.v, 30_000);
  assert.equal(workbook.Sheets.Journal.M2.v, 40_000);
  assert.equal(workbook.Sheets.Journal.M3.v, -40_000);
  const XLSX = await import("xlsx");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const restored = XLSX.read(bytes, { type: "array", cellFormula: true });
  assert.equal(restored.Sheets["Monthly Summary"].B2.v, 30_000);
  assert.match(restored.Sheets["Monthly Summary"].B2.f!, /Journal!M/);
});

test("legacy source remains intact; concurrent budget spending is atomic; corrupt restore leaves state unchanged", async () => {
  const old = new Dexie("FinanceTrackerApp");
  old
    .version(1)
    .stores({ transactions: "++id", budgets: "category", savings: "++id" });
  await old.open();
  await old.table("transactions").add({
    amount: 40_000,
    type: "INCOME",
    date: localDate(),
    category: "Income",
    description: "Original salary",
  });
  const repository = new FinanceRepository();
  const initial = await repository.open();
  assert.equal(initial.legacy?.raw.transactions.length, 1);
  assert.equal(await old.table("transactions").count(), 1);
  assert.equal((await repository.recoveryCopies()).length, 2);
  const food = initial.categories.find((category) => category.name === "Food")!;
  await repository.dispatch({
    type: "set-budget",
    categoryId: food.id,
    month: initial.activeMonth,
    amount: 800_000,
  });
  const secondTab = new FinanceRepository();
  await secondTab.open();
  const results = await Promise.allSettled([
    repository.dispatch({
      type: "add-expense",
      categoryId: food.id,
      amount: 600_000,
      date: localDate(),
      note: "One",
    }),
    secondTab.dispatch({
      type: "add-expense",
      categoryId: food.id,
      amount: 300_000,
      date: localDate(),
      note: "Two",
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const after = await repository.read();
  assert.equal(savingsBalance(after), 3_200_000);
  const budget = after.budgets.find(
    (item) => item.categoryId === food.id && item.month === initial.activeMonth,
  )!;
  assert.ok(budgetBalance(after, budget.id) >= 0);
  const revision = after.revision;
  await assert.rejects(
    repository.restore('{"invalid":true}'),
    /Backup rejected/,
  );
  assert.equal((await repository.read()).revision, revision);
  assert.equal(
    previewBackup(
      JSON.stringify({
        transactions: [],
        savings: [{ amount: 10, type: "DEPOSIT", date: localDate() }],
        budgets: [],
      }),
    ).source,
    "legacy",
  );
  const verifiedBackup = serializeBackup(after);
  const damaged = new Dexie("MorrowFinance");
  await damaged.open();
  const metadata = await damaged.table("metadata").get("state");
  await damaged.table("metadata").put({
    ...metadata,
    currency: "BROKEN",
    revision: metadata.revision + 100,
  });
  const recoveryRepository = new FinanceRepository();
  await assert.rejects(recoveryRepository.open(), /left untouched/);
  await recoveryRepository.restore(verifiedBackup);
  assert.equal(savingsBalance(await recoveryRepository.read()), 3_200_000);
  assert.ok(
    (await recoveryRepository.recoveryCopies()).some(
      (copy) =>
        copy.reason === "Raw database before recovery restore" &&
        copy.data.includes("BROKEN"),
    ),
  );
  damaged.close();
  old.close();
});
