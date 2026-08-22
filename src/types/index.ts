export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id?: number;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  savingsRecordId?: number;
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  month?: string; // e.g. '2026-08' or 'DEFAULT'
}

export interface SavingsRecord {
  id?: number;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAW';
  date: string;
  description?: string;
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  balance: number;
  vaultBalance: number;
}

export interface CategoryStat {
  category: string;
  amount: number;
  percentage: number;
}

