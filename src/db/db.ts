import Dexie, { type Table } from 'dexie';
import type { Transaction, Budget, SavingsRecord } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  savings!: Table<SavingsRecord>;

  constructor() {
    super('FinanceTrackerApp');
    this.version(1).stores({
      transactions: '++id, type, category, date',
      budgets: 'category, amount, month',
      savings: '++id, amount, date, type'
    });
  }
}

export const db = new FinanceDB();



