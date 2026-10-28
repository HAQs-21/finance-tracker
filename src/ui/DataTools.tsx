import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileJson,
  Trash2,
} from "lucide-react";
import { downloadFile } from "../data/exports";
import { formatMoney, projectFinance } from "../domain";
import {
  parseImportText,
  parseImportAmount,
  type ImportPreview,
  type ImportRow,
} from "../data/imports";
import { previewBackup, type useFinanceStore } from "../data/store";
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
      <h3>Review backup</h3>
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
  const [fileName, setFileName] = useState("");
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
      title="Import records"
      description="Paste notes or open a CSV, then review."
      onClose={onClose}
      wide
    >
      {!preview ? (
        <>
          <div className="import-source-actions">
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
                      .then((source) => {
                        setFileName(file.name);
                        setText(source);
                        setError("");
                      })
                      .catch((caught) => setError(message(caught)));
                }}
              />
            </label>
            {fileName && <span className="data-help">{fileName}</span>}
          </div>
          {fileName ? (
            <button
              className="quiet-button"
              onClick={() => {
                setFileName("");
                setText("");
              }}
            >
              Paste instead
            </button>
          ) : (
            <Field label="Notes or CSV">
              <textarea
                rows={5}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="2026-10-17 expense 250 Coffee [Food]"
              />
            </Field>
          )}
          <details className="data-details">
            <summary>Formats & import rules</summary>
            <p>
              CSV: Date, Type, Amount, Category, Note. Amounts are rupees; dates
              use YYYY-MM-DD. Undated notes use the 15th of their stated month.
              Expenses need funded budgets.
            </p>
          </details>
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
          <p className="muted">Review before adding to this ledger.</p>
          <div className="import-review">
            {rows.slice(page * 10, (page + 1) * 10).map((row) => (
              <article className="import-row" key={row.id}>
                <div className="import-row-heading">
                  <span>
                    Source line {row.sourceLine}
                    {row.inferredDate ? " · inferred date" : ""}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Remove source line ${row.sourceLine} from preview`}
                    onClick={() => {
                      setRows((current) =>
                        current.filter((item) => item.id !== row.id),
                      );
                      setPage((current) =>
                        Math.min(
                          current,
                          Math.max(0, Math.ceil((rows.length - 1) / 10) - 1),
                        ),
                      );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="import-row-fields">
                  <Field label="Type">
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
                  </Field>
                  <Field label="Date">
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
                  </Field>
                  <Field label="Amount · Rs">
                    <input
                      aria-label={`Amount, source line ${row.sourceLine}`}
                      inputMode="decimal"
                      value={row.amountText}
                      onChange={(event) =>
                        update(row.id, { amountText: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      aria-label={`Category, source line ${row.sourceLine}`}
                      value={row.category}
                      onChange={(event) =>
                        update(row.id, { category: event.target.value })
                      }
                    />
                  </Field>
                  <div className="import-note">
                    <Field label="Note">
                      <input
                        aria-label={`Note, source line ${row.sourceLine}`}
                        value={row.note}
                        onChange={(event) =>
                          update(row.id, { note: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {rows.length > 10 && (
            <div className="action-pair">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="muted">
                {page + 1} / {Math.ceil(rows.length / 10)}
              </span>
              <button
                className="button secondary"
                disabled={(page + 1) * 10 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
          <button
            className="quiet-button"
            onClick={() =>
              void downloadFile(
                "Morrow-import-source.txt",
                text,
                "text/plain;charset=utf-8",
              ).catch((caught) => setError(message(caught)))
            }
          >
            Save original source
          </button>
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
  const [fileName, setFileName] = useState("");
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
      title="Restore backup"
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
                .then((source) => {
                  setFileName(file.name);
                  read(source);
                })
                .catch((caught) => setError(message(caught)));
          }}
        />
      </label>
      {fileName ? (
        <div className="period-note">
          <span>{fileName}</span>
          <button
            onClick={() => {
              setFileName("");
              setText("");
              setPreview(null);
            }}
          >
            Paste instead
          </button>
        </div>
      ) : (
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
      )}
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
