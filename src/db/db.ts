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
  }
}

export const db = new FinanceDB();

