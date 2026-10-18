import { memo, useState, type Dispatch, type SetStateAction } from "react";
import { AnimatePresence } from "motion/react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Database,
  FileJson,
  FolderHeart,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { formatMoney, type Category } from "../domain";
import { type useFinanceStore, type RecoveryCopy } from "../data/store";
import {
  downloadFile,
  exportCsv,
  exportExcel,
  exportText,
} from "../data/exports";
import type { Notify, Preferences } from "./AppShell";
import { unlockSavings, type SavingsPrivacyStatus } from "../data/privacy";
import { categoryColors } from "./colors";
import { CategoryIcon, Field, InlineError, Sheet, Submit } from "./primitives";
import { CloudTool, ImportTool, RestoreTool } from "./DataTools";
import "./settings.css";

type Store = ReturnType<typeof useFinanceStore>;
type Tool =
  "import" | "restore" | "cloud" | "copies" | "reset" | "category" | null;
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

function CategoryEditor({
  store,
  category,
  onClose,
  notify,
}: {
  store: Store;
  category: Category | null;
  onClose: () => void;
  notify: Notify;
}) {
  const [name, setName] = useState(category?.name || "");
  const [color, setColor] = useState(category?.color || categoryColors[0]);
  const [icon, setIcon] = useState(category?.icon || "general");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setPending(true);
    setError("");
    try {
      await store.dispatch(
        category
          ? { type: "update-category", id: category.id, name, color, icon }
          : { type: "add-category", name, color, icon },
      );
      notify(
        category
          ? "Category updated throughout your ledger."
          : "Category created. Give it a budget when you are ready.",
      );
      onClose();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet
      title={category ? "Edit category" : "New category"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Category name">
          <input
            value={name}
            maxLength={60}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Icon">
          <select
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
          >
            {[
              "general",
              "food",
              "coffee",
              "transport",
              "rent",
              "tax",
              "shopping",
              "medical",
              "entertainment",
              "utilities",
              "travel",
              "gift",
              "investments",
            ].map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category color">
          <div className="color-swatches">
            {categoryColors.map((value) => (
              <button
                key={value}
                type="button"
                className={`color-swatch ${color === value ? "selected" : ""}`}
                style={{ background: value }}
                aria-label={`Use color ${value}`}
                aria-pressed={color === value}
                onClick={() => setColor(value)}
              >
                {color === value && <Check size={17} />}
              </button>
            ))}
            <input
              type="color"
              aria-label="Choose a custom category color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
        </Field>
        <InlineError error={error} />
        <Submit pending={pending}>
          {category ? "Save category" : "Create category"}
          <Check size={17} />
        </Submit>
      </form>
      {category && (
        <div className="confirm-box">
          <h3>
            {category.archived ? "Bring it back?" : "Retire this category?"}
          </h3>
          <p className="muted">
            {category.archived
              ? "Unarchive to use it in new budgets again."
              : "Close its open budgets first. Past entries and reports keep their category."}
          </p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void store
                .dispatch({
                  type: "update-category",
                  id: category.id,
                  archived: !category.archived,
                })
                .then(() => {
                  notify(
                    category.archived
                      ? "Category restored."
                      : "Category archived; history preserved.",
                  );
                  onClose();
                })
                .catch((caught) => setError(message(caught)))
                .finally(() => setPending(false));
            }}
          >
            {category.archived ? "Unarchive category" : "Archive category"}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function RecoveryCopies({
  store,
  onClose,
  notify,
}: {
  store: Store;
  onClose: () => void;
  notify: Notify;
}) {
  const [copies, setCopies] = useState<RecoveryCopy[] | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    void store
      .getRecoveryCopies()
      .then(setCopies)
      .catch((caught) => setError(message(caught)));
  };
  return (
    <Sheet
      title="Recovery checkpoints"
      description="Copies on this device. Export for an independent backup."
      onClose={onClose}
      wide
    >
      <div className="action-pair">
        <button className="button secondary" onClick={load}>
          Load recovery copies
        </button>
        <button
          className="button secondary"
          onClick={() => {
            void store
              .checkpoint()
              .then(() => {
                notify("Recovery checkpoint saved.");
                load();
              })
              .catch((caught) => setError(message(caught)));
          }}
        >
          Create checkpoint <Plus size={16} />
        </button>
      </div>
      <InlineError error={error} />
      {copies &&
        (copies.length ? (
          <div className="detail-entries">
            {copies.map((copy) => (
              <div className="setting-row" key={copy.id}>
                <div>
                  <strong>{copy.reason}</strong>
                  <p className="muted">
                    {new Date(copy.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Download ${copy.reason}`}
                  onClick={() =>
                    void downloadFile(
                      `Morrow-recovery-${copy.createdAt.slice(0, 10)}-${copy.id.slice(0, 6)}.json`,
                      copy.data,
                    ).catch((caught) => setError(message(caught)))
                  }
                >
                  <ArrowDownToLine size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="period-note">
            No recovery checkpoints yet. Your first import or restore also
            creates one automatically.
          </p>
        ))}
    </Sheet>
  );
}

function ResetTool({
  store,
  notify,
  onClose,
}: {
  store: Store;
  notify: Notify;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet
      title="Start a new ledger"
      description="Exports a backup first and retains a recovery checkpoint."
      onClose={onClose}
    >
      <p className="period-note">
        All active financial entries, category changes, budgets, and recurring
        templates are removed from the new ledger. Recovery copies and display
        preferences remain on this device.
      </p>
      <Field label="Type NEW LEDGER to continue">
        <input
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </Field>
      <InlineError error={error} />
      <button
        className="button danger"
        disabled={pending || confirmation !== "NEW LEDGER"}
        onClick={() => {
          setPending(true);
          void downloadFile("Morrow-before-new-ledger.json", store.getBackup())
            .then(() => store.reset())
            .then(() => {
              notify(
                "Fresh ledger started. Your previous records remain recoverable.",
              );
              onClose();
            })
            .catch((caught) => setError(message(caught)))
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Preserving your ledger…" : "Export backup and begin again"}
      </button>
    </Sheet>
  );
}

function Settings({
  store,
  preferences,
  setPreferences,
  notify,
  onRecover,
  privacy,
}: {
  store: Store;
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  notify: Notify;
  onRecover: () => void;
  privacy: SavingsPrivacyStatus;
}) {
  const state = store.state!;
  const [tool, setTool] = useState<Tool>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [persistent, setPersistent] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const report = store.migrationReport;
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
      notify(`${label} ready.`);
    } catch (caught) {
      notify(message(caught), true);
    } finally {
      setBusy(null);
    }
  };
  const persistStorage = async () => {
    try {
      const result = await navigator.storage?.persist?.();
      setPersistent(
        result
          ? "Persistent browser storage granted."
          : "Persistence was not granted. Keep an external recovery file.",
      );
    } catch {
      setPersistent(
        "This platform does not expose browser storage persistence. Keep an external recovery file.",
      );
    }
  };
  return (
    <div className="settings-page">
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <div className="settings-grid">
        <section className="settings-section settings-card">
          <div className="section-heading">
            <h2>
              <Moon size={18} /> Appearance & privacy
            </h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
            </div>
            <div className="segmented">
              <button
                className={preferences.theme === "ink" ? "active" : ""}
                aria-pressed={preferences.theme === "ink"}
                onClick={() =>
                  setPreferences((current) => ({ ...current, theme: "ink" }))
                }
              >
                Ink
              </button>
              <button
                className={preferences.theme === "charcoal" ? "active" : ""}
                aria-pressed={preferences.theme === "charcoal"}
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    theme: "charcoal",
                  }))
                }
              >
                Charcoal
              </button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>
                <Sparkles size={15} /> Reduce animations
              </strong>
            </div>
            <Toggle
              checked={preferences.motion === "always"}
              label="Reduce animations"
              onChange={() =>
                setPreferences((current) => ({
                  ...current,
                  motion: current.motion === "always" ? "user" : "always",
                }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>
                <Volume2 size={15} /> Haptic feedback
              </strong>
            </div>
            <Toggle
              checked={preferences.haptics}
              label="Haptic feedback"
              onChange={() =>
                setPreferences((current) => ({
                  ...current,
                  haptics: !current.haptics,
                }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Conceal amounts</strong>
              <p className="muted">Hide amounts throughout the app.</p>
            </div>
            <Toggle
              checked={preferences.conceal}
              label="Conceal financial amounts"
              onChange={() =>
                setPreferences((current) => ({
                  ...current,
                  conceal: !current.conceal,
                }))
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Device lock for Savings</strong>
              <p className="muted">
                {privacy.available
                  ? "Fingerprint or screen lock to open."
                  : privacy.native
                    ? "Set up an Android screen lock first."
                    : "Available on Android. Savings stays hidden until opened."}
              </p>
            </div>
            <button
              type="button"
              className={`toggle ${preferences.savingsProtection === "required" || (preferences.savingsProtection === "auto" && privacy.available) ? "on" : ""}`}
              role="switch"
              aria-label="Device lock for Savings"
              aria-checked={
                preferences.savingsProtection === "required" ||
                (preferences.savingsProtection === "auto" && privacy.available)
              }
              disabled={!!busy || !privacy.available}
              onClick={() => {
                void run("Savings privacy", async () => {
                  const enabled =
                    preferences.savingsProtection === "required" ||
                    (preferences.savingsProtection === "auto" &&
                      privacy.available);
                  if (enabled)
                    await unlockSavings(preferences.savingsProtection);
                  setPreferences((current) => ({
                    ...current,
                    savingsProtection: enabled ? "hidden" : "required",
                  }));
                });
              }}
            >
              <span />
            </button>
          </div>
        </section>
        <section className="settings-section settings-card">
          <div className="section-heading">
            <h2>
              <Palette size={18} /> Categories
            </h2>
            <button
              className="button subtle"
              onClick={() => {
                setCategory(null);
                setTool("category");
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>
          <div className="category-manager">
            {state.categories
              .filter((item) => showArchived || !item.archived)
              .map((item) => (
                <button
                  className="setting-row category-setting"
                  key={item.id}
                  onClick={() => {
                    setCategory(item);
                    setTool("category");
                  }}
                >
                  <span className="category-icon" style={{ color: item.color }}>
                    <CategoryIcon name={item.icon} />
                  </span>
                  <span>
                    {item.name}
                    {item.archived && (
                      <small className="muted"> · Archived</small>
                    )}
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
          </div>
          {state.categories.some((item) => item.archived) && (
            <button
              className="button subtle"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived
                ? "Hide archived categories"
                : "Show archived categories"}
            </button>
          )}
        </section>
        <section className="settings-section settings-card">
          <div className="section-heading">
            <h2>
              <FolderHeart size={18} /> Import & export
            </h2>
          </div>
          <p className="muted">
            JSON restores the complete ledger. CSV and text contain active
            transactions; Excel includes the journal and reports.
          </p>
          <div className="export-grid">
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void run("Recovery file", () =>
                  downloadFile("Morrow-recovery.json", store.getBackup()),
                )
              }
            >
              <FileJson size={18} /> Complete JSON
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void run("CSV export", () =>
                  downloadFile(
                    "Morrow-transactions.csv",
                    exportCsv(state),
                    "text/csv;charset=utf-8",
                  ),
                )
              }
            >
              <ArrowDownToLine size={18} /> CSV
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void run("Text export", () =>
                  downloadFile(
                    "Morrow-notes.txt",
                    exportText(state),
                    "text/plain;charset=utf-8",
                  ),
                )
              }
            >
              <ArrowDownToLine size={18} /> Text notes
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void run("Excel workbook", () => exportExcel(state))
              }
            >
              <ArrowDownToLine size={18} /> Excel + formulas
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void run("Clipboard copy", () =>
                  navigator.clipboard.writeText(exportText(state)),
                )
              }
            >
              <Copy size={18} /> Copy notes
            </button>
          </div>
          {busy && (
            <p className="period-note" role="status">
              Preparing {busy.toLowerCase()}…
            </p>
          )}
          <div className="action-pair">
            <button className="button subtle" onClick={() => setTool("import")}>
              Import notes / CSV <ArrowUpRight size={16} />
            </button>
            <button
              className="button subtle"
              onClick={() => setTool("restore")}
            >
              Restore JSON <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <section className="settings-section settings-card">
          <div className="section-heading">
            <h2>
              <Cloud size={18} /> GitHub backup
            </h2>
            <ShieldCheck size={18} />
          </div>
          <p className="muted">
            Keep an external copy. Review remote changes before restoring.
          </p>
          <button className="button secondary" onClick={() => setTool("cloud")}>
            Manage GitHub backup <ArrowUpRight size={17} />
          </button>
          <p className="period-note">
            Transfer between devices using JSON or GitHub. Automatic sync is not
            enabled.
          </p>
        </section>
        <section className="settings-section settings-card">
          <div className="section-heading">
            <h2>
              <Database size={18} /> Recovery
            </h2>
            <span className="status-dot" />
          </div>
          <p className="muted">
            {state.journal.length.toLocaleString()} journal records ·{" "}
            {state.budgets.length} monthly budgets · revision {state.revision}
          </p>
          <div className="action-pair">
            <button
              className="button secondary"
              onClick={() => setTool("copies")}
            >
              Recovery checkpoints
            </button>
            <button className="button subtle" onClick={onRecover}>
              Open recovery mode <ArrowUpRight size={16} />
            </button>
          </div>
          {!privacy.native && (
            <button
              className="button subtle"
              onClick={() => void persistStorage()}
            >
              Request persistent browser storage
            </button>
          )}
          {persistent && (
            <p className="muted" role="status">
              {persistent}
            </p>
          )}
          <button className="button subtle" onClick={() => setTool("reset")}>
            Export backup and start a new ledger
          </button>
        </section>
        {report && (
          <section className="settings-section settings-card">
            <div className="section-heading">
              <h2>
                <ShieldCheck size={18} /> Migration report
              </h2>
              <span className="muted">Originals preserved</span>
            </div>
            <div className="form-two">
              <span>{report.importedTransactions} imported transactions</span>
              <span>{report.sourceBudgets} original budgets</span>
              <span>{report.sourceSavings} original savings records</span>
              <span>{report.linkedTransfers} linked transfers</span>
              <span>Net funds: {formatMoney(report.netFunds)}</span>
              <span>Reserved: {formatMoney(report.allocated)}</span>
            </div>
            <p className="period-note">
              Historical limits did not reserve cash in the old app. Morrow
              reserves only the remaining current-month amount; earlier history
              stays intact.
            </p>
            {report.issues.length > 0 && (
              <details>
                <summary>{report.issues.length} reconciliation notes</summary>
                <div className="detail-entries">
                  {report.issues.map((issue, index) => (
                    <p key={index}>
                      <strong>
                        {issue.source} #{issue.index + 1}
                      </strong>{" "}
                      — {issue.message}
                    </p>
                  ))}
                </div>
              </details>
            )}
            <div className="action-pair">
              <button
                className="button secondary"
                onClick={() =>
                  void run("Migration report", () =>
                    downloadFile(
                      "Morrow-migration-report.json",
                      JSON.stringify(report, null, 2),
                    ),
                  )
                }
              >
                Save report
              </button>
              {state.legacy && (
                <button
                  className="button secondary"
                  onClick={() =>
                    void run("Original records", () =>
                      downloadFile(
                        "FinanceTracker-original-records.json",
                        JSON.stringify(state.legacy!.raw, null, 2),
                      ),
                    )
                  }
                >
                  Save original records
                </button>
              )}
            </div>
          </section>
        )}
      </div>
      <AnimatePresence>
        {tool === "import" && (
          <ImportTool
            store={store}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
        {tool === "restore" && (
          <RestoreTool
            store={store}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
        {tool === "cloud" && (
          <CloudTool
            store={store}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
        {tool === "category" && (
          <CategoryEditor
            key={category?.id || "new"}
            store={store}
            category={category}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
        {tool === "copies" && (
          <RecoveryCopies
            store={store}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
        {tool === "reset" && (
          <ResetTool
            store={store}
            notify={notify}
            onClose={() => setTool(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
export default memo(Settings);
