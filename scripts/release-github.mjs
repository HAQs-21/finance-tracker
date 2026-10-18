import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repository = "HAQs-21/finance-tracker";
const packageInfo = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
const argumentsList = process.argv.slice(2);
const argument = (name, fallback) => {
  const position = argumentsList.indexOf(name);
  return position === -1 ? fallback : argumentsList[position + 1];
};
const publish = argumentsList.includes("--publish");
const enablePages = argumentsList.includes("--enable-pages");
const tag = argument("--tag", `v${packageInfo.version}`);
const apkPath = path.resolve(
  workspace,
  argument("--apk", `dist-apk/Morrow-${packageInfo.version}.apk`),
);
const notesFile = argument("--notes-file");

function git(...args) {
  const result = spawnSync("git", args, {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
  });
  if (result.status !== 0)
    throw new Error(
      `Git ${args[0]} failed. Check the repository and existing GitHub sign-in.`,
    );
  return result.stdout.trim();
}

function credential() {
  const supplied = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (supplied) return supplied;
  const result = spawnSync("git", ["credential", "fill"], {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
    input: `protocol=https\nhost=github.com\npath=${repository}.git\n\n`,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
  });
  const password = result.stdout
    ?.split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice(9);
  if (result.status !== 0 || !password)
    throw new Error(
      "No existing GitHub credential is available. Sign in with Git Credential Manager or provide GITHUB_TOKEN.",
    );
  return password;
}

async function main() {
  const remote = git("remote", "get-url", "origin");
  if (
    !/^https:\/\/github\.com\/HAQs-21\/finance-tracker(?:\.git)?\/?$/.test(
      remote,
    )
  )
    throw new Error(
      "The origin repository does not match the authorized Morrow repository.",
    );
  if (!/^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(tag))
    throw new Error("Use a version tag such as v1.0.0.");
  const token = credential();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  async function api(endpoint, options = {}, allowedStatus = []) {
    const response = await fetch(
      endpoint.startsWith("https://")
        ? endpoint
        : `https://api.github.com/repos/${repository}${endpoint}`,
      { ...options, headers: { ...headers, ...options.headers } },
    );
    if (allowedStatus.includes(response.status)) return null;
    if (!response.ok)
      throw new Error(
        `GitHub request failed (${response.status}). No credentials were logged.`,
      );
    if (response.status === 204) return null;
    return response.json();
  }
  const repo = await api("");
  const existingPages = await api("/pages", {}, [404]);
  const pageStatus = (pages) =>
    pages
      ? {
          url: pages.html_url,
          buildType: pages.build_type,
          status: pages.status,
          source: pages.source,
          httpsEnforced: pages.https_enforced,
        }
      : { enabled: false };
  if (!publish && !enablePages) {
    console.log(
      JSON.stringify(
        {
          repository: repo.full_name,
          canPush: repo.permissions?.push ?? null,
          mode: "read-only access check",
          pages: pageStatus(existingPages),
        },
        null,
        2,
      ),
    );
    return;
  }
  const commit = git("rev-parse", "HEAD");
  const remoteCommit = git("ls-remote", "origin", "refs/heads/master").split(
    /\s+/,
  )[0];
  if (commit !== remoteCommit)
    throw new Error(
      "Push the tested current commit to origin/master before changing deployment settings or publishing an APK.",
    );
  if (enablePages) {
    if (existingPages?.build_type !== "workflow") {
      await api("/pages", {
        method: existingPages ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ build_type: "workflow" }),
      });
    }
    const environmentPath = "/environments/github-pages";
    const environment = await api(environmentPath, {}, [404]);
    if (environment?.deployment_branch_policy?.custom_branch_policies) {
      const policies = await api(
        `${environmentPath}/deployment-branch-policies?per_page=100`,
      );
      const allowsMaster = policies.branch_policies.some(
        (policy) => policy.name === "master" && policy.type === "branch",
      );
      if (!allowsMaster) {
        await api(`${environmentPath}/deployment-branch-policies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "master", type: "branch" }),
        });
      }
    }
    const pages = await api("/pages");
    console.log(
      JSON.stringify(
        {
          repository: repository,
          mode: "GitHub Pages workflow deployment enabled",
          pages: pageStatus(pages),
        },
        null,
        2,
      ),
    );
    if (!publish) return;
  }
  if (!notesFile)
    throw new Error(
      "--notes-file is required so the release text is explicit and reviewable.",
    );
  if (await api(`/releases/tags/${encodeURIComponent(tag)}`, {}, [404]))
    throw new Error(
      "That release already exists. Refusing to overwrite release assets.",
    );
  const [apk, notes] = await Promise.all([
    readFile(apkPath),
    readFile(path.resolve(workspace, notesFile), "utf8"),
  ]);
  const checksum = createHash("sha256").update(apk).digest("hex");
  const apkName = path.basename(apkPath);
  const release = await api("/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: commit,
      name: `Morrow ${tag.slice(1)}`,
      body: notes,
      draft: true,
      prerelease: tag.includes("-"),
    }),
  });
  const uploadUrl = release.upload_url.replace(/\{.*$/, "");
  const artifact = await api(
    `${uploadUrl}?name=${encodeURIComponent(apkName)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/vnd.android.package-archive" },
      body: apk,
    },
  );
  await api(`${uploadUrl}?name=${encodeURIComponent(`${apkName}.sha256`)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: `${checksum}  ${apkName}\n`,
  });
  const published = await api(`/releases/${release.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft: false }),
  });
  const publishedApk = published.assets?.find(
    (asset) => asset.id === artifact.id,
  );
  if (!publishedApk)
    throw new Error(
      "Release published, but its final APK URL could not be verified. Check the release before sharing a download link.",
    );
  console.log(
    JSON.stringify(
      {
        release: published.html_url,
        apk: publishedApk.browser_download_url,
        sha256: checksum,
        commit,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
