import Dexie, { type Table } from "dexie";
import {
  applyCommand,
  applyCommands,
  createEmptyState,
  migrateLegacy,
  parseBackup,
  serializeBackup,
  validateState,
} from "../domain/index.ts";
import type {
  FinanceCommand,
  FinanceState,
  LegacyInput,
} from "../domain/index.ts";
import { useCallback, useEffect, useState } from "react";
import { localDate, type ImportRow } from "./imports.ts";

export interface RecoveryCopy {
  id: string;
  createdAt: string;
  reason: string;
  data: string;
}
export interface MigrationInfo {
  sources: string[];
  report: ReturnType<typeof migrateLegacy>["report"] | null;
  recovered: boolean;
  archivedSources?: string[];
}
type Metadata = Omit<
  FinanceState,
  "categories" | "templates" | "budgets" | "journal"
> & { key: string };
type StoreTransform = (state: FinanceState) => FinanceState;

function header(
  state: Omit<FinanceState, "categories" | "templates" | "budgets" | "journal">,
) {
  return {
    schemaVersion: state.schemaVersion,
    id: state.id,
    currency: state.currency,
    revision: state.revision,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    activeMonth: state.activeMonth,
  };
}

interface Adapter {
  read(): Promise<FinanceState | null>;
  write(
    transform: StoreTransform,
    recoveryReason?: string,
    trustedDomainCommand?: boolean,
  ): Promise<FinanceState>;
  replace(state: FinanceState): Promise<FinanceState>;
  initialize(state: FinanceState, copies: RecoveryCopy[]): Promise<void>;
  recoveryCopies(): Promise<RecoveryCopy[]>;
}

class MorrowDatabase extends Dexie {
  metadata!: Table<Metadata, string>;
  categories!: Table<FinanceState["categories"][number], string>;
  templates!: Table<FinanceState["templates"][number], string>;
  budgets!: Table<FinanceState["budgets"][number], string>;
  journal!: Table<FinanceState["journal"][number], string>;
  recoveries!: Table<RecoveryCopy, string>;
  archives!: Table<{ id: string; data: FinanceState["legacy"] }, string>;
  constructor() {
    super("MorrowFinance");
    this.version(1).stores({
      metadata: "key",
      categories: "id, name",
      templates: "id, categoryId, effectiveMonth",
      budgets: "id, [categoryId+month], month",
      journal: "id, date, month, categoryId, budgetId, kind",
      recoveries: "id, createdAt, reason",
    });
    this.version(2)
      .stores({ archives: "id" })
      .upgrade(async (transaction) => {
        const old = (await transaction.table("metadata").get("state")) as
          Metadata | undefined;
        if (old?.legacy) {
          await transaction
            .table("archives")
            .put({ id: "legacy", data: old.legacy });
          delete old.legacy;
          await transaction.table("metadata").put(old);
        }
      });
  }
}

class WebAdapter implements Adapter {
  private db = new MorrowDatabase();
  private cached: FinanceState | null = null;
  private async insideRead(): Promise<FinanceState | null> {
    const metadata = await this.db.metadata.get("state");
    if (!metadata) return null;
    if (
      this.cached?.revision === metadata.revision &&
      this.cached.id === metadata.id
    )
      return this.cached;
    const [categories, templates, budgets, journal, archive] =
      await Promise.all([
        this.db.categories.toArray(),
        this.db.templates.toArray(),
        this.db.budgets.toArray(),
        this.db.journal.toArray(),
        this.db.archives.get("legacy"),
      ]);
    const state = {
      ...header(metadata),
      categories,
      templates,
      budgets,
      journal,
      ...(archive?.data ? { legacy: archive.data } : {}),
    };
    validateState(state);
    this.cached = state;
    return state;
  }
  read(): Promise<FinanceState | null> {
    return this.db.transaction(
      "r",
      [
        this.db.metadata,
        this.db.categories,
        this.db.templates,
        this.db.budgets,
        this.db.journal,
        this.db.archives,
      ],
      () => this.insideRead(),
    );
  }
  private async persist(
    next: FinanceState,
    previous: FinanceState | null,
  ): Promise<void> {
    for (const name of [
      "categories",
      "templates",
      "budgets",
      "journal",
    ] as const) {
      const table = this.db[name] as Table<{ id: string }, string>;
      const oldRecords = new Map(
        (previous?.[name] ?? []).map((row) => [row.id, row]),
      );
      const ids = new Set(next[name].map((row) => row.id));
      const removed = [...oldRecords.keys()].filter((id) => !ids.has(id));
      if (removed.length) await table.bulkDelete(removed);
      const changed = next[name].filter(
        (row) =>
          oldRecords.get(row.id) !== row &&
          JSON.stringify(oldRecords.get(row.id)) !== JSON.stringify(row),
      );
      if (changed.length) await table.bulkPut(changed);
    }
    await this.db.metadata.put({ key: "state", ...header(next) });
    if (next.legacy !== previous?.legacy) {
      if (next.legacy)
        await this.db.archives.put({ id: "legacy", data: next.legacy });
      else await this.db.archives.delete("legacy");
    }
  }
  async write(
    transform: StoreTransform,
    recoveryReason?: string,
    trustedDomainCommand = false,
  ): Promise<FinanceState> {
    // IndexedDB serializes overlapping read/write transactions across tabs.
    // Each command is validated against the latest committed revision here.
    const next = await this.db.transaction(
      "rw",
      [
        this.db.metadata,
        this.db.categories,
        this.db.templates,
        this.db.budgets,
        this.db.journal,
        this.db.recoveries,
        this.db.archives,
      ],
      async () => {
        const previous = await this.insideRead();
        if (!previous)
          throw new Error("The finance database has not initialized.");
        if (recoveryReason)
          await this.db.recoveries.add(recovery(previous, recoveryReason));
        const result = transform(previous);
        if (!trustedDomainCommand) validateState(result);
        await this.persist(result, previous);
        return result;
      },
    );
    this.cached = next;
    return next;
  }
  async initialize(state: FinanceState, copies: RecoveryCopy[]): Promise<void> {
    validateState(state);
    await this.db.transaction(
      "rw",
      [
        this.db.metadata,
        this.db.categories,
        this.db.templates,
        this.db.budgets,
        this.db.journal,
        this.db.recoveries,
        this.db.archives,
      ],
      async () => {
        if (await this.db.metadata.get("state")) return;
        if (copies.length) await this.db.recoveries.bulkPut(copies);
        await this.persist(state, null);
      },
    );
    this.cached = null;
  }
  async replace(state: FinanceState): Promise<FinanceState> {
    validateState(state);
    await this.db.transaction(
      "rw",
      [
        this.db.metadata,
        this.db.categories,
        this.db.templates,
        this.db.budgets,
        this.db.journal,
        this.db.recoveries,
        this.db.archives,
      ],
      async () => {
        const raw: Record<string, unknown> = {
          kind: "morrow-damaged-database",
          capturedAt: new Date().toISOString(),
        };
        for (const name of [
          "metadata",
          "categories",
          "templates",
          "budgets",
          "journal",
          "archives",
        ] as const)
          raw[name] = await this.db[name].toArray();
        await this.db.recoveries.add({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          reason: "Raw database before recovery restore",
          data: JSON.stringify(raw, null, 2),
        });
        for (const name of [
          "metadata",
          "categories",
          "templates",
          "budgets",
          "journal",
          "archives",
        ] as const)
          await this.db[name].clear();
        await this.persist(state, null);
      },
    );
    this.cached = state;
    return state;
  }
  recoveryCopies(): Promise<RecoveryCopy[]> {
    return this.db.recoveries.orderBy("createdAt").reverse().toArray();
  }
}

// SQLite has named columns for every financial field and a readable JSON copy
// per record. The copies preserve future fields without hiding the core ledger.
let nativeManager:
  import("@capacitor-community/sqlite").SQLiteConnection | null = null;
class NativeAdapter implements Adapter {
  private connection: import("@capacitor-community/sqlite").SQLiteDBConnection;
  private tail: Promise<unknown> = Promise.resolve();
  private cached: FinanceState | null = null;
  constructor(
    connection: import("@capacitor-community/sqlite").SQLiteDBConnection,
  ) {
    this.connection = connection;
  }
  static async open(): Promise<NativeAdapter> {
    const { CapacitorSQLite, SQLiteConnection } =
      await import("@capacitor-community/sqlite");
    const manager = (nativeManager ??= new SQLiteConnection(CapacitorSQLite));
    await manager.checkConnectionsConsistency();
    const existing = await manager.isConnection("morrow", false);
    const connection = existing.result
      ? await manager.retrieveConnection("morrow", false)
      : await manager.createConnection(
          "morrow",
          false,
          "no-encryption",
          1,
          false,
        );
    if (!(await connection.isDBOpen()).result) await connection.open();
    await connection.execute(
      `
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archives (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, icon TEXT, archived INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, categoryId TEXT NOT NULL, amount INTEGER NOT NULL, effectiveMonth TEXT NOT NULL, version INTEGER NOT NULL, enabled INTEGER, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, categoryId TEXT NOT NULL, month TEXT NOT NULL, limitAmount INTEGER NOT NULL, status TEXT, funding TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS budget_month ON budgets(month);
      CREATE TABLE IF NOT EXISTS journal (id TEXT PRIMARY KEY, kind TEXT NOT NULL, date TEXT NOT NULL, month TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT, categoryId TEXT, budgetId TEXT, savingsDelta INTEGER NOT NULL, budgetDelta INTEGER NOT NULL, spentDelta INTEGER NOT NULL, reversesId TEXT, refundOfId TEXT, legacyId TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS journal_date ON journal(date);
      CREATE INDEX IF NOT EXISTS journal_month ON journal(month);
      CREATE TABLE IF NOT EXISTS recoveries (id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, reason TEXT NOT NULL, data TEXT NOT NULL);
    `,
      false,
    );
    return new NativeAdapter(connection);
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const task = this.tail.then(work, work);
    this.tail = task.catch(() => undefined);
    return task;
  }
  private async insideRead(): Promise<FinanceState | null> {
    const meta = await this.connection.query(
      "SELECT data FROM metadata WHERE key = ?",
      ["state"],
    );
    if (!meta.values?.length) return null;
    const state = JSON.parse(String(meta.values[0].data)) as FinanceState;
    if (this.cached?.id === state.id && this.cached.revision === state.revision)
      return this.cached;
    for (const name of [
      "categories",
      "templates",
      "budgets",
      "journal",
    ] as const) {
      const query = await this.connection.query(`SELECT data FROM ${name}`);
      (state[name] as unknown[]) = (query.values ?? []).map(
        (row) => JSON.parse(String(row.data)) as unknown,
      );
    }
    const archive = await this.connection.query(
      "SELECT data FROM archives WHERE id = ?",
      ["legacy"],
    );
    if (archive.values?.length)
      state.legacy = JSON.parse(
        String(archive.values[0].data),
      ) as FinanceState["legacy"];
    validateState(state);
    this.cached = state;
    return state;
  }
  read(): Promise<FinanceState | null> {
    return this.serial(() => this.insideRead());
  }
  private async persist(
    state: FinanceState,
    previous: FinanceState | null,
  ): Promise<void> {
    const changes = <
      K extends "categories" | "templates" | "budgets" | "journal",
    >(
      name: K,
    ): FinanceState[K] => {
      const old = new Map((previous?.[name] ?? []).map((row) => [row.id, row]));
      return state[name].filter(
        (row) =>
          old.get(row.id) !== row &&
          JSON.stringify(old.get(row.id)) !== JSON.stringify(row),
      ) as FinanceState[K];
    };
    for (const name of [
      "categories",
      "templates",
      "budgets",
      "journal",
    ] as const) {
      const ids = new Set(state[name].map((row) => row.id));
      for (const row of previous?.[name] ?? [])
        if (!ids.has(row.id))
          await this.connection.run(
            `DELETE FROM ${name} WHERE id = ?`,
            [row.id],
            false,
          );
    }
    for (const row of changes("categories"))
      await this.connection.run(
        "INSERT OR REPLACE INTO categories VALUES (?, ?, ?, ?, ?, ?)",
        [
          row.id,
          row.name,
          row.color,
          row.icon,
          Number(row.archived),
          JSON.stringify(row),
        ],
        false,
      );
    for (const row of changes("templates"))
      await this.connection.run(
        "INSERT OR REPLACE INTO templates VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          row.id,
          row.categoryId,
          row.amount,
          row.effectiveMonth,
          row.version,
          Number(row.enabled),
          JSON.stringify(row),
        ],
        false,
      );
    for (const row of changes("budgets"))
      await this.connection.run(
        "INSERT OR REPLACE INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          row.id,
          row.categoryId,
          row.month,
          row.limit,
          row.status,
          row.funding,
          JSON.stringify(row),
        ],
        false,
      );
    for (const row of changes("journal"))
      await this.connection.run(
        "INSERT OR REPLACE INTO journal VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          row.id,
          row.kind,
          row.date,
          row.month,
          row.amount,
          row.note,
          row.categoryId ?? null,
          row.budgetId ?? null,
          row.savingsDelta,
          row.budgetDelta,
          row.spentDelta,
          row.reversesId ?? null,
          row.refundOfId ?? null,
          row.legacyId ?? null,
          JSON.stringify(row),
        ],
        false,
      );
    await this.connection.run(
      "INSERT OR REPLACE INTO metadata VALUES (?, ?)",
      ["state", JSON.stringify(header(state))],
      false,
    );
    if (state.legacy !== previous?.legacy) {
      if (state.legacy)
        await this.connection.run(
          "INSERT OR REPLACE INTO archives VALUES (?, ?)",
          ["legacy", JSON.stringify(state.legacy)],
          false,
        );
      else
        await this.connection.run(
          "DELETE FROM archives WHERE id = ?",
          ["legacy"],
          false,
        );
    }
  }
  private async saveRecovery(copy: RecoveryCopy): Promise<void> {
    await this.connection.run(
      "INSERT OR REPLACE INTO recoveries VALUES (?, ?, ?, ?)",
      [copy.id, copy.createdAt, copy.reason, copy.data],
      false,
    );
  }
  write(
    transform: StoreTransform,
    recoveryReason?: string,
    trustedDomainCommand = false,
  ): Promise<FinanceState> {
    return this.serial(async () => {
      await this.connection.beginTransaction();
      try {
        const previous = await this.insideRead();
        if (!previous)
          throw new Error("The finance database has not initialized.");
        if (recoveryReason)
          await this.saveRecovery(recovery(previous, recoveryReason));
        const next = transform(previous);
        if (!trustedDomainCommand) validateState(next);
        await this.persist(next, previous);
        await this.connection.commitTransaction();
        this.cached = next;
        return next;
      } catch (error) {
        await this.connection.rollbackTransaction();
        throw error;
      }
    });
  }
  initialize(state: FinanceState, copies: RecoveryCopy[]): Promise<void> {
    return this.serial(async () => {
      if (await this.insideRead()) return;
      await this.connection.beginTransaction();
      try {
        for (const copy of copies) await this.saveRecovery(copy);
        await this.persist(state, null);
        await this.connection.commitTransaction();
        this.cached = state;
      } catch (error) {
        await this.connection.rollbackTransaction();
        throw error;
      }
    });
  }
  replace(state: FinanceState): Promise<FinanceState> {
    return this.serial(async () => {
      validateState(state);
      await this.connection.beginTransaction();
      try {
        const raw: Record<string, unknown> = {
          kind: "morrow-damaged-database",
          capturedAt: new Date().toISOString(),
        };
        for (const name of [
          "metadata",
          "categories",
          "templates",
          "budgets",
          "journal",
          "archives",
        ])
          raw[name] =
            (await this.connection.query(`SELECT * FROM ${name}`)).values ?? [];
        await this.saveRecovery({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          reason: "Raw database before recovery restore",
          data: JSON.stringify(raw, null, 2),
        });
        for (const name of [
          "metadata",
          "categories",
          "templates",
          "budgets",
          "journal",
          "archives",
        ])
          await this.connection.run(`DELETE FROM ${name}`, [], false);
        await this.persist(state, null);
        await this.connection.commitTransaction();
        this.cached = state;
        return state;
      } catch (error) {
        await this.connection.rollbackTransaction();
        throw error;
      }
    });
  }
  recoveryCopies(): Promise<RecoveryCopy[]> {
    return this.serial(
      async () =>
        ((
          await this.connection.query(
            "SELECT * FROM recoveries ORDER BY createdAt DESC",
          )
        ).values as RecoveryCopy[]) || [],
    );
  }
}

function recovery(state: FinanceState, reason: string): RecoveryCopy {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reason,
    data: serializeBackup(state),
  };
}

async function legacySources(): Promise<
  { name: string; input: LegacyInput }[]
> {
  const result: { name: string; input: LegacyInput }[] = [];
  for (const name of ["FinanceTrackerApp", "FinanceDB"]) {
    if (!(await Dexie.exists(name))) continue;
    const legacy = new Dexie(name);
    try {
      await legacy.open();
      const read = async (table: string): Promise<unknown[]> =>
        legacy.tables.some((item) => item.name === table)
          ? legacy.table(table).toArray()
          : [];
      const [transactions, budgets, savings] = await Promise.all([
        read("transactions"),
        read("budgets"),
        read("savings"),
      ]);
      if (transactions.length || budgets.length || savings.length)
        result.push({ name, input: { transactions, budgets, savings } });
    } finally {
      legacy.close();
    }
  }
  return result;
}

export class FinanceRepository {
  private adapter: Adapter | null = null;
  private opening: Promise<FinanceState> | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<() => void>();
  migration: MigrationInfo = { sources: [], report: null, recovered: false };
  constructor() {
    if (
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      this.channel = new BroadcastChannel("morrow-finance-updates");
      this.channel.onmessage = () =>
        this.listeners.forEach((listener) => listener());
    }
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private announce(): void {
    this.channel?.postMessage("changed");
    this.listeners.forEach((listener) => listener());
  }
  open(): Promise<FinanceState> {
    this.opening ??= this.initialize().catch((error) => {
      this.opening = null;
      throw error;
    });
    return this.opening;
  }
  private async initialize(): Promise<FinanceState> {
    const { Capacitor } = await import("@capacitor/core");
    this.adapter = Capacitor.isNativePlatform()
      ? await NativeAdapter.open()
      : new WebAdapter();
    let existing: FinanceState | null;
    try {
      existing = await this.adapter.read();
    } catch (error) {
      // Never silently replace corruption with an empty dataset.
      throw new Error(
        `Morrow could not read its database. Your stored records have been left untouched. Restore a verified recovery file. ${error instanceof Error ? error.message : ""}`,
        { cause: error },
      );
    }
    if (existing) {
      this.migration = {
        sources: existing.legacy ? ["Original finance tracker"] : [],
        report: existing.legacy?.report ?? null,
        recovered: false,
      };
      return existing;
    }
    const sources = await legacySources();
    let state: FinanceState;
    const copies: RecoveryCopy[] = sources.map((source) => ({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reason: `Original legacy database: ${source.name}`,
      data: JSON.stringify(
        {
          kind: "morrow-legacy-original",
          source: source.name,
          capturedAt: new Date().toISOString(),
          ...source.input,
        },
        null,
        2,
      ),
    }));
    if (sources.length) {
      const migrated = migrateLegacy(sources[0].input, localDate());
      if (sources.length > 1)
        migrated.report.issues.push({
          source: "reconciliation",
          index: 0,
          message: `${sources[0].name} was migrated. Additional older database(s) ${sources
            .slice(1)
            .map((source) => source.name)
            .join(
              ", ",
            )} were preserved as separate original recovery copies, without merging possibly duplicated history. Review those copies before importing additional records.`,
        });
      state = migrated.state;
      this.migration = {
        sources: [sources[0].name],
        archivedSources: sources.slice(1).map((source) => source.name),
        report: migrated.report,
        recovered: false,
      };
      copies.push(recovery(state, "Verified migration checkpoint"));
    } else state = createEmptyState(localDate());
    await this.adapter.initialize(state, copies);
    return (await this.adapter.read()) ?? state;
  }
  async read(): Promise<FinanceState> {
    await this.open();
    return (await this.adapter!.read()) ?? (await this.open());
  }
  async dispatch(command: FinanceCommand): Promise<FinanceState> {
    await this.open();
    const state = await this.adapter!.write(
      (current) => applyCommand(current, command),
      undefined,
      true,
    );
    this.announce();
    return state;
  }
  async transact(
    transform: StoreTransform,
    reason?: string,
  ): Promise<FinanceState> {
    await this.open();
    const state = await this.adapter!.write(transform, reason);
    this.announce();
    return state;
  }
  async restore(text: string): Promise<FinanceState> {
    const { state: imported, report } = previewBackup(text);
    validateState(imported);
    let readable = false;
    try {
      await this.open();
      readable = true;
    } catch (error) {
      if (!this.adapter) throw error;
    }
    const restored = readable
      ? await this.transact(
          (current) => ({
            ...imported,
            revision: Math.max(current.revision, imported.revision) + 1,
            updatedAt: new Date().toISOString(),
          }),
          "Before restoring a backup",
        )
      : await this.adapter!.replace({
          ...imported,
          revision: imported.revision + 1,
          updatedAt: new Date().toISOString(),
        });
    this.opening = Promise.resolve(restored);
    this.migration = {
      sources: imported.legacy ? ["Imported backup original records"] : [],
      report: report ?? imported.legacy?.report ?? null,
      recovered: true,
    };
    this.announce();
    return restored;
  }
  async recoveryCopies(): Promise<RecoveryCopy[]> {
    try {
      await this.open();
    } catch (error) {
      if (!this.adapter) throw error;
    }
    return this.adapter!.recoveryCopies();
  }
  async checkpoint(reason = "Manual recovery checkpoint"): Promise<void> {
    await this.transact((state) => state, reason);
  }
  async reset(): Promise<FinanceState> {
    const next = await this.transact(
      (current) => ({
        ...createEmptyState(localDate()),
        revision: current.revision + 1,
      }),
      "Before starting a new ledger",
    );
    this.migration = { sources: [], report: null, recovered: false };
    return next;
  }
}

export const financeRepository = new FinanceRepository();

export function previewBackup(text: string): {
  state: FinanceState;
  report: ReturnType<typeof migrateLegacy>["report"] | null;
  source: "morrow" | "legacy";
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Local records are unchanged.",
    );
  }
  if (Array.isArray(parsed)) {
    const migrated = migrateLegacy(
      { transactions: parsed, budgets: [], savings: [] },
      localDate(),
    );
    return { ...migrated, source: "legacy" };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    !("schemaVersion" in parsed) &&
    !("format" in parsed)
  ) {
    const object = parsed as Record<string, unknown>;
    if (
      ["transactions", "budgets", "savings"].some((key) =>
        Array.isArray(object[key]),
      )
    ) {
      for (const key of ["transactions", "budgets", "savings"])
        if (object[key] !== undefined && !Array.isArray(object[key]))
          throw new Error(
            `Legacy backup ${key} must be an array. Local records are unchanged.`,
          );
      const migrated = migrateLegacy(
        {
          transactions: (object.transactions as unknown[]) ?? [],
          budgets: (object.budgets as unknown[]) ?? [],
          savings: (object.savings as unknown[]) ?? [],
        },
        localDate(),
      );
      return { ...migrated, source: "legacy" };
    }
  }
  return { state: parseBackup(parsed), report: null, source: "morrow" };
}

export function importRows(
  state: FinanceState,
  rows: ImportRow[],
): FinanceState {
  if (!rows.length) throw new Error("There are no valid entries to import.");
  if (rows.some((row) => row.type === "transfer"))
    throw new Error(
      "Legacy Savings/Vault transfers do not represent new earnings. Restore the original legacy JSON for migration, or remove these rows from this import.",
    );
  const categoryCommands: FinanceCommand[] = [];
  const names = new Set(
    state.categories.map((category) => category.name.toLocaleLowerCase()),
  );
  for (const row of rows.filter((row) => row.type === "expense")) {
    const name = row.category.trim() || "General";
    if (!names.has(name.toLocaleLowerCase())) {
      names.add(name.toLocaleLowerCase());
      categoryCommands.push({ type: "add-category", name });
    }
  }
  const next = categoryCommands.length
    ? applyCommands(state, categoryCommands)
    : state;
  const commands: FinanceCommand[] = [];
  const fingerprints = new Set(
    state.journal
      .filter((entry) => entry.kind === "income" || entry.kind === "expense")
      .map(
        (entry) =>
          `${entry.kind}|${entry.date}|${entry.amount}|${entry.kind === "income" ? "earnings" : state.categories.find((category) => category.id === entry.categoryId)?.name.toLocaleLowerCase() || "general"}|${entry.note.trim()}`,
      ),
  );
  for (const row of rows) {
    const categoryName = row.category.trim() || "General";
    const fingerprint = `${row.type}|${row.date}|${row.amount}|${row.type === "income" ? "earnings" : categoryName.toLocaleLowerCase()}|${row.note.trim()}`;
    if (fingerprints.has(fingerprint))
      throw new Error(
        `Possible duplicate at source line ${row.sourceLine}: ${row.note || categoryName}. Review or remove it before importing.`,
      );
    fingerprints.add(fingerprint);
    if (row.type === "income")
      commands.push({
        type: "add-income",
        amount: row.amount,
        date: row.date,
        note: row.note,
      });
    else {
      const category = next.categories.find(
        (item) =>
          item.name.toLocaleLowerCase() === categoryName.toLocaleLowerCase(),
      );
      commands.push({
        type: "add-expense",
        categoryId: category!.id,
        amount: row.amount,
        date: row.date,
        note: row.note,
      });
    }
  }
  return applyCommands(next, commands);
}

export function useFinanceStore() {
  const [state, setState] = useState<FinanceState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      let next = await financeRepository.read();
      const month = localDate().slice(0, 7);
      if (next.activeMonth < month)
        next = await financeRepository.dispatch({ type: "rollover", month });
      setState(next);
      setStatus("ready");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh();
    };
    const unsubscribe = financeRepository.subscribe(update);
    update();
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const dispatch = useCallback(async (command: FinanceCommand) => {
    const next = await financeRepository.dispatch(command);
    setState(next);
    return next;
  }, []);
  const replaceFromBackup = useCallback(async (text: string) => {
    const next = await financeRepository.restore(text);
    setState(next);
    setStatus("ready");
    setError(null);
    return next;
  }, []);
  const commitImportPreview = useCallback(async (rows: ImportRow[]) => {
    const next = await financeRepository.transact(
      (current) => importRows(current, rows),
      "Before bulk import",
    );
    setState(next);
    return next;
  }, []);
  const reset = useCallback(async () => {
    const next = await financeRepository.reset();
    setState(next);
    return next;
  }, []);
  return {
    state,
    status,
    error,
    refresh,
    dispatch,
    reset,
    migrationReport: financeRepository.migration.report,
    migration: financeRepository.migration,
    replaceFromBackup,
    importBackup: replaceFromBackup,
    commitImportPreview,
    getBackup: () => {
      if (!state) throw new Error("Wait for your records to load.");
      return serializeBackup(state);
    },
    getRecoveryCopies: () => financeRepository.recoveryCopies(),
    checkpoint: (reason?: string) => financeRepository.checkpoint(reason),
  };
}
