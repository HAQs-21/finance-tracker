import Dexie, { type Table } from 'dexie';
import type { Transaction } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('FinanceDB');
    this.version(2).stores({
      transactions: '++id, type, category, date'
    });
  }
}

export const db = new FinanceDB();
