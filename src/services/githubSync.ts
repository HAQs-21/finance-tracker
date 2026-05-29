import type { Transaction } from '../types';

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

export interface GithubFileResponse {
  content: Transaction[];
  sha: string;
}

const STORAGE_KEY = 'finance_tracker_gh_config';

export const getStoredConfig = (): GithubConfig | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveConfig = (config: GithubConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

const toBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
const fromBase64 = (str: string) => decodeURIComponent(escape(atob(str)));

export async function fetchFromGitHub(): Promise<GithubFileResponse | null> {
  const config = getStoredConfig();
  if (!config) return null;

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (response.status === 404) return { content: [], sha: '' };
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch from GitHub');
  }

  const data = await response.json();
  const content = JSON.parse(fromBase64(data.content.replace(/\s/g, '')));
  
  return {
    content,
    sha: data.sha
  };
}

export async function pushToGitHub(transactions: Transaction[], sha: string): Promise<string> {
  const config = getStoredConfig();
  if (!config) throw new Error('GitHub configuration missing');

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const content = toBase64(JSON.stringify(transactions, null, 2));

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
      sha: sha || undefined
    })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      throw new Error('Conflict: Remote data has changed. Please pull first.');
    }
    throw new Error(error.message || 'Failed to push to GitHub');
  }

  const data = await response.json();
  return data.content.sha;
}
