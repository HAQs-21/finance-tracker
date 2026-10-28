import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  FileJson,
  FileSpreadsheet,
  FileText,
  Cloud,
} from "lucide-react";
import {
  downloadFile,
  exportCsv,
  exportExcel,
  exportText,
  copyNotes,
} from "../data/exports";
import type { useFinanceStore } from "../data/store";
import type { Notify } from "./AppShell";
import { CloudPanel } from "./CloudBackup";
import { InlineError } from "./primitives";
import "./data-center.css";
type Format = "csv" | "excel" | "text";
export function DataCenter({
  store,
  notify,
  onImport,
  onRestore,
}: {
  store: ReturnType<typeof useFinanceStore>;
  notify: Notify;
  onImport: () => void;
  onRestore: () => void;
}) {
  const [tab, setTab] = useState("backup");
  const [format, setFormat] = useState<Format>("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = store.state!;
  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      notify(done);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const exportRecords = () =>
    run(async () => {
      if (format === "excel") await exportExcel(state);
      else if (format === "csv")
        await downloadFile(
          "Morrow-transactions.csv",
          exportCsv(state),
          "text/csv;charset=utf-8",
        );
      else
        await downloadFile(
          "Morrow-notes.txt",
          exportText(state),
          "text/plain;charset=utf-8",
        );
    }, "Export ready");
  return (
    <section
      className="data-center settings-section settings-card"
      id="data-backups"
      aria-label="Import and export"
    >
      <div className="data-heading">
        <div>
          <h2>Data & backups</h2>
          <p>
            {state.journal.length.toLocaleString()} journal records · stored on
            this device
          </p>
        </div>
        <FileJson size={21} />
      </div>
      <div
        className="data-tabs"
        role="tablist"
        aria-label="Data tools"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        {[
          { id: "backup", label: "Backup" },
          { id: "export", label: "Export" },
          { id: "import", label: "Import" },
          { id: "github", label: "GitHub" },
        ].map((item) => (
          <button
            role="tab"
            key={item.id}
            id={`data-tab-${item.id}`}
            aria-controls="data-tools-panel"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            disabled={busy}
            onClick={() => {
              setTab(item.id);
              setError("");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="data-panel"
        key={tab}
        id="data-tools-panel"
        role="tabpanel"
        aria-labelledby={`data-tab-${tab}`}
      >
        {tab === "backup" && (
          <div className="data-choice-grid">
            <div className="data-choice">
              <FileJson size={23} />
              <h3>Complete backup</h3>
              <p>
                Everything needed to restore: journal, budgets, templates,
                categories and original imported data.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      downloadFile("Morrow-recovery.json", store.getBackup()),
                    "Complete backup ready",
                  )
                }
              >
                <ArrowDownToLine size={16} />
                Complete JSON
              </button>
            </div>
            <div className="data-choice">
              <ArrowUpFromLine size={23} />
              <h3>Restore a backup</h3>
              <p>
                Review a Morrow or original Finance Tracker JSON file before
                replacing this ledger.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={onRestore}
              >
                Restore JSON
              </button>
            </div>
          </div>
        )}
        {tab === "export" && (
          <>
            <h3>Export records</h3>
            <div className="export-formats">
              {[
                {
                  id: "csv" as const,
                  label: "CSV",
                  note: "Active earnings & expenses",
                  icon: FileText,
                },
                {
                  id: "excel" as const,
                  label: "Excel + formulas",
                  note: "Journal, formulas & reports",
                  icon: FileSpreadsheet,
                },
                {
                  id: "text" as const,
                  label: "Text notes",
                  note: "Readable earnings & expenses",
                  icon: FileText,
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={format === item.id ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={item.id}
                    checked={format === item.id}
                    onChange={() => setFormat(item.id)}
                  />
                  <item.icon size={20} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="data-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void exportRecords()}
              >
                <ArrowDownToLine size={16} />
                {busy ? "Preparing…" : "Export file"}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run(() => copyNotes(state), "Notes copied")}
              >
                <Copy size={16} />
                Copy notes
              </button>
            </div>
            <p className="data-help">
              For a complete recovery file, use Backup → Complete JSON.
            </p>
          </>
        )}
        {tab === "import" && (
          <div className="data-choice-grid">
            <div className="data-choice">
              <FileText size={23} />
              <h3>Add records</h3>
              <p>
                Open notes or CSV. Edit amounts, dates and categories in a paged
                preview before importing.
              </p>
              <button className="button primary" onClick={onImport}>
                Import notes / CSV
              </button>
            </div>
            <div className="data-choice">
              <FileJson size={23} />
              <h3>Replace from backup</h3>
              <p>
                Restore complete JSON. Your current ledger is kept as a recovery
                checkpoint.
              </p>
              <button className="button secondary" onClick={onRestore}>
                Restore JSON
              </button>
            </div>
          </div>
        )}
        {tab === "github" && (
          <>
            <div className="data-subheading">
              <Cloud size={20} />
              <div>
                <h3>GitHub backup</h3>
                <p className="data-help">
                  Manual backup and restore between devices.
                </p>
              </div>
            </div>
            <CloudPanel store={store} notify={notify} />
          </>
        )}
        {busy && tab === "backup" && (
          <p role="status" className="data-help">
            Preparing complete backup…
          </p>
        )}
        <InlineError error={error} />
      </div>
    </section>
  );
}
