import Dexie, { type Table } from 'dexie';
import type { Transaction, Budget, SavingsRecord } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  savings!: Table<SavingsRecord>;

  constructor() {
    super('FinanceTracker');
    this.version(1).stores({
      transactions: '++id, type, category, date',
      budgets: 'category, amount, month',
      savings: '++id, amount, date, type'
    });
  }
}

export const db = new FinanceDB();

// Automatically migrate from old FinanceDB if present and clean up legacy conflict
if (typeof window !== 'undefined') {
  (async () => {
    try {
      if ('indexedDB' in window) {
        const dbs = await indexedDB.databases?.();
        const hasLegacy = dbs?.some(d => d.name === 'FinanceDB');
        if (hasLegacy) {
          try {
            const oldDB = new Dexie('FinanceDB');
            await oldDB.open();
            const oldTx = await oldDB.table('transactions').toArray().catch(() => []);
            const oldBudgets = await oldDB.table('budgets').toArray().catch(() => []);
            const oldSavings = await oldDB.table('savings').toArray().catch(() => []);
            oldDB.close();

            const currentCount = await db.transactions.count();
            if (currentCount === 0 && oldTx.length > 0) {
              await db.transactions.bulkAdd(oldTx);
              if (oldBudgets.length > 0) await db.budgets.bulkAdd(oldBudgets);
              if (oldSavings.length > 0) await db.savings.bulkAdd(oldSavings);
            }
          } catch {
            // If old DB is corrupt or has upgrade error, ignore reading and delete
          }
          await Dexie.delete('FinanceDB').catch(() => {});
        }
      }
    } catch {
      // Ignore migration errors
    }
  })();
}


