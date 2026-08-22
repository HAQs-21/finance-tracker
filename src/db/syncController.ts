import { db } from './db';
import { fetchFromGitHub, pushToGitHub } from '../services/githubSync';
import type { Transaction, Budget, SavingsRecord } from '../types';
import { isPureTransaction } from './financeUtils';

const SHA_KEY = 'finance_tracker_remote_sha';

export async function syncPull() {
  const remote = await fetchFromGitHub();
  if (!remote) return;

  let remoteTransactions: Transaction[] = [];
  let remoteBudgets: Budget[] = [];
  let remoteSavings: SavingsRecord[] = [];

  if (Array.isArray(remote.content)) {
    // Legacy format
    remoteTransactions = remote.content;
  } else if (remote.content && typeof remote.content === 'object') {
    // Multi-table format
    remoteTransactions = remote.content.transactions || [];
    remoteBudgets = remote.content.budgets || [];
    remoteSavings = remote.content.savings || [];
  }

  // Filter out any legacy savings duplicate records from transactions
  const cleanTransactions = remoteTransactions.filter(isPureTransaction);

  await db.transaction('rw', [db.transactions, db.budgets, db.savings], async () => {
    await db.transactions.clear();
    if (cleanTransactions.length > 0) {
      await db.transactions.bulkAdd(cleanTransactions);
    }

    await db.budgets.clear();
    if (remoteBudgets.length > 0) {
      await db.budgets.bulkAdd(remoteBudgets);
    }

    await db.savings.clear();
    if (remoteSavings.length > 0) {
      await db.savings.bulkAdd(remoteSavings);
    }
  });

  if (remote.sha) {
    localStorage.setItem(SHA_KEY, remote.sha);
  }
}

export async function syncPush() {
  const transactions = await db.transactions.toArray();
  const budgets = await db.budgets.toArray();
  const savings = await db.savings.toArray();
  const currentSha = localStorage.getItem(SHA_KEY) || '';
  
  const payload = {
    transactions: transactions.filter(isPureTransaction),
    budgets,
    savings
  };
  
  const newSha = await pushToGitHub(payload, currentSha);
  if (newSha) {
    localStorage.setItem(SHA_KEY, newSha);
  }
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

