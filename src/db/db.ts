import Dexie, { type Table } from 'dexie';
import type { Transaction, Budget, SavingsRecord } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  savings!: Table<SavingsRecord>;

  constructor() {
    super('FinanceDB');
    this.version(3).stores({
      transactions: '++id, type, category, date',
      budgets: 'category, amount',
      savings: '++id, amount, date, type'
    });
    this.version(5).stores({
      transactions: '++id, type, category, date',
      budgets: 'category, amount, month',
      savings: '++id, amount, date, type'
    });
  }
}

export const db = new FinanceDB();

// Graceful auto-recovery for any historical schema conflict
db.open().catch(async (err) => {
  console.warn('Dexie open error, attempting auto-recovery:', err);
  if (err.name === 'UpgradeError' || err.message?.includes('primary key') || err.message?.includes('Upgrade')) {
    try {
      await Dexie.delete('FinanceDB');
      await db.open();
      console.log('Database cleanly recovered and reinitialized.');
    } catch (reopenErr) {
      console.error('Failed to auto-recover database:', reopenErr);
    }
  }
});


