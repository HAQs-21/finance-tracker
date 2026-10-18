export interface GithubConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export class BackupRemoteError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BackupRemoteError";
    this.status = status;
  }
}

const CONFIG_KEY = "morrow.github.destination.v1";
let sessionToken = "";

/** Only destination settings are persisted. Access tokens stay in memory. */
export function getGithubConfig(): GithubConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.owner !== "string" ||
      typeof v.repo !== "string" ||
      typeof v.path !== "string"
    )
      return null;
    return { owner: v.owner, repo: v.repo, path: v.path, token: sessionToken };
  } catch {
    return null;
  }
}

export function saveGithubConfig(config: GithubConfig): void {
  validateConfig(config);
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      owner: config.owner.trim(),
      repo: config.repo.trim(),
      path: config.path.trim(),
    }),
  );
  sessionToken = config.token.trim();
}

export function clearGithubConfig(): void {
  sessionToken = "";
  localStorage.removeItem(CONFIG_KEY);
}

function validateConfig(config: GithubConfig): void {
  if (
    !/^[\w.-]+$/.test(config.owner.trim()) ||
    !/^[\w.-]+$/.test(config.repo.trim())
  ) {
    throw new Error("Enter a valid GitHub owner and repository name.");
  }
  if (!config.token.trim())
    throw new Error(
      "Enter a GitHub access token. It is kept for this session only.",
    );
  if (
    !config.path.trim() ||
    config.path.split("/").some((part) => part === ".." || !part)
  ) {
    throw new Error(
      "Enter a relative backup file path, such as morrow/current.json.",
    );
  }
}

function endpoint(config: GithubConfig): string {
  validateConfig(config);
  return `https://api.github.com/repos/${encodeURIComponent(config.owner.trim())}/${encodeURIComponent(config.repo.trim())}/contents/${config.path.trim().split("/").map(encodeURIComponent).join("/")}`;
}

function headers(config: GithubConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token.trim()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function decode(base64: string): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(base64.replace(/\s/g, "")), (char) =>
      char.charCodeAt(0),
    ),
  );
}

async function remoteError(response: Response): Promise<BackupRemoteError> {
  if (response.status === 404)
    return new BackupRemoteError(
      "Backup file was not found, or this token cannot access it. Your local data is unchanged.",
      404,
    );
  if (response.status === 409 || response.status === 422)
    return new BackupRemoteError(
      "The remote backup changed. Download and review it before uploading again. No overwrite was attempted.",
      response.status,
    );
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return new BackupRemoteError(
    body.message ||
      `GitHub request failed (${response.status}). Your local data is unchanged.`,
    response.status,
  );
}

export async function downloadBackup(
  config: GithubConfig,
  signal?: AbortSignal,
): Promise<{ backup: string; sha: string }> {
  const response = await fetch(`${endpoint(config)}?ref=HEAD&t=${Date.now()}`, {
    headers: headers(config),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await remoteError(response);
  const body = (await response.json()) as {
    content?: string;
    sha?: string;
    encoding?: string;
    type?: string;
    size?: number;
  };
  if (body.type !== "file" || !body.sha)
    throw new Error(
      "GitHub did not return a readable backup file. Local data is unchanged.",
    );
  if (body.size && body.size > 90_000_000)
    throw new Error(
      "This backup is too large for an in-app restore. Download its JSON file with GitHub and restore it locally.",
    );
  if (body.encoding === "base64" && body.content)
    return { backup: decode(body.content), sha: body.sha };
  // The Contents API omits inline content for larger files. Fetch the immutable
  // blob revision so a concurrent remote edit cannot change this download.
  const blobUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner.trim())}/${encodeURIComponent(config.repo.trim())}/git/blobs/${encodeURIComponent(body.sha)}`;
  const blobResponse = await fetch(blobUrl, {
    headers: headers(config),
    cache: "no-store",
    signal,
  });
  if (!blobResponse.ok) throw await remoteError(blobResponse);
  const blob = (await blobResponse.json()) as {
    encoding?: string;
    content?: string;
    sha?: string;
  };
  if (blob.encoding !== "base64" || !blob.content || blob.sha !== body.sha)
    throw new Error(
      "GitHub returned an incomplete backup blob. Local data is unchanged.",
    );
  return { backup: decode(blob.content), sha: body.sha };
}

export const inspectRemote = downloadBackup;

/** expectedSha must come from a reviewed download; null permits creating a new file only. */
export async function uploadBackup(
  config: GithubConfig,
  backup: string,
  expectedSha: string | null,
  signal?: AbortSignal,
): Promise<string> {
  if (!backup.trim()) throw new Error("An empty backup cannot be uploaded.");
  const response = await fetch(endpoint(config), {
    method: "PUT",
    headers: headers(config),
    signal,
    body: JSON.stringify({
      message: `Morrow verified backup ${new Date().toISOString()}`,
      content: encode(backup),
      ...(expectedSha ? { sha: expectedSha } : {}),
    }),
  });
  if (!response.ok) throw await remoteError(response);
  const body = (await response.json()) as { content?: { sha?: string } };
  if (!body.content?.sha)
    throw new Error(
      "GitHub accepted the request but returned no file revision. Download to verify before retrying.",
    );
  const verified = await downloadBackup(config, signal);
  if (verified.sha !== body.content.sha || verified.backup !== backup)
    throw new Error(
      "The uploaded revision could not be verified, or another device changed it. Download and inspect the remote copy before retrying.",
    );
  return body.content.sha;
}
