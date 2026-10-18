import { useState } from "react";
import { ArrowDownToLine, FileJson, ShieldCheck } from "lucide-react";
import {
  financeRepository,
  previewBackup,
  type RecoveryCopy,
} from "../data/store";
import { downloadFile } from "../data/exports";
import { Logo } from "./brand";
import { Field, InlineError } from "./primitives";
import { RestorePreview } from "./DataTools";
import "./settings.css";

export default function RecoveryScreen({
  error,
  onRestore,
  onRetry,
}: {
  error: string | null;
  onRestore: (text: string) => Promise<void>;
  onRetry: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ReturnType<
    typeof previewBackup
  > | null>(null);
  const [copies, setCopies] = useState<RecoveryCopy[]>([]);
  const [localError, setLocalError] = useState("");
  const [pending, setPending] = useState(false);
  const read = (value: string) => {
    setText(value);
    try {
      setPreview(previewBackup(value));
      setLocalError("");
    } catch (caught) {
      setPreview(null);
      setLocalError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  return (
    <main className="recovery-page">
      <div className="recovery-card">
        <Logo size={53} />
        <p className="eyebrow">A SAFE PLACE TO START AGAIN</p>
        <h1>Let’s bring it back.</h1>
        <p className="page-subtitle">
          Your stored records stay untouched while you choose and verify a
          recovery copy.
        </p>
        <InlineError error={error} />
        <div className="period-note">
          <ShieldCheck size={18} /> Morrow accepts its complete recovery files
          and original Finance Tracker JSON backups. A damaged database is
          captured before a verified restore replaces it.
        </div>
        <label className="button secondary">
          <FileJson size={18} /> Choose recovery file
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
                  .catch((caught) => setLocalError(String(caught)));
            }}
          />
        </label>
        <Field label="Or paste your backup JSON">
          <textarea
            rows={6}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPreview(null);
            }}
          />
        </Field>
        <div className="action-pair">
          <button
            className="button secondary"
            disabled={!text.trim()}
            onClick={() => read(text)}
          >
            Verify backup
          </button>
          <button className="button subtle" onClick={onRetry}>
            Retry opening ledger
          </button>
        </div>
        <InlineError error={localError} />
        {preview && (
          <RestorePreview
            preview={preview}
            pending={pending}
            onConfirm={() => {
              setPending(true);
              void onRestore(text)
                .catch((caught) =>
                  setLocalError(
                    caught instanceof Error ? caught.message : String(caught),
                  ),
                )
                .finally(() => setPending(false));
            }}
          />
        )}
        <hr />
        <button
          className="button subtle"
          onClick={() =>
            void financeRepository
              .recoveryCopies()
              .then(setCopies)
              .catch((caught) =>
                setLocalError(
                  caught instanceof Error ? caught.message : String(caught),
                ),
              )
          }
        >
          Find local recovery checkpoints
        </button>
        {copies.map((copy) => (
          <div className="setting-row" key={copy.id}>
            <div>
              <strong>{copy.reason}</strong>
              <p className="muted">
                {new Date(copy.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="action-pair">
              <button className="button subtle" onClick={() => read(copy.data)}>
                Preview
              </button>
              <button
                className="icon-button"
                aria-label={`Download ${copy.reason}`}
                onClick={() =>
                  void downloadFile(
                    `Morrow-recovery-${copy.id.slice(0, 8)}.json`,
                    copy.data,
                  ).catch((caught) => setLocalError(String(caught)))
                }
              >
                <ArrowDownToLine size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
