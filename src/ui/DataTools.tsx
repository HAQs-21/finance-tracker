import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Cloud,
  FileJson,
  Trash2,
} from "lucide-react";
import { formatMoney, projectFinance } from "../domain";
import {
  parseImportText,
  parseImportAmount,
  type ImportPreview,
  type ImportRow,
} from "../data/imports";
import { previewBackup, type useFinanceStore } from "../data/store";
import { downloadFile } from "../data/exports";
import {
  downloadBackup,
  uploadBackup,
  getGithubConfig,
  saveGithubConfig,
  clearGithubConfig,
  type GithubConfig,
} from "../data/github";
import type { Notify } from "./AppShell";
import { Field, InlineError, Sheet } from "./primitives";

type Store = ReturnType<typeof useFinanceStore>;
type Preview = ReturnType<typeof previewBackup>;
type DraftRow = ImportRow & { amountText: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function RestorePreview({
  preview,
  onConfirm,
  pending,
  label = "Restore this backup",
}: {
  preview: Preview;
  onConfirm: () => void;
  pending: boolean;
  label?: string;
}) {
  const projection = projectFinance(preview.state);
  return (
    <div className="confirm-box">
      <p className="eyebrow">
        VERIFIED {preview.source === "legacy" ? "LEGACY MIGRATION" : "BACKUP"}
      </p>
      <h3>Review before restoring.</h3>
      <div className="form-two">
        <span>{preview.state.journal.length} journal records</span>
        <span>{preview.state.budgets.length} monthly budgets</span>
        <span>{preview.state.categories.length} categories</span>
        <span>Savings: {formatMoney(projection.savings)}</span>
      </div>
      <p className="muted">
        This replaces the active ledger. A complete recovery copy of your
        current records is preserved first.
      </p>
      {preview.report && (
        <p className="period-note">
          Legacy records are migrated with their original source preserved.{" "}
          {preview.report.issues.length} item(s) require review in the migration
          report.
        </p>
      )}
      <button className="button primary" disabled={pending} onClick={onConfirm}>
        {pending ? "Restoring…" : label}
        <ArrowDownToLine size={17} />
      </button>
    </div>
  );
}

export function ImportTool({
  store,
  notify,
  onClose,
}: {
  store: Store;
  notify: Notify;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [page, setPage] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const parse = () => {
    try {
      const result = parseImportText(text);
      setPreview(result);
      setRows(
        result.rows.map((row) => ({
          ...row,
          amountText: String(row.amount / 100),
        })),
      );
      setPage(0);
      setReviewed(false);
      setError("");
    } catch (caught) {
      setError(message(caught));
    }
  };
  const update = (id: string, patch: Partial<DraftRow>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const commit = async () => {
    setPending(true);
    setError("");
    try {
      await store.commitImportPreview(
        rows.map((row) => ({
          ...row,
          amount: parseImportAmount(row.amountText),
        })),
      );
      notify(
        `${rows.length} entries imported. Your earlier ledger was preserved in recovery.`,
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
      title="Bring your history along."
      description="Paste notes or open a CSV. Review exact amounts, inferred dates, and categories before anything is saved."
      onClose={onClose}
      wide
    >
      {!preview ? (
        <>
          <Field label="Notes or CSV">
            <textarea
              rows={10}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                "October 2026 (40k)\n1,200 Dinner [Food]\n2026-10-17 expense 250 Coffee [Food]"
              }
            />
          </Field>
          <label className="button secondary">
            Open a text or CSV file
            <input
              className="visually-hidden"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  void file
                    .text()
                    .then(setText)
                    .catch((caught) => setError(message(caught)));
              }}
            />
          </label>
          <p className="period-note">
            CSV columns: Date, Type, Amount, Category, Note. Amounts use rupees.
            Dates use YYYY-MM-DD. Notes without a date receive the 15th of their
            stated month. New expenses require a funded category budget.
          </p>
          <InlineError error={error} />
          <button
            className="button primary"
            disabled={!text.trim()}
            onClick={parse}
          >
            Preview entries <ArrowUpRight size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="section-heading">
            <h3>{rows.length} entries to review</h3>
            <button className="button subtle" onClick={() => setPreview(null)}>
              Edit source
            </button>
          </div>
          <p className="muted">
            Every field is editable. Removing a preview row leaves its source
            text untouched.
          </p>
          <div className="import-table">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Amount (Rs)</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>
                    <span className="visually-hidden">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 20, (page + 1) * 20).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        aria-label={`Type, source line ${row.sourceLine}`}
                        value={row.type}
                        onChange={(event) =>
                          update(row.id, {
                            type: event.target.value as ImportRow["type"],
                          })
                        }
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Earnings</option>
                        <option value="transfer">Legacy transfer</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Date, source line ${row.sourceLine}`}
                        type="date"
                        value={row.date}
                        onChange={(event) =>
                          update(row.id, {
                            date: event.target.value,
                            inferredDate: false,
                          })
                        }
                      />
                      {row.inferredDate && <small>Inferred</small>}
                    </td>
                    <td>
                      <input
                        aria-label={`Amount, source line ${row.sourceLine}`}
                        inputMode="decimal"
                        value={row.amountText}
                        onChange={(event) =>
                          update(row.id, { amountText: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Category, source line ${row.sourceLine}`}
                        value={row.category}
                        onChange={(event) =>
                          update(row.id, { category: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Note, source line ${row.sourceLine}`}
                        value={row.note}
                        onChange={(event) =>
                          update(row.id, { note: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Remove source line ${row.sourceLine} from preview`}
                        onClick={() =>
                          setRows((current) =>
                            current.filter((item) => item.id !== row.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 && (
            <div className="action-pair">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="muted">
                {page + 1} / {Math.ceil(rows.length / 20)}
              </span>
              <button
                className="button secondary"
                disabled={(page + 1) * 20 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
          {preview.issues.length > 0 && (
            <details className="confirm-box">
              <summary>
                {preview.issues.length} parsing notes and unmatched lines
              </summary>
              <div className="detail-entries">
                {preview.issues.slice(0, 100).map((issue, index) => (
                  <p key={index}>
                    <strong>Line {issue.line}:</strong> {issue.message}
                    <br />
                    <small>{issue.text}</small>
                  </p>
                ))}
                {preview.issues.length > 100 && (
                  <p>
                    First 100 shown. Save the original text to retain all source
                    lines.
                  </p>
                )}
              </div>
            </details>
          )}
          {rows.some((row) => row.type === "transfer") && (
            <p className="period-note">
              Old Savings/Vault transfers are not new earnings. Restore your
              original JSON backup to migrate them safely, or remove them here.
            </p>
          )}
          <label className="setting-row">
            <span>
              I reviewed the dates, categories, and unmatched source lines.
            </span>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
          </label>
          <InlineError error={error} />
          <button
            className="button primary"
            disabled={pending || !rows.length || !reviewed}
            onClick={() => void commit()}
          >
            {pending
              ? "Importing atomically…"
              : `Import ${rows.length} entries`}
            <Check size={17} />
          </button>
        </>
      )}
    </Sheet>
  );
}

export function RestoreTool({
  store,
  notify,
  onClose,
}: {
  store: Store;
  notify: Notify;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const read = (source: string) => {
    try {
      setText(source);
      setPreview(previewBackup(source));
      setError("");
    } catch (caught) {
      setPreview(null);
      setError(message(caught));
    }
  };
  return (
    <Sheet
      title="Restore a little certainty."
      description="Morrow backups and the original Finance Tracker JSON format are supported."
      onClose={onClose}
    >
      <label className="button secondary">
        <FileJson size={17} /> Choose a JSON backup
        <input
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file)
              void file
                .text()
                .then(read)
                .catch((caught) => setError(message(caught)));
          }}
        />
      </label>
      <Field label="Or paste backup JSON">
        <textarea
          rows={5}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
          }}
        />
      </Field>
      <button
        className="button secondary"
        disabled={!text.trim()}
        onClick={() => read(text)}
      >
        Verify and preview
      </button>
      <InlineError error={error} />
      {preview && (
        <RestorePreview
          preview={preview}
          pending={pending}
          onConfirm={() => {
            setPending(true);
            void store
              .replaceFromBackup(text)
              .then(() => {
                notify("Backup restored. Previous records remain in recovery.");
                onClose();
              })
              .catch((caught) => setError(message(caught)))
              .finally(() => setPending(false));
          }}
        />
      )}
    </Sheet>
  );
}

export function CloudTool({
  store,
  notify,
  onClose,
}: {
  store: Store;
  notify: Notify;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<GithubConfig>(
    () =>
      getGithubConfig() || {
        owner: "",
        repo: "",
        path: "morrow/current.json",
        token: "",
      },
  );
  const [remote, setRemote] = useState<{
    backup: string;
    sha: string;
    preview: Preview;
  } | null>(null);
  const [mode, setMode] = useState<"upload" | "restore" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [lastBackup, setLastBackup] = useState(() => {
    try {
      return localStorage.getItem("morrow.last-backup") || "";
    } catch {
      return "";
    }
  });
  const edit = (patch: Partial<GithubConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setRemote(null);
    setMode(null);
  };
  const inspect = async () => {
    setPending(true);
    setError("");
    setMode(null);
    try {
      saveGithubConfig(config);
      const downloaded = await downloadBackup(config);
      setRemote({ ...downloaded, preview: previewBackup(downloaded.backup) });
      notify("Remote backup verified. Review it before replacing either copy.");
    } catch (caught) {
      setRemote(null);
      setError(message(caught));
    } finally {
      setPending(false);
    }
  };
  const upload = async () => {
    setPending(true);
    setError("");
    try {
      saveGithubConfig(config);
      const sha = await uploadBackup(
        config,
        store.getBackup(),
        remote?.sha || null,
      );
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem("morrow.last-backup", stamp);
      } catch {
        /* Status only. */
      }
      setLastBackup(stamp);
      setRemote({
        backup: store.getBackup(),
        sha,
        preview: previewBackup(store.getBackup()),
      });
      setMode(null);
      notify("Your verified backup is on GitHub.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet
      title="An outside copy."
      description="GitHub stores a complete readable recovery file. Local changes stay local until you back them up."
      onClose={onClose}
      wide
    >
      <div className="form-two">
        <Field label="Repository owner">
          <input
            autoComplete="off"
            value={config.owner}
            onChange={(event) => edit({ owner: event.target.value })}
          />
        </Field>
        <Field label="Repository name">
          <input
            value={config.repo}
            onChange={(event) => edit({ repo: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Backup path">
        <input
          value={config.path}
          onChange={(event) => edit({ path: event.target.value })}
        />
      </Field>
      <Field
        label="GitHub access token"
        hint="Kept in memory for this session. Use a private repository and a token limited to its contents."
      >
        <input
          type="password"
          autoComplete="off"
          value={config.token}
          onChange={(event) => edit({ token: event.target.value })}
        />
      </Field>
      <p className="period-note">
        This is a backup and restore workflow. Use one editing device at a time;
        independent offline devices cannot share a strict spending limit.
      </p>
      <p className="muted">
        {lastBackup
          ? `Last successful upload from this device: ${new Date(lastBackup).toLocaleString()}`
          : "No successful upload recorded on this device."}
      </p>
      <div className="action-pair">
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => void inspect()}
        >
          <Cloud size={17} />
          {pending ? "Working…" : "Inspect remote backup"}
        </button>
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => {
            setMode("upload");
            setError("");
          }}
        >
          Back up this ledger <ArrowUpRight size={17} />
        </button>
      </div>
      <InlineError error={error} />
      {remote && (
        <div className="confirm-box">
          <p className="eyebrow">VERIFIED REMOTE COPY</p>
          <h3>
            {remote.preview.state.journal.length} journal records ·{" "}
            {remote.preview.state.budgets.length} budgets
          </h3>
          <p className="muted">
            Dataset {remote.preview.state.id.slice(0, 8)} · revision{" "}
            {remote.preview.state.revision}
          </p>
          <div className="action-pair">
            <button
              className="button secondary"
              onClick={() =>
                void downloadFile(
                  "Morrow-remote-backup.json",
                  remote.backup,
                ).catch((caught) => setError(message(caught)))
              }
            >
              Save remote file
            </button>
            <button
              className="button secondary"
              onClick={() => setMode("restore")}
            >
              Review restore
            </button>
          </div>
        </div>
      )}
      {mode === "upload" && (
        <div className="confirm-box">
          <h3>
            {remote
              ? "Replace the reviewed remote copy?"
              : "Create a new remote backup?"}
          </h3>
          <p className="muted">
            {remote
              ? "Your current complete ledger will replace the revision you inspected. An intervening remote change stops the upload."
              : "Existing remote files are never overwritten without first inspecting them. If this path exists, the upload will stop."}
          </p>
          <button
            className="button primary"
            disabled={pending}
            onClick={() => void upload()}
          >
            {pending ? "Uploading…" : "Confirm backup"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      )}
      {mode === "restore" && remote && (
        <RestorePreview
          preview={remote.preview}
          pending={pending}
          onConfirm={() => {
            setPending(true);
            void store
              .replaceFromBackup(remote.backup)
              .then(() => {
                notify(
                  "Remote backup restored; previous local records preserved.",
                );
                onClose();
              })
              .catch((caught) => setError(message(caught)))
              .finally(() => setPending(false));
          }}
        />
      )}
      <button
        className="button subtle"
        onClick={() => {
          clearGithubConfig();
          setConfig({
            owner: "",
            repo: "",
            path: "morrow/current.json",
            token: "",
          });
          setRemote(null);
          setMode(null);
          notify("Destination disconnected and session token cleared.");
        }}
      >
        Disconnect destination
      </button>
    </Sheet>
  );
}
