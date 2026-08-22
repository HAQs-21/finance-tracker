
export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

export interface GithubFileResponse {
  content: any;
  sha: string;
}

const STORAGE_KEY = 'finance_tracker_gh_config';

let runtimeConfig: GithubConfig | null = null;

export const setRuntimeConfig = (config: GithubConfig) => {
  runtimeConfig = config;
};

export const getStoredConfig = (): GithubConfig | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveConfig = (config: GithubConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  runtimeConfig = config;
};

export const clearConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getActiveConfig = (): GithubConfig | null => {
  return runtimeConfig || getStoredConfig();
};

const toBase64 = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
};

const fromBase64 = (base64: string) => {
  const binString = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export async function getRemoteFileSha(): Promise<string | null> {
  const config = getActiveConfig();
  if (!config) return null;

  try {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      cache: 'no-store'
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = await response.json();
    return data.sha || null;
  } catch {
    return null;
  }
}

export async function fetchFromGitHub(): Promise<GithubFileResponse | null> {
  const config = getActiveConfig();
  if (!config) return null;

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?t=${Date.now()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    cache: 'no-store'
  });

  if (response.status === 404) return { content: [], sha: '' };
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to fetch from GitHub (Status: ${response.status})`);
  }

  const data = await response.json();
  const content = JSON.parse(fromBase64(data.content));
  
  return {
    content,
    sha: data.sha
  };
}

export async function pushToGitHub(payload: any, sha?: string): Promise<string> {
  const config = getActiveConfig();
  if (!config) throw new Error('GitHub configuration missing');

  let targetSha = sha;
  if (!targetSha) {
    const remoteSha = await getRemoteFileSha();
    if (remoteSha) targetSha = remoteSha;
  }

  const executePut = async (shaToSend?: string) => {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
    const content = toBase64(JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Sync finance data',
        content,
        sha: shaToSend || undefined
      })
    });

    return response;
  };

  let response = await executePut(targetSha);

  // If conflict occurs (409), fetch latest remote SHA and retry once
  if (response.status === 409) {
    const latestSha = await getRemoteFileSha();
    response = await executePut(latestSha || undefined);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 409) {
      throw new Error('Conflict: Remote data has changed. Please pull first or try again.');
    }
    throw new Error(error.message || `Failed to push to GitHub (Status: ${response.status})`);
  }

  const data = await response.json();
  return data.content?.sha || data.commit?.sha || '';
}

