import { db } from './db';
import { fetchFromGitHub, pushToGitHub } from '../services/githubSync';

const SHA_KEY = 'finance_tracker_remote_sha';

export async function syncPull() {
  const remote = await fetchFromGitHub();
  if (!remote) return;

  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.clear();
    await db.transactions.bulkAdd(remote.content);
  });

  localStorage.setItem(SHA_KEY, remote.sha);
}

export async function syncPush() {
  const transactions = await db.transactions.toArray();
  const currentSha = localStorage.getItem(SHA_KEY) || '';
  
  const newSha = await pushToGitHub(transactions, currentSha);
  localStorage.setItem(SHA_KEY, newSha);
}

export async function syncDatabase() {
  try {
    await syncPull();
    console.log('Database synced successfully from GitHub');
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
