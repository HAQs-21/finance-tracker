export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id?: number;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface CategoryStat {
  category: string;
  amount: number;
  percentage: number;
}
