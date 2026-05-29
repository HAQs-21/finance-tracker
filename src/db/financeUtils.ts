import type { Transaction, SummaryStats, CategoryStat } from '../types';

export const calculateOverallStats = (transactions: Transaction[]): SummaryStats => {
  const stats = transactions.reduce(
    (acc, t) => {
      if (t.type === 'INCOME') acc.totalIncome += t.amount;
      else acc.totalExpense += t.amount;
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );

  return {
    ...stats,
    balance: stats.totalIncome - stats.totalExpense
  };
};

export const calculateMonthlyStats = (transactions: Transaction[], yearMonth: string): SummaryStats => {
  const monthlyTransactions = transactions.filter(t => t.date.startsWith(yearMonth));
  return calculateOverallStats(monthlyTransactions);
};

export const calculateCategoryDistribution = (transactions: Transaction[], yearMonth: string): CategoryStat[] => {
  const monthlyExpenses = transactions.filter(t => t.date.startsWith(yearMonth) && t.type === 'EXPENSE');
  const totalMonthlyExpense = monthlyExpenses.reduce((sum, t) => sum + t.amount, 0);

  if (totalMonthlyExpense === 0) return [];

  const categoryMap = monthlyExpenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
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

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};
