export interface GithubConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
  branch?: string;
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

export function parseGithubRepository(value: string): {
  owner: string;
  repo: string;
} {
  const clean = value
    .trim()
    .replace(/^https:\/\/(?:www\.)?github\.com\//i, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "");
  const parts = clean.split("/");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[\w.-]+$/.test(part)) ||
    parts.some((part) => part === "." || part === "..")
  )
    throw new Error("Enter owner/repository or its github.com URL.");
  return { owner: parts[0], repo: parts[1] };
}

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
    return {
      owner: v.owner,
      repo: v.repo,
      path: v.path,
      token: sessionToken,
      branch: typeof v.branch === "string" ? v.branch : "",
    };
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
      branch: config.branch?.trim() || "",
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
    config.branch &&
    (/\s|\.\.|[~^:?*\\[\]]/.test(config.branch) ||
      config.branch.startsWith("/") ||
      config.branch.endsWith("/"))
  )
    throw new Error(
      "Enter a valid branch name, or leave it empty for the repository default.",
    );
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
  if (response.status === 401)
    return new BackupRemoteError(
      "GitHub rejected this token. Check that it is complete and has not expired or been revoked.",
      401,
    );
  if (response.status === 403)
    return new BackupRemoteError(
      "GitHub denied access. Give this token access to the selected repository with Contents: read and write. Organization tokens may also need approval or SSO authorization. GitHub rate limits can also temporarily block requests.",
      403,
    );
  if (response.status === 429)
    return new BackupRemoteError(
      "GitHub is rate limiting requests. Wait before trying again; your local data is unchanged.",
      429,
    );
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

/** Native transport avoids WebView CORS/network quirks; browser uses normal fetch. */
async function request(url: string, options: RequestInit): Promise<Response> {
  const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.request({
        url,
        method: options.method || "GET",
        headers: options.headers as Record<string, string>,
        ...(options.body ? { data: JSON.parse(String(options.body)) } : {}),
        responseType: "json",
        connectTimeout: 15000,
        readTimeout: 20000,
      });
      return new Response(JSON.stringify(response.data), {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      throw new Error(
        "Could not reach GitHub. Check your connection. Inspect the remote backup before retrying an upload.",
      );
    }
  }
  const timeout = AbortSignal.timeout(20000);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal
        ? AbortSignal.any([timeout, options.signal])
        : timeout,
    });
  } catch {
    throw new Error(
      "Could not reach GitHub or the request timed out. Check your connection and inspect the remote copy before retrying an upload.",
    );
  }
}

export async function checkGithubConnection(
  config: GithubConfig,
): Promise<void> {
  validateConfig(config);
  const base = `https://api.github.com/repos/${encodeURIComponent(config.owner.trim())}/${encodeURIComponent(config.repo.trim())}`;
  const repo = await request(base, {
    headers: headers(config),
    cache: "no-store",
  });
  if (repo.status === 404)
    throw new BackupRemoteError(
      "Repository not found or unavailable to this token. Check owner/repository, the token's repository access, and organization approval.",
      404,
    );
  if (!repo.ok) throw await remoteError(repo);
  const contents = await request(
    `${base}/contents${config.branch?.trim() ? `?ref=${encodeURIComponent(config.branch.trim())}` : ""}`,
    {
      headers: headers(config),
      cache: "no-store",
    },
  );
  if (contents.status === 404)
    throw new BackupRemoteError(
      "Cannot read repository contents. Check the backup branch and the token's Contents permission.",
      404,
    );
  if (!contents.ok && contents.status !== 409)
    throw await remoteError(contents);
}

export async function downloadBackup(
  config: GithubConfig,
  signal?: AbortSignal,
): Promise<{ backup: string; sha: string }> {
  const response = await request(
    `${endpoint(config)}?${config.branch?.trim() ? `ref=${encodeURIComponent(config.branch.trim())}&` : ""}t=${Date.now()}`,
    {
      headers: headers(config),
      cache: "no-store",
      signal,
    },
  );
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
  const blobResponse = await request(blobUrl, {
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
  const response = await request(endpoint(config), {
    method: "PUT",
    headers: headers(config),
    signal,
    body: JSON.stringify({
      message: `Morrow verified backup ${new Date().toISOString()}`,
      content: encode(backup),
      ...(expectedSha ? { sha: expectedSha } : {}),
      ...(config.branch?.trim() ? { branch: config.branch.trim() } : {}),
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
