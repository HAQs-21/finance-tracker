
import type { Transaction, SavingsRecord, SummaryStats, CategoryStat } from '../types';

export const isPureTransaction = (t: Transaction): boolean => {
  return t.category.toLowerCase() !== 'savings' && !t.savingsRecordId;
};

export const calculateOverallStats = (
  transactions: Transaction[],
  savings: SavingsRecord[] = []
): SummaryStats => {
  const validTransactions = transactions.filter(isPureTransaction);
  
  const stats = validTransactions.reduce(
    (acc, t) => {
      if (t.type === 'INCOME') acc.totalIncome += t.amount;
      else if (t.type === 'EXPENSE') acc.totalExpense += t.amount;
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );

  const totalSavings = savings.reduce((sum, s) => {
    return s.type === 'DEPOSIT' ? sum + s.amount : sum - s.amount;
  }, 0);

  const vaultBalance = savings.reduce((sum, s) => {
    return s.type === 'DEPOSIT' ? sum + s.amount : sum - s.amount;
  }, 0);

  return {
    totalIncome: stats.totalIncome,
    totalExpense: stats.totalExpense,
    totalSavings,
    balance: stats.totalIncome - stats.totalExpense - totalSavings,
    totalCash: stats.totalIncome - stats.totalExpense,
    vaultBalance
  };
};

export const calculateMonthlyStats = (
  transactions: Transaction[],
  savings: SavingsRecord[] = [],
  yearMonth: string
): SummaryStats => {
  const monthlyTransactions = yearMonth === 'ALL' 
    ? transactions 
    : transactions.filter(t => t.date.startsWith(yearMonth));

  const monthlySavings = yearMonth === 'ALL'
    ? savings
    : savings.filter(s => s.date.startsWith(yearMonth));

  const validMonthlyTransactions = monthlyTransactions.filter(isPureTransaction);

  const stats = validMonthlyTransactions.reduce(
    (acc, t) => {
      if (t.type === 'INCOME') acc.totalIncome += t.amount;
      else if (t.type === 'EXPENSE') acc.totalExpense += t.amount;
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );

  const monthlyNetSavings = monthlySavings.reduce((sum, s) => {
    return s.type === 'DEPOSIT' ? sum + s.amount : sum - s.amount;
  }, 0);

  const lifetimeVaultBalance = savings.reduce((sum, s) => {
    return s.type === 'DEPOSIT' ? sum + s.amount : sum - s.amount;
  }, 0);

  return {
    totalIncome: stats.totalIncome,
    totalExpense: stats.totalExpense,
    totalSavings: monthlyNetSavings,
    balance: stats.totalIncome - stats.totalExpense - monthlyNetSavings,
    totalCash: stats.totalIncome - stats.totalExpense,
    vaultBalance: lifetimeVaultBalance
  };
};

export const calculateCategoryDistribution = (transactions: Transaction[], yearMonth: string): CategoryStat[] => {
  const monthlyExpenses = transactions.filter(
    t => (yearMonth === 'ALL' || t.date.startsWith(yearMonth)) && 
         t.type === 'EXPENSE' && 
         isPureTransaction(t)
  );
  const totalMonthlyExpense = monthlyExpenses.reduce((sum, t) => sum + t.amount, 0);

  if (totalMonthlyExpense === 0) return [];

  const categoryMap = monthlyExpenses.reduce((acc, t) => {
    const cat = t.category.trim() || 'General';
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / totalMonthlyExpense) * 100
    }))
    .sort((a, b) => b.amount - a.amount);
};

const pkrFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return 'PKR 0';
  return pkrFormatter.format(amount);
};
