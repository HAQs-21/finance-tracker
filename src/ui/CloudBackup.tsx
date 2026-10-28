import { useEffect, useState } from "react";
import { Eye, EyeOff, Cloud, Check, ArrowUpRight } from "lucide-react";
import {
  downloadBackup,
  uploadBackup,
  getGithubConfig,
  saveGithubConfig,
  clearGithubConfig,
  parseGithubRepository,
  checkGithubConnection,
  BackupRemoteError,
  type GithubConfig,
} from "../data/github";
import {
  loadBackupToken,
  storeBackupToken,
  clearBackupToken,
  secureTokenStorage,
} from "../data/credentials";
import { previewBackup, type useFinanceStore } from "../data/store";
import { downloadFile } from "../data/exports";
import { Field, InlineError } from "./primitives";
import { RestorePreview } from "./DataTools";
import type { Notify } from "./AppShell";
type Store = ReturnType<typeof useFinanceStore>;
type Remote = {
  backup: string;
  sha: string;
  preview: ReturnType<typeof previewBackup>;
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function CloudPanel({
  store,
  notify,
  onRestored,
}: {
  store: Store;
  notify: Notify;
  onRestored?: () => void;
}) {
  const [saved] = useState(getGithubConfig);
  const [repository, setRepository] = useState(
    saved ? `${saved.owner}/${saved.repo}` : "",
  );
  const [path, setPath] = useState(saved?.path || "morrow/current.json");
  const [branch, setBranch] = useState(saved?.branch || "");
  const [token, setToken] = useState(saved?.token || "");
  const [visible, setVisible] = useState(false);
  const [connected, setConnected] = useState<GithubConfig | null>(null);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "restore" | null>(null);
  const [lastBackup, setLastBackup] = useState(() => {
    try {
      return localStorage.getItem("morrow.last-backup") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    let disposed = false;
    void loadBackupToken()
      .then((value) => {
        if (!disposed && value) setToken((current) => current || value);
      })
      .catch(() => {
        if (!disposed)
          setError("Saved token could not be opened. Enter it again.");
      });
    return () => {
      disposed = true;
    };
  }, []);
  const invalidate = () => {
    setConnected(null);
    setRemote(null);
    setMode(null);
    setError("");
  };
  const connect = async () => {
    setPending(true);
    setError("");
    setMode(null);
    setConnected(null);
    setRemote(null);
    try {
      const config = {
        ...parseGithubRepository(repository),
        path: path.trim(),
        branch: branch.trim(),
        token: token.trim().replace(/^Bearer\s+/i, ""),
      };
      if (/\s/.test(config.token))
        throw new Error(
          "Paste the complete token as one line, without spaces.",
        );
      await checkGithubConnection(config);
      await storeBackupToken(config.token);
      saveGithubConfig(config);
      setRepository(`${config.owner}/${config.repo}`);
      setToken(config.token);
      try {
        const downloaded = await downloadBackup(config);
        setRemote({ ...downloaded, preview: previewBackup(downloaded.backup) });
      } catch (caught) {
        if (!(caught instanceof BackupRemoteError && caught.status === 404))
          throw caught;
      }
      setConnected(config);
      notify("Connection saved and checked");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  };
  const upload = async () => {
    if (!connected) return;
    setPending(true);
    setError("");
    try {
      const backup = store.getBackup();
      const sha = await uploadBackup(connected, backup, remote?.sha || null);
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem("morrow.last-backup", stamp);
      } catch {
        /* Display only. */
      }
      setLastBackup(stamp);
      setRemote({ backup, sha, preview: previewBackup(backup) });
      setMode(null);
      notify("Backup uploaded and verified");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="cloud-panel">
      <Field label="GitHub repository">
        <input
          aria-label="GitHub repository"
          placeholder="owner/repository or GitHub URL"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={repository}
          disabled={pending}
          onChange={(event) => {
            invalidate();
            setRepository(event.target.value);
          }}
        />
      </Field>
      <Field label="GitHub access token">
        <div className="token-field">
          <input
            aria-label="GitHub access token"
            type={visible ? "text" : "password"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={token}
            disabled={pending}
            onChange={(event) => {
              invalidate();
              setToken(event.target.value);
            }}
          />
          <button
            className="icon-button"
            aria-label={visible ? "Hide token" : "Show token"}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </Field>
      <p className="data-help">
        {secureTokenStorage()
          ? "Save connection stores the token securely on this Android device."
          : "Token stays in memory until the browser reloads."}
      </p>
      <details className="data-details">
        <summary>Token permissions & backup location</summary>
        <p>
          Select this repository and grant Contents: read and write.
          Organization tokens may need approval.
        </p>
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noreferrer"
        >
          Create a token on GitHub <ArrowUpRight size={13} />
        </a>
        <Field label="Backup path">
          <input
            aria-label="Backup path"
            value={path}
            disabled={pending}
            onChange={(event) => {
              invalidate();
              setPath(event.target.value);
            }}
          />
        </Field>
        <Field label="Branch · optional">
          <input
            aria-label="Backup branch"
            value={branch}
            placeholder="Repository default"
            disabled={pending}
            onChange={(event) => {
              invalidate();
              setBranch(event.target.value);
            }}
          />
        </Field>
      </details>
      <button
        className="button primary"
        disabled={pending || !repository.trim() || !token.trim()}
        onClick={() => void connect()}
      >
        <Cloud size={16} />
        {pending
          ? "Working…"
          : connected
            ? "Check remote again"
            : "Save connection"}
      </button>
      <InlineError error={error} />
      {connected && (
        <section className="cloud-connected" aria-label="Connected backup">
          <div className="data-status">
            <Check size={16} />
            <strong>
              {connected.owner}/{connected.repo}
            </strong>
            <span>Connected</span>
          </div>
          <p className="data-help">
            {remote
              ? `${remote.preview.state.journal.length} remote records · revision ${remote.preview.state.revision}`
              : "No backup at this path yet."}
          </p>
          {lastBackup && (
            <p className="data-help">
              Last verified upload: {new Date(lastBackup).toLocaleString()}
            </p>
          )}
          <div className="data-actions">
            <button
              className="button primary"
              disabled={pending}
              onClick={() => setMode("upload")}
            >
              Back up now
            </button>
            {remote && (
              <>
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => setMode("restore")}
                >
                  Review restore
                </button>
                <button
                  className="button subtle"
                  disabled={pending}
                  onClick={() =>
                    void downloadFile(
                      "Morrow-remote-backup.json",
                      remote.backup,
                    ).catch((caught) => setError(errorText(caught)))
                  }
                >
                  Download remote JSON
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {mode === "upload" && connected && (
        <div className="confirm-box">
          <h3>{remote ? "Replace remote backup?" : "Create backup?"}</h3>
          <p className="data-help">
            {remote
              ? "Uploads this ledger over the checked revision. If another device changes it, the upload stops."
              : "Creates a complete JSON backup. Existing files cannot be overwritten without review."}
          </p>
          <div className="data-actions">
            <button
              className="button primary"
              disabled={pending}
              onClick={() => void upload()}
            >
              {pending ? "Uploading…" : "Confirm backup"}
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => setMode(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "restore" && remote && (
        <RestorePreview
          preview={remote.preview}
          pending={pending}
          onConfirm={() => {
            setPending(true);
            setError("");
            void store
              .replaceFromBackup(remote.backup)
              .then(() => {
                setMode(null);
                notify("Backup restored; previous ledger kept in recovery");
                onRestored?.();
              })
              .catch((caught) => setError(errorText(caught)))
              .finally(() => setPending(false));
          }}
        />
      )}
      {(saved || connected) && (
        <button
          className="quiet-button danger-text"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void clearBackupToken()
              .then(() => {
                clearGithubConfig();
                setRepository("");
                setToken("");
                setPath("morrow/current.json");
                setBranch("");
                invalidate();
                notify("GitHub disconnected");
              })
              .catch((caught) => setError(errorText(caught)))
              .finally(() => setPending(false));
          }}
        >
          Disconnect & remove saved token
        </button>
      )}
    </div>
  );
}
